define([
    "knockout"
], function (ko) {
    //#region [ Fields ]
    
    const global = (function () { return this; })();
    const doc = global.document;
    
    //#endregion


    //#region [ Constructors ]
    
    /**
     * Constructor.
     * 
     * @param {object} args Arguments.
     */
    let Header = function (args = {}) {
        console.debug("Header()");

        this.element = args.element.firstElementChild;
        this.title = ko.isObservable(args.title) ? args.title : ko.observable(args.title || "");
        this.icon = ko.isObservable(args.icon) ? args.icon : ko.observable(args.icon || "");
        this.selectedItem = ko.isObservable(args.selectedItem) ? args.selectedItem : ko.observable(args.selectedItem || null);
        this.showFields = ko.isObservableArray(args.showFields) ? args.showFields : ko.observableArray(args.showFields || []);
        this.filter = ko.isObservable(args.filter) ? args.filter : ko.observable(args.filter || "");
        this.queryType = ko.isObservable(args.queryType) ? args.queryType : ko.observable(args.queryType || "");
        this.shareLink = ko.isObservable(args.shareLink) ? args.shareLink : ko.observable(args.shareLink || "");
        this.fields = ko.isObservableArray(args.fields) ? args.fields : ko.observableArray(args.fields || []);

        this.fieldsPopupTarget = ko.observable(null);
        this.fieldsPopupTop = ko.observable("-9999px");
        this.fieldsPopupLeft = ko.observable("-9999px");

        this.callbacks = args.callbacks;
    };

    //#endregion


    //#region [ Methods : Public ]

    /**
     * Direct method to receive a descendantsComplete notification.
     * Knockout will call it with the component’s node once all descendants are bound.
     * 
     * @param {element} node Html element. 
     */
    Header.prototype.koDescendantsComplete = function (node) {
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
    Header.prototype.callback = function (name, ...args) {
        if (!this.callbacks) {
            return;
        }

        if (typeof (this.callbacks[name]) !== "function") {
            console.warn("Header : callback(): Callback '%s' is not defined.", name);
            return;
        }

        this.callbacks[name](...args);
    };


    /**
     *  Shows or hides the fields popup.
     *  
     * @param {object} component Current component.
     * @param {object} e Event arguments. 
     */
    Header.prototype.showFieldsPopup = function (component, e) {
        if (this.fieldsPopupTarget() != null) {
            this.fieldsPopupTarget(null);
            this.fieldsPopupTop("-9999px");
            this.fieldsPopupLeft("-9999px");
            return;
        }

        let target = e.target;

        let top = Math.floor(target.getBoundingClientRect().top + doc.body.scrollTop)
            - Math.floor(this.element.getBoundingClientRect().top + doc.body.scrollTop)
            + target.offsetHeight;
        let left = Math.floor(target.getBoundingClientRect().left + doc.body.scrollLeft)
            - Math.floor(this.element.getBoundingClientRect().left + doc.body.scrollLeft);

        this.fieldsPopupTop(top + "px");
        this.fieldsPopupLeft(left + "px");
        this.fieldsPopupTarget(target);
    };


    /**
     * Dispose.
     */
    Header.prototype.dispose = function () {
        console.log("~Header()");
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
    Header.createViewModel = function (params, componentInfo) {
        params = params || {};
        params.element = componentInfo.element.querySelector ? componentInfo.element : componentInfo.element.parentElement || componentInfo.element.parentNode;

        return new Header(params);
    };

    //#endregion


    //#region [ Registration ]

    ko.components.register("my-header", {
        viewModel: { 
            createViewModel: Header.createViewModel 
        },
        template: 
            `<div class="my-header bolt-header-with-commandbar bolt-header-with-back-button bolt-header flex-row flex-noshrink flex-start bolt-header-no-spacing-defined">
                <button aria-label="Expand all" title="Expand all" class="my-header__button my-header__button--icon icon-only bolt-button bolt-icon-button enabled subtle icon-only bolt-focus-treatment" role="button" tabindex="1" type="button"
                        data-bind="click: () => callback('expand'), css: { disabled: queryType() === 'flat' }">
                    <span class="fluent-icons-enabled">
                        <span aria-hidden="true" class="left-icon flex-noshrink fabric-icon ms-Icon--Add medium"></span>
                    </span>
                </button>
                <button aria-label="Collapse all" title="Collapse all" class="my-header__button my-header__button--icon icon-only bolt-button bolt-icon-button enabled subtle icon-only bolt-focus-treatment" role="button" tabindex="2" type="button"
                        data-bind="click: () => callback('collapse'), css: { disabled: queryType() === 'flat' }">
                    <span class="fluent-icons-enabled">
                        <span aria-hidden="true" class="left-icon flex-noshrink fabric-icon ms-Icon--Remove medium"></span>
                    </span>
                </button>
                <button aria-haspopup="true" class="bolt-button bolt-expandable-button enabled bolt-focus-treatment" role="button" type="button"
                        style="margin-left: 8px"
                        data-bind="click: showFieldsPopup">
                    <span class="bolt-button-text body-m" style="pointer-events: none">Fields&nbsp;&hellip;</span>
                    <span class="fluent-icons-enabled" style="pointer-events: none">
                        <span aria-hidden="true" class="icon-right font-weight-normal flex-noshrink fabric-icon ms-Icon--ChevronDownMed small" style="pointer-events: none"></span>
                    </span>
                </button>
                <div class="my-header__fields-popup bolt-contextual-menu flex-column depth-8 bolt-callout-content bolt-callout-shadow"
                     data-bind="if: fieldsPopupTarget(), style: { top: fieldsPopupTop, left: fieldsPopupLeft }">
                    <!-- ko foreach: fields -->
                    <label>
                        <input type="checkbox" data-bind="checkedValue: value, checked: $parent.showFields" />
                        <span data-bind="text: name"></span>
                    </label>
                    <!-- /ko -->
                </div>
                <div class="bolt-header-content-area flex-row flex-grow flex-self-stretch">
                    <div class="bolt-header-icon m"
                         data-bind="visible: icon().length">
                        <span class="fluent-icons-enabled">
                            <span aria-hidden="true" class="flex-noshrink fabric-icon"
                                  data-bind="class: icon"></span>
                        </span>
                    </div>
                    <div class="bolt-header-title-area flex-column flex-grow scroll-hidden" style="flex-direction: row">
                        <div class="my-header__filter flex-column bolt-textfield-default-width">
                            <div class="bolt-textfield flex-row flex-center focus-treatment bolt-textfield-inline">
                                <span class="fluent-icons-enabled">
                                    <span aria-hidden="true" class="prefix bolt-textfield-icon bolt-textfield-no-text flex-noshrink fabric-icon ms-Icon--Search medium"></span>
                                </span>
                                <input autocomplete="off" aria-label="Search items" class="bolt-textfield-input flex-grow bolt-textfield-input-with-prefix" placeholder="Search items" tabindex="0"
                                       data-bind="textInput: filter,
                                                  event: { focus: (vm, e) => e.target.select() }" />
                            </div>
                        </div>
                    </div>
                    <div class="flex-self-start bolt-header-commandbar bolt-button-group flex-row" role="menubar">
                        <div class="flex-self-start bolt-header-commandbar-button-group flex-row flex-center flex-grow scroll-hidden rhythm-horizontal-8">
                            <button aria-label="Refresh data" title="Refresh data" class="my-header__button my-header__button--icon icon-only bolt-button bolt-icon-button enabled subtle icon-only bolt-focus-treatment" role="button" tabindex="9" type="button"
                                    style="margin-left: 8px"
                                    data-bind="click: () => callback('refresh')">
                                <span class="fluent-icons-enabled">
                                    <span aria-hidden="true" class="left-icon flex-noshrink fabric-icon ms-Icon--Refresh medium"></span>
                                </span>
                            </button>
                            <button aria-label="Zoom out" title="Zoom out" class="my-header__button my-header__button--icon icon-only bolt-button bolt-icon-button enabled subtle icon-only bolt-focus-treatment" role="button" tabindex="11" type="button"
                                    data-bind="click: () => callback('zoomOut')">
                                <span class="fluent-icons-enabled">
                                    <span aria-hidden="true" class="left-icon flex-noshrink fabric-icon ms-Icon--CircleMinus medium"></span>
                                </span>
                            </button>
                            <button aria-label="Reset zoom" title="Reset zoom" class="my-header__button my-header__button--icon icon-only bolt-button bolt-icon-button enabled subtle icon-only bolt-focus-treatment" role="button" tabindex="12" type="button"
                                    data-bind="click: () => callback('zoomReset')">
                                <span class="fluent-icons-enabled">
                                    <span aria-hidden="true" class="left-icon flex-noshrink fabric-icon ms-Icon--CircleDisc medium"></span>
                                </span>
                            </button>
                            <button aria-label="Zoom in" title="Zoom in" class="my-header__button my-header__button--icon icon-only bolt-button bolt-icon-button enabled subtle icon-only bolt-focus-treatment" role="button" tabindex="10" type="button"
                                    data-bind="click: () => callback('zoomIn')">
                                <span class="fluent-icons-enabled">
                                    <span aria-hidden="true" class="left-icon flex-noshrink fabric-icon ms-Icon--CirclePlus medium"></span>
                                </span>
                            </button>                            
                            <button aria-label="Move left" title="Move left" class="my-header__button my-header__button--icon icon-only bolt-button bolt-icon-button enabled subtle icon-only bolt-focus-treatment" role="button" tabindex="13" type="button"
                                    data-bind="click: () => callback('moveLeft')">
                                <span class="fluent-icons-enabled">
                                    <span aria-hidden="true" class="left-icon flex-noshrink fabric-icon ms-Icon--ChevronLeft medium"></span>
                                </span>
                            </button>
                            <button aria-label="Move right" title="Move right" class="my-header__button my-header__button--icon icon-only bolt-button bolt-icon-button enabled subtle icon-only bolt-focus-treatment" role="button" tabindex="14" type="button"
                                    data-bind="click: () => callback('moveRight')">
                                <span class="fluent-icons-enabled">
                                    <span aria-hidden="true" class="left-icon flex-noshrink fabric-icon ms-Icon--ChevronRight medium"></span>
                                </span>
                            </button>
                            <button aria-roledescription="button" class="bolt-header-command-item-button bolt-button bolt-icon-button enabled bolt-focus-treatment" role="menuitem" tabindex="15" type="button"
                                    title="Downloads the Gantt chart"
                                    data-bind="click: () => callback('download')">
                                <span class="fluent-icons-enabled">
                                    <span aria-hidden="true" class="left-icon flex-noshrink fabric-icon ms-Icon--Download medium"></span>
                                </span>
                                <span class="bolt-button-text body-m">XLSX</span>
                            </button>
                            <button aria-roledescription="button" class="bolt-header-command-item-button bolt-button bolt-icon-button enabled bolt-focus-treatment" role="menuitem" tabindex="15" type="button"
                                    title="Downloads the Gantt chart as an image"
                                    data-bind="click: () => callback('downloadImage')">
                                <span class="fluent-icons-enabled">
                                    <span aria-hidden="true" class="left-icon flex-noshrink fabric-icon ms-Icon--Download medium"></span>
                                </span>
                                <span class="bolt-button-text body-m">PNG</span>
                            </button>
                            <a aria-roledescription="button" class="bolt-header-command-item-button bolt-button bolt-icon-button enabled bolt-focus-treatment" role="menuitem" tabindex="16"
                                    title="Shares the Gantt chart using default email client" target="_blank"
                                    style="text-decoration: none"
                                    data-bind="attr: { href: shareLink }">
                                <span class="fluent-icons-enabled">
                                    <span aria-hidden="true" class="left-icon flex-noshrink fabric-icon ms-Icon--Share medium"></span>
                                </span>
                                <span class="bolt-button-text body-m">Share</span>
                            </a>                               
                        </div>
                    </div>
                </div>
            </div>`
    });

    //#endregion
});