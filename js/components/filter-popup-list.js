define([
    "knockout",
    "my/components/zerodata"
], (ko) => {
    //#region [ Constructors ]
    
    /**
     * Constructor.
     * 
     * @param {object} args Arguments.
     */
    const Model = function (args = {}) {
        this.id = ko.isObservable(args.id) ? args.id : ko.observable(args.id || "");
        this.popupId = ko.isObservable(args.popupId) ? args.popupId : ko.observable(args.popupId || "");
        this.top = ko.isObservable(args.top) ? args.top : ko.observable(args.top || "-9999px");
        this.left = ko.isObservable(args.left) ? args.left : ko.observable(args.left || "-9999px");
        this.items = ko.isObservable(args.items) ? args.items : ko.observableArray(args.items || []);
        this.values = ko.isObservable(args.values) ? args.values : ko.observableArray(args.values || []);
        this.empty = ko.isObservable(args.empty) ? args.empty : ko.observable(args.empty || "");
        this.zeroText = ko.isObservable(args.zeroText) ? args.zeroText : ko.observable(args.zeroText || "");
    };

    //#endregion


    //#region [ Methods : Public ]

    /**
     * Direct method to receive a descendantsComplete notification.
     * Knockout will call it with the component’s node once all descendants are bound.
     * 
     * @param {element} node Html element. 
     */
    Model.prototype.koDescendantsComplete = function (node) {
        const root = node.firstElementChild;
        node.replaceWith(root);
    };


    /**
     * Dispose.
     */
    Model.prototype.dispose = function () {
    };

    //#endregion

    
    //#region [ Template ]

    Model.template =
        `<div class="bolt-callout absolute flex-row" role="presentation" tabindex="-1" style="display: none"
              data-bind="attr: { 'id': id },
                         if: popupId() === id(),
                         visible: popupId() === id(),
                         style: { top: top, left: left }">
            <div class="bolt-dropdown flex-column custom-scrollbar v-scroll-auto h-scroll-hidden bolt-callout-content bolt-callout-shadow bolt-callout-auto" role="presentation">
                <div class="bolt-dropdown-container no-outline" style="width: 210px">
                    <div class="bolt-dropdown-list-box-container bolt-table-container flex-grow v-scroll-auto">
                        <!-- ko ifnot: items().length -->
                            <div class="margin-bottom-16">
                                <my-zero-data params="title: '', text: zeroText"></my-zero-data>
                            </div>
                        <!-- /ko -->
                        <!-- ko if: items().length -->
                        <div class="flex-column" data-bind="foreach: items">
                            <label class="bolt-filterbar__item bolt-filterbar__item--checkbox flex-row flex-start">
                                <input type="checkbox" data-bind="checkedValue: $data, checked: $component.values" />
                                <span data-bind="text: ($data === '') ? $component.empty() : $data"></span>
                            </label>
                        </div>
                        <!-- /ko -->
                    </div>
                    <div class="bolt-actions-container flex-column">
                        <button class="bolt-button bolt-icon-button subtle bolt-focus-treatment flex-self-end" role="button" tabindex="-1" type="button"
                                data-bind="click: () => values([])">
                            <span class="fluent-icons-enabled">
                                <span class="left-icon flex-noshrink fabric-icon ms-Icon--Clear medium"></span>
                            </span>
                            <span class="bolt-button-text body-m">Clear</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>`;

    //#endregion


    //#region [ Registration ]

    ko.components.register("my-filter-popup-list", {
        template: Model.template,
        viewModel: { 
            createViewModel: (params, componentInfo) => {
                params = params || {};
                params.element = componentInfo.element.querySelector ? componentInfo.element : componentInfo.element.parentElement || componentInfo.element.parentNode;
            
                return new Model(params);
            }
        }
    });

    //#endregion
});