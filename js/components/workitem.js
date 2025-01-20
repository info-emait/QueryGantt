define([
    "knockout"
], function (ko) {
    //#region [ Constructors ]
    
    /**
     * Constructor.
     * 
     * @param {object} args Arguments.
     */
    let WorkItem = function (args = {}) {
        console.debug("WorkItem()");

        this.title = ko.isObservable(args.title) ? args.title : ko.observable(args.title || "");
        this.icon = ko.isObservable(args.icon) ? args.icon : ko.observable(args.icon || "");
        this.types = ko.isObservable(args.types) ? args.types : ko.observable(args.types || []);
        this.typesOther = ko.isObservable(args.typesOther) ? args.typesOther : ko.observable(args.typesOther || []);
        this.selectedItem = ko.isObservable(args.selectedItem) ? args.selectedItem : ko.observable(args.selectedItem || null);
        
        this.type = ko.observable({});
        
        this.callbacks = args.callbacks;

        this._onSelectedItemChangedSubscribe = ko.computed(this._onSelectedItemChanged, this);
    };

    //#endregion


    //#region [ Methods : Private ]

    /**
     * Gets the selected item.
     */
    WorkItem.prototype._onSelectedItemChanged = function () {
        let wit = this.selectedItem();
        let types = this.types();
        let typesOther = this.typesOther();
        let title = this.title();
        
        if (ko.computedContext.isInitial()) {
            return;
        }

        if (!title || !title.length) {
            return;
        }

        // Find type
        var type = ((typesOther.find((to) => to.project === wit.project) || {}).types || types).find((t) => t.name === wit.type);
        this.type(type);
    }; 

    //#endregion


    //#region [ Methods : Public ]

    /**
     * Direct method to receive a descendantsComplete notification.
     * Knockout will call it with the component’s node once all descendants are bound.
     * 
     * @param {element} node Html element. 
     */
    WorkItem.prototype.koDescendantsComplete = function (node) {
        // Replace custom element placehoder
        let root = node.firstElementChild;
        node.replaceWith(root);
    };


    /**
     * Executes the callback.
     * 
     * @param {string} name The name of the callback.
     * @param {array} args Callback arguemnts.
     */
    WorkItem.prototype.callback = function (name, ...args) {
        if (!this.callbacks) {
            return;
        }

        if (typeof (this.callbacks[name]) !== "function") {
            console.warn("WorkItem : callback(): Callback '%s' is not defined.", name);
            return;
        }

        this.callbacks[name](...args);
    };


    /**
     * Dispose.
     */
    WorkItem.prototype.dispose = function () {
        console.log("~WorkItem()");
        
        this._onSelectedItemChangedSubscribe.dispose();
    };

    //#endregion


    //#region [ Methods : Static ]

    /**
     * Factory method.
     *
     * @param {object} params Parameters.
     * @param {object} componentInfo Component into.
     * @returns {object} Instance of the model.
     */
    WorkItem.createViewModel = function (params, componentInfo) {
        params = params || {};
        params.element = componentInfo.element.querySelector ? componentInfo.element : componentInfo.element.parentElement || componentInfo.element.parentNode;

        return new WorkItem(params);
    };

    //#endregion


    //#region [ Registration ]

    ko.components.register("my-workitem", {
        viewModel: { 
            createViewModel: WorkItem.createViewModel 
        },
        template: 
            `<div class="my-header my-header--workitem bolt-header-with-commandbar bolt-header-with-back-button bolt-header flex-row flex-noshrink flex-start bolt-header-no-spacing-defined">
                <div class="bolt-header-content-area flex-row flex-grow flex-self-stretch depth-8">
                    <div class="bolt-header-icon m"
                         data-bind="visible: icon().length">
                        <span class="fluent-icons-enabled">
                            <span aria-hidden="true" class="flex-noshrink fabric-icon"
                                  data-bind="class: icon"></span>
                        </span>
                    </div>
                    <div class="bolt-header-title-area flex-column flex-grow scroll-hidden" style="flex-direction: row">
                        <div class="bolt-header-title-row flex-row flex-baseline"
                             data-bind="visible: title().length, if: title().length">
                            <div aria-level="3" class="my-header__title my-header__title--border bolt-header-title body-xl m" role="heading"
                                 data-bind="style: { 'border-left-color': '#' + type().color }">
                                <!-- ko text: selectedItem().id --><!-- /ko -->
                                &nbsp;&nbsp;
                                <!-- ko text: title --><!-- /ko -->
                            </div>
                        </div>
                    </div>
                    <div class="flex-self-start bolt-header-commandbar bolt-button-group flex-row" role="menubar">
                        <div class="flex-self-start bolt-header-commandbar-button-group flex-row flex-center flex-grow scroll-hidden rhythm-horizontal-8">
                            <button aria-label="Edit the selected work item" title="Edit the selected work item" class="my-header__button my-header__button--icon my-header__button--for-item icon-only bolt-button bolt-icon-button enabled subtle icon-only bolt-focus-treatment" role="button" tabindex="6" type="button"
                                    data-bind="click: () => callback('edit'), visible: selectedItem()">
                                <span class="fluent-icons-enabled">
                                    <span aria-hidden="true" class="left-icon flex-noshrink fabric-icon ms-Icon--Edit medium"></span>
                                </span>
                            </button>
                            <button aria-label="Focus the selected work item" title="Focus the selected work item" class="my-header__button my-header__button--icon my-header__button--for-item icon-only bolt-button bolt-icon-button enabled subtle icon-only bolt-focus-treatment" role="button" tabindex="7" type="button"
                                    data-bind="click: () => callback('focus'), visible: selectedItem()">
                                <span class="fluent-icons-enabled">
                                    <span aria-hidden="true" class="left-icon flex-noshrink fabric-icon ms-Icon--Pin medium"></span>
                                </span>
                            </button>
                            <button aria-label="Close the selected work item" title="Close the selected work item" class="my-header__button my-header__button--icon my-header__button--for-item icon-only bolt-button bolt-icon-button enabled subtle icon-only bolt-focus-treatment" role="button" tabindex="8" type="button"
                                    data-bind="click: () => callback('close'), visible: selectedItem()">
                                <span class="fluent-icons-enabled">
                                    <span aria-hidden="true" class="left-icon flex-noshrink fabric-icon ms-Icon--ChromeClose medium"></span>
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>`
    });

    //#endregion
});