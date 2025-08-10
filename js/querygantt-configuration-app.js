define([
    "module",
    "require",
    "knockout",
    "sdk",
    "api/index",
    "services/data"
], (module, require, ko, sdk, api, dataService) => {
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
        console.debug("QueryGanttConfigurationApp()");

        this.version = args.version;
        this.project = args.project;
        this.fields = ko.isObservable(args.fields) ? args.fields : ko.observableArray(args.fields || []);
        this.fieldsValue = ko.isObservable(args.fieldsValue) ? args.fieldsValue : ko.observableArray(args.fieldsValue || []);
        this.panel = args.panel;
    };

    //#endregion


    //#region [ Methods : Public ]

    /**
     * Initialize the application.
     */
    Model.prototype.init = function () {
        return Promise.resolve(true);
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
        const fieldsValue = this.fieldsValue();
        const settings = {
            showFields: fieldsValue
        };

        dataService.getManager().then((manager) => {
            manager.setValue(`gantt_${this.project.id}`, JSON.stringify(settings), { scopeType: "User" });
            this.panel.close({ fieldsValue });
        });
    };


    /**
     * Dispose.
     */
    Model.prototype.dispose = function () {
        console.log("~QueryGanttConfigurationApp()");
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
                //sdk.resize(300, undefined);
                const config = sdk.getConfiguration();

                // Create application model
                const model = new Model({
                    version: cnf.version,
                    project: project,
                    fields: config.fields,
                    fieldsValue: config.fieldsValue,
                    panel: config.panel
                });
                console.debug("QueryGanttConfigurationApp : ready() : %o", model);
                
                // Register dialog
                sdk.register("#{Extension.Id}#-configuration", () => model);

                // Start application and init application
                ko.applyBindings(model, doc.body);
                sdk.notifyLoadSucceeded();
                model.init().then(() => console.debug("Query Gantt configuration is running."));
            });
    });

    //#endregion
});