define([
    "module",
    "require",
    "knockout",
    "sdk",
    "api/index"
], (module, require, ko, sdk, api) => {
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
        this.types = args.types;
        this.typesOther = args.typesOther;
        this.panel = args.panel;
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


    /**
     * Gets the icon for the work item type.
     * 
     * @param {object} item Current item.
     */
    Model.prototype._getIcon = function (item) {
        const type = ((this.typesOther.find((to) => to.project === item.project) || {}).types || this.types).find((t) => t.name === item.type) || {};

        if (!type) {
            return "";
        }

        return type.icon.url;
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
                    types: config.types,
                    typesOther: config.typesOther,
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