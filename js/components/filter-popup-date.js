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
        this.popupId = ko.isObservable(args.popupId) ? args.popupId : ko.observable(args.popupId || "");
        this.top = ko.isObservable(args.top) ? args.top : ko.observable(args.top || "-9999px");
        this.left = ko.isObservable(args.left) ? args.left : ko.observable(args.left || "-9999px");
        this.values = ko.isObservable(args.values) ? args.values : ko.observableArray(args.values || []);

        this.from = ko.observable("");
        this.to = ko.observable("");

        this.setValues = ko.computed(this._setValues, this);
        this.valuesChanged = this.values.subscribe(this._valuesChanged.bind(this));
    };

    //#endregion


    //#region [ Methods : Public ]

    /**
     * Gets the current month.
     */
    Model.prototype.setMonth = function (start = 0, end = 1) {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();
    
        const firstDay = new Date(year, month + start, 1);
        const lastDay = new Date(year, month + end, 0);

        const format = (date) => {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, "0");
            const d = String(date.getDate()).padStart(2, "0");
            return `${y}-${m}-${d}`;
        };
    
        this.from(format(firstDay));
        this.to(format(lastDay));
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
        this.setValues.dispose();
        this.valuesChanged.dispose();
    };

    //#endregion


    //#region [ Methods : Private ]

    /**
     * Event handler for the values changed event.
     * 
     * @param {object} val Current value.
     */
    Model.prototype._valuesChanged = function(val) {
        if (!val.filter((v) => v !== null).length) {
            this.from("");
            this.to("");
        }
    };


    /**
     * Gets and sets the current value.
     */
    Model.prototype._setValues = function() {
        const from  = this.from();
        const to = this.to();

        const [fromYear, fromMonth, fromDay] = (from || "").split("-").map(Number);
        const fromDate = new Date(Date.UTC(fromYear, fromMonth - 1, fromDay));

        const [toYear, toMonth, toDay] = (to || "").split("-").map(Number);
        const toDate = new Date(Date.UTC(toYear, toMonth - 1, toDay));
        
        if (this.valuesChanged) {
            this.valuesChanged.dispose();
        }
        this.values([
            (fromDate + "") !== "Invalid Date" ? fromDate : null, 
            (toDate + "") !== "Invalid Date" ? toDate : null
        ]);
        this.valuesChanged = this.values.subscribe(this._valuesChanged.bind(this));
    };

    //#endregion

    
    //#region [ Template ]

    Model.template =
        `<div id="created-popup" class="bolt-callout absolute flex-row" role="presentation" tabindex="-1" style="display: none"
              data-bind="attr: { 'id': id },
                         if: popupId() === id(),
                         visible: popupId() === id(),
                         style: { top: top, left: left }">
            <div class="bolt-dropdown flex-column custom-scrollbar v-scroll-auto h-scroll-hidden bolt-callout-content bolt-callout-shadow bolt-callout-auto" role="presentation">
                <div class="bolt-dropdown-container no-outline" style="width: 180px">
                    <div class="bolt-dropdown-list-box-container bolt-table-container flex-column flex-grow v-scroll-auto">
                        <div class="flex-row margin-left-8 margin-right-8">
                            <div class="flex-column flex-grow">
                                <label class="bolt-formitem-label body-m">From:</label>
                                <div class="flex-column">
                                    <div class="bolt-textfield flex-row flex-center focus-treatment">
                                        <input autocomplete="off" class="bolt-textfield-input flex-grow" type="date" tabindex="1" data-bind="value: from" />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="flex-row margin-left-8 margin-right-8 margin-top-8">
                            <div class="flex-column flex-grow">
                                <label class="bolt-formitem-label body-m">To:</label>
                                <div class="flex-column">
                                    <div class="bolt-textfield flex-row flex-center focus-treatment">
                                        <input autocomplete="off" class="bolt-textfield-input flex-grow" type="date" tabindex="1" data-bind="value: to" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="bolt-actions-container flex-column">
                        <button class="bolt-button bolt-focus-treatment full-width" role="button" tabindex="-1" type="button"
                                data-bind="click: setMonth.bind($component, 0, 1)">
                            <span class="bolt-button-text body-m">This Month</span>
                        </button>
                        <div class="margin-bottom-8"></div>
                        <button class="bolt-button bolt-focus-treatment full-width" role="button" tabindex="-1" type="button"
                                data-bind="click: setMonth.bind($component, -1, 0)">
                            <span class="bolt-button-text body-m">Previous Month</span>
                        </button>                            
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

    ko.components.register("my-filter-popup-date", {
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