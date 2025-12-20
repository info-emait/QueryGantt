define([
    "module",
    "require",
    "knockout",
    "sdk",
    "api/index",
    "api/WorkItemTracking/index"
], (module, require, ko, sdk, api, witApi) => {
    //#region [ Fields ]

    const global = (function () { return this; })();
    const doc = global.document;
    const cnf = module.config();

    //#endregion


    //#region [ Constructors ]
    
    /**
     * Constructor.
     * 
     * @param {object} args Arguments.
     */
    const Model = function (args = {}) {
        console.debug("QueryGanttDetailApp()");

        this.version = args.version;
        this.project = args.project;
        this.item = args.item;
        this.id = args.id;
        this.types = args.types;
        this.typesOther = args.typesOther;
        this.panel = args.panel;

        this.start = ko.observable(args.start || null);
        this.target = ko.observable(args.target || null);
        this.state = ko.observable(args.state || null);

        this.updateWit = args.updateWitCallback;
        this.updateRecord = args.updateRecordCallback;
    };

    //#endregion


    //#region [ Methods : Private ]

    /**
     * Gets date formatted as string.
     * 
     * @param {Date} d Date object.
     */
    Model.prototype._getFormattedDate = function (d) {
        if (!(d instanceof Date) || isNaN(d)) {
            return "×";
        }
        
        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const year = d.getFullYear();
        
        return `${day}/${month}/${year}`;
    };

    //#endregion


    //#region [ Methods : Public ]

    /**
     * Initialize the application.
     */
    Model.prototype.init = function () {
        const client = api.getClient(witApi.WorkItemTrackingRestClient);

        return Promise
            .all([
                client.getWorkItems([this.id], this.item.project, null, null, "all").then((response) => response[0]),
                client.getComments(this.id, this.item.project)
            ])
            .then((response) => ({ wit: response[0], comments: response[1].comments }))
            .then(({ wit, comments }) => {
                const start = wit.fields["Microsoft.VSTS.Scheduling.StartDate"];
                if (start instanceof Date) {
                    this.start(`${start.getFullYear()}-${((start.getMonth() + 1) + "").padStart(2, "0")}-${(start.getDate() + "").padStart(2, "0")}`);
                }

                const target = wit.fields["Microsoft.VSTS.Scheduling.TargetDate"];
                if (target instanceof Date) {
                    this.target(`${target.getFullYear()}-${((target.getMonth() + 1) + "").padStart(2, "0")}-${(target.getDate() + "").padStart(2, "0")}`);
                }

                this.state(wit.fields["System.State"]);
            });
    };


    /**
     * Closes the panel.
     */
    Model.prototype.close = function() {
        this.panel.close();
    };


    /**
     * Saves settings and closes the panel.
     */
    Model.prototype.save = function() {
        const date = (d) => {
            if (!d) {
                return new Date("");
            }
    
            let tmp = d.split("T")[0];
            tmp = tmp.split("-");
            return new Date(parseInt(tmp[0]), parseInt(tmp[1]) - 1, parseInt(tmp[2]), 0, 0, 0);
        };

        const start = date(this.start());
        const target = date(this.target());
        target.setDate(target.getDate() + 1);
        const state = this.state();

        this.updateWit({
            id: this.id,
            start: start,
            end: target,
            state
        }).then((response) => {
            if (!response) {
                return;
            }

            this.updateRecord(this.id, { start, end: target, state });
        });
    };


    /**
     * Dispose.
     */
    Model.prototype.dispose = function () {
        console.log("~QueryGanttDetailApp()");
    };

    //#endregion


    //#region [ Methods ]

    /**
     * Fires function when DOM is ready.
     *
     * @param {function} fn Function.
     */
    let ready = function (fn) {
        if (doc.attachEvent ? (doc.readyState === "complete") : (doc.readyState !== "loading")) {
            fn();
        }
        else {
            doc.addEventListener("DOMContentLoaded", fn);
        }
    };

    //#endregion


    //#region [ Start ]

    ready(function () {
        sdk.init({                        
            loaded: false,
            applyTheme: true
        });

        sdk.ready()
            .then(() => sdk.getService(api.CommonServiceIds.ProjectPageService).then((service) => service.getProject()))
            .then((project) => {
                const config = sdk.getConfiguration();

                // Create application model
                const model = new Model({
                    version: cnf.version,
                    project: project,
                    item: config.item,
                    id: config.id,
                    types: config.types,
                    typesOther: config.typesOther,
                    updateWitCallback: config.updateWitCallback,
                    updateRecordCallback: config.updateRecordCallback,
                    panel: config.panel
                });
                console.debug("QueryGanttDetailApp : ready() : %o", model);
                
                // Register dialog
                sdk.register("#{Extension.Id}#-detail", () => model);

                // Start application and init application
                ko.applyBindings(model, doc.body);
                sdk.notifyLoadSucceeded();
                model.init().then(() => console.debug("Query Gantt detail is running."));
            });
    });

    //#endregion
});