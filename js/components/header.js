define([
    "knockout"
], function (ko) {
    //#region [ Constructors ]
    
    /**
     * Constructor.
     * 
     * @param {object} args Arguments.
     */
    let Header = function (args = {}) {
        console.debug("Header()");

        this.title = ko.isObservable(args.title) ? args.title : ko.observable(args.title || "");
        this.icon = ko.isObservable(args.icon) ? args.icon : ko.observable(args.icon || "");
        this.selectedItem = ko.isObservable(args.selectedItem) ? args.selectedItem : ko.observable(args.selectedItem || null);
        this.showTags = ko.isObservable(args.showTags) ? args.showTags : ko.observable(args.showTags || false);
        this.showDates = ko.isObservable(args.showDates) ? args.showDates : ko.observable(args.showDates || false);
        this.showAssignedTo = ko.isObservable(args.showAssignedTo) ? args.showAssignedTo : ko.observable(args.showAssignedTo || false);
        this.filter = ko.isObservable(args.filter) ? args.filter : ko.observable(args.filter || "");
        this.queryType = ko.isObservable(args.queryType) ? args.queryType : ko.observable(args.queryType || "");
        this.shareLink = ko.isObservable(args.shareLink) ? args.shareLink : ko.observable(args.shareLink || "");

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
                <button class="my-header__button my-header__button--icon my-header__button--toggle icon-only bolt-button bolt-icon-button enabled subtle icon-only bolt-focus-treatment" role="button" tabindex="3" type="button"
                        data-bind="attr: { title: showAssignedTo() ? 'Hide assigned to' : 'Show assigned to'},
                                   css: { 'my-header__button--toggle-on': showAssignedTo() },
                                   click: () => showAssignedTo(!showAssignedTo())">
                    <span class="fluent-icons-enabled">
                        <span aria-hidden="true" class="left-icon flex-noshrink fabric-icon ms-Icon--People medium"></span>
                    </span>
                </button>                             
                <button class="my-header__button my-header__button--icon my-header__button--toggle icon-only bolt-button bolt-icon-button enabled subtle icon-only bolt-focus-treatment" role="button" tabindex="4" type="button"
                        data-bind="attr: { title: showDates() ? 'Hide dates' : 'Show dates'},
                                   css: { 'my-header__button--toggle-on': showDates() },
                                   click: () => showDates(!showDates())">
                    <span class="fluent-icons-enabled">
                        <span aria-hidden="true" class="left-icon flex-noshrink fabric-icon ms-Icon--Calendar medium"></span>
                    </span>
                </button>                             
                <button class="my-header__button my-header__button--icon my-header__button--toggle icon-only bolt-button bolt-icon-button enabled subtle icon-only bolt-focus-treatment" role="button" tabindex="5" type="button"
                        data-bind="attr: { title: showTags() ? 'Hide tags' : 'Show tags'},
                                   css: { 'my-header__button--toggle-on': showTags() },
                                   click: () => showTags(!showTags())">
                    <span class="fluent-icons-enabled">
                        <span aria-hidden="true" class="left-icon flex-noshrink fabric-icon ms-Icon--Tag medium"></span>
                    </span>
                </button>
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
                                                  placeholder: [
                                                    'Search items',
                                                    'text: lorem // which title contains lorem',
                                                    'text: -(lorem) // which title does not contain lorem',
                                                    'state:todo // which state is set to To Do',
                                                    'state:todo AND tag:customer // with multiple conditions'
                                                  ],
                                                  event: { focus: (vm, e) => e.target.select() }" />
                            </div>
                        </div>
                    </div>
                    <div class="flex-self-start bolt-header-commandbar bolt-button-group flex-row" role="menubar">
                        <div class="flex-self-start bolt-header-commandbar-button-group flex-row flex-center flex-grow scroll-hidden rhythm-horizontal-8">
                            <button aria-label="Refresh data" title="Refresh data" class="my-header__button my-header__button--icon icon-only bolt-button bolt-icon-button enabled subtle icon-only bolt-focus-treatment" role="button" tabindex="9" type="button"
                                    data-bind="click: () => callback('refresh')">
                                <span class="fluent-icons-enabled">
                                    <span aria-hidden="true" class="left-icon flex-noshrink fabric-icon ms-Icon--Refresh medium"></span>
                                </span>
                            </button>
                            <button aria-label="Zoom in" title="Zoom in" class="my-header__button my-header__button--icon icon-only bolt-button bolt-icon-button enabled subtle icon-only bolt-focus-treatment" role="button" tabindex="10" type="button"
                                    data-bind="click: () => callback('zoomIn')">
                                <span class="fluent-icons-enabled">
                                    <span aria-hidden="true" class="left-icon flex-noshrink fabric-icon ms-Icon--ZoomIn medium"></span>
                                </span>
                            </button>
                            <button aria-label="Zoom out" title="Zoom out" class="my-header__button my-header__button--icon icon-only bolt-button bolt-icon-button enabled subtle icon-only bolt-focus-treatment" role="button" tabindex="11" type="button"
                                    data-bind="click: () => callback('zoomOut')">
                                <span class="fluent-icons-enabled">
                                    <span aria-hidden="true" class="left-icon flex-noshrink fabric-icon ms-Icon--ZoomOut medium"></span>
                                </span>
                            </button>
                            <button aria-label="Reset zoom" title="Reset zoom" class="my-header__button my-header__button--icon icon-only bolt-button bolt-icon-button enabled subtle icon-only bolt-focus-treatment" role="button" tabindex="12" type="button"
                                    data-bind="click: () => callback('zoomReset')">
                                <span class="fluent-icons-enabled">
                                    <span aria-hidden="true" class="left-icon flex-noshrink fabric-icon ms-Icon--BackToWindow medium"></span>
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