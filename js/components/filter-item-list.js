define([
    "knockout"
], (ko) => {
    //#region [ Constructors ]
    
    /**
     * Constructor.
     * 
     * @param {object} args Arguments.
     */
    const Model = function (args = {}) {
        this.id = ko.isObservable(args.id) ? args.id : ko.observable(args.id || "");
        this.label = ko.isObservable(args.label) ? args.id : ko.observable(args.label || "");
        this.popupId = ko.isObservable(args.popupId) ? args.popupId : ko.observable(args.popupId || "");
        this.open = typeof(args.open) === "function" ? args.open : function() {};
        this.values = ko.isObservable(args.values) ? args.values : ko.observableArray(args.values || []);
        this.empty = ko.isObservable(args.empty) ? args.empty : ko.observable(args.empty || "");
    };

    //#endregion


    //#region [ Methods : Public ]

    /**
     * Formats the input object.
     * 
     * @param {object} o Object to format.
     */
    Model.prototype.formatValue = function (o) {
        if ((o.length === 2) && ((o[0] instanceof Date) || (o[1] instanceof Date))) {
            const r = [];
            if(o[0] instanceof Date) {
                r.push(`From: ${o[0].toISOString().split("T")[0]}`);
            }
            if(o[1] instanceof Date) {
                r.push(`To: ${o[1].toISOString().split("T")[0]}`);
            }
            return r.join(", ");
        }

        return (o.length === 1) ? (o[0] || this.empty()) : (o[0] || this.empty()) + ' (+' + (o.length - 1) + ')';
    };


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
        `<div class="vss-FilterBar--item">
            <div class="bolt-dropdown-filter-bar-item bolt-expandable-button inline-flex-row">
                <button class="bolt-button enabled subtle bolt-focus-treatment" role="button" tabindex="0" type="button"
                        data-bind="attr: { 'data-popup-id': id },
                                   click: open, 
                                   css: { 'active': popupId() === id() }">
                    <div class="bolt-dropdown-expandable-button-label justify-start flex-grow text-ellipsis" style="pointer-events: none">
                            <!-- ko if: !values().filter((v) => v !== null).length -->
                            <span data-bind="text: label"></span>
                            <!-- /ko -->
                            <!-- ko if: values().filter((v) => v !== null).length -->
                            <span class="bolt-dropdown-filter-bar-item-selected-text" data-bind="text: formatValue(values())"></span>
                            <!-- /ko -->
                    </div>
                    <span class="fluent-icons-enabled" style="pointer-events: none">
                        <span aria-hidden="true" class="icon-right font-weight-normal flex-noshrink fabric-icon ms-Icon--ChevronDownMed small" style="pointer-events: none"></span>
                    </span>
                </button>
            </div>
        </div>`;

    //#endregion


    //#region [ Registration ]

    ko.components.register("my-filter-item-list", {
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