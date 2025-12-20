define([
    "knockout",
    "my/components/filter-item-list",
    "my/components/filter-popup-list",
    "my/components/filter-popup-date",
    "my/components/filter-popup-single-date"
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
    let Filter = function (args = {}) {
        console.debug("Filter()");

        this.element = args.element.firstElementChild;
        this.value = ko.isObservable(args.value) ? args.value : ko.observable(args.value || {});
        this.valuePrimary = ko.isObservable(args.valuePrimary) ? args.valuePrimary : ko.observable(args.valuePrimary || {});
        this.queryType = ko.isObservable(args.queryType) ? args.queryType : ko.observable(args.queryType || "");
        
        this.isAsOfEnabled = ko.computed(() => this.queryType() !== "tree");

        this.assignees = ko.isObservable(args.assignees) ? args.assignees : ko.observableArray(args.assignees || []);
        this.states = ko.isObservable(args.states) ? args.states : ko.observableArray(args.states || []);
        this.priorities = ko.isObservable(args.priorities) ? args.priorities : ko.observableArray(args.priorities || []);
        this.tags = ko.isObservable(args.tags) ? args.tags : ko.observableArray(args.tags || []);
        this.areas = ko.isObservable(args.areas) ? args.areas : ko.observableArray(args.areas || []);
        this.parents = ko.isObservable(args.parents) ? args.parents : ko.observableArray(args.parents || []);
        
        this.keywords = ko.observable("").extend({ rateLimit: { timeout: 500, method: "notifyWhenChangesStop" } });
        this.assigneesValue = ko.observableArray([]);
        this.statesValue = ko.observableArray([]);
        this.prioritiesValue = ko.observableArray([]);
        this.tagsValue = ko.observableArray([]);
        this.areasValue = ko.observableArray([]);
        this.parentsValue = ko.observableArray([]);
        this.periodValue = ko.observableArray([]);

        this.getValue = ko.computed(this._getValue, this);

        this.asOfValue = ko.observableArray([]);

        this.getValuePrimary = ko.computed(this._getValuePrimary, this);

        this.popupId = ko.observable(null);
        this.popupTop = ko.observable("-9999px");
        this.popupLeft = ko.observable("-9999px");
    };

    //#endregion


    //#region [ Methods : Public ]

    /**
     * Shows or hide popup.
     * 
     * @param {object} component Component instance.
     * @param {object} e Event arguments.
     */
    Filter.prototype.popup = function (component, e = {}) {
        const lastPopupId = this.popupId(); 
        if (this.popupId() != null) {
            this.popupId(null);
            this.popupTop("-9999px");
            this.popupLeft("-9999px");
        }

        const target = e.target;
        if (!target || typeof(target.getAttribute) !== "function") {
            return;
        }

        const popupId = target.getAttribute("data-popup-id") || "";
        const popup = doc.getElementById(popupId);
        if (!popupId.length || !popup) {
            return;
        }

        if (popupId === lastPopupId) {
            return;
        }

        this.popupId(popupId);

        setTimeout(() => {
            let top = Math.floor(target.getBoundingClientRect().top + doc.body.scrollTop)
                - Math.floor(this.element.getBoundingClientRect().top + doc.body.scrollTop)
                + Math.floor(target.getBoundingClientRect().height);
            let left = Math.floor(target.getBoundingClientRect().left + doc.body.scrollLeft)
                - Math.floor(this.element.getBoundingClientRect().left + doc.body.scrollLeft)
                + Math.floor(target.getBoundingClientRect().width)
                - Math.floor(popup.getBoundingClientRect().width);

            this.popupTop(top + "px");
            this.popupLeft(left + "px");
        }, 1);
    };


    /**
     * Direct method to receive a descendantsComplete notification.
     * Knockout will call it with the component’s node once all descendants are bound.
     * 
     * @param {element} node Html element. 
     */
    Filter.prototype.koDescendantsComplete = function (node) {
        let root = node.firstElementChild;
        node.replaceWith(root);
    };


    /**
     * Dispose.
     */
    Filter.prototype.dispose = function () {
        console.log("~Filter()");

        this.getValue.dispose();
        this.getValuePrimary.dispose();
        this.isAsOfEnabled.dispose();
    };

    //#endregion


    //#region [ Methods : Private ]

    /**
     * Gets actual primary filter value.
     */
    Filter.prototype._getValuePrimary = function() {
        const asOf = this.asOfValue();
        
        const val = {};

        if (asOf.length) {
            val.asOf = asOf;
        }
        
        this.valuePrimary(val);
    };


    /**
     * Gets actual filter value.
     */
    Filter.prototype._getValue = function() {
        const keywords = (this.keywords() || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
        const states = this.statesValue();
        const priorities = this.prioritiesValue();
        const tags = this.tagsValue();
        const areas = this.areasValue();
        const assignees = this.assigneesValue();
        const parents = this.parentsValue();
        const period = this.periodValue();

        const val = {};

        if (keywords.length) {
            val.keywords = keywords;
        }

        if (states.length) {
            val.states = states;
        }
        
        if (priorities.length) {
            val.priorities = priorities.map((p) => parseInt(p.split(" - ").shift()));
        }

        if (tags.length) {
            val.tags = tags;
        }

        if (areas.length) {
            val.areas = areas;
        }

        if (assignees.length) {
            val.assignees = assignees;
        }

        if (parents.length) {
            val.parents = parents;
        }

        if (period.length) {
            val.period = {
                from: period[0],
                to: period[1]
            };
        }

        this.value(val);
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
    Filter.createViewModel = function (params, componentInfo) {
        params = params || {};
        params.element = componentInfo.element.querySelector ? componentInfo.element : componentInfo.element.parentElement || componentInfo.element.parentNode;

        return new Filter(params);
    };

    //#endregion


    //#region [ Registration ]

    ko.components.register("my-filter", {
        viewModel: { 
            createViewModel: Filter.createViewModel 
        },
        template: 
            `<div class="vss-FilterBar bolt-filterbar bolt-filterbar-white depth-8 full-size" role="toolbar">
                <div class="vss-FilterBar--list">
                    <div class="vss-FilterBar--item vss-FilterBar--item-keyword-container">
                        <div class="flex-column flex-grow">
                            <div class="bolt-text-filterbaritem flex-grow bolt-textfield flex-row flex-center focus-keyboard-only">
                                <span class="fluent-icons-enabled">
                                    <span class="keyword-filter-icon prefix bolt-textfield-icon bolt-textfield-no-text flex-noshrink fabric-icon ms-Icon--Filter medium"></span>
                                </span>
                                <input type="text" autocomplete="off" class="bolt-text-filterbaritem-input bolt-textfield-input flex-grow bolt-textfield-input-with-prefix" maxlength="200" placeholder="Filter by keywords" role="searchbox" tabindex="0"
                                    data-bind="textInput: keywords, event: { focus: (vm, e) => e.target.select() }" />
                            </div>
                        </div>
                    </div>
                    <my-filter-item-list params="id: 'asof-popup', label: 'As of', popupId: popupId, open: popup.bind($component), values: asOfValue, isEnabled: isAsOfEnabled"></my-filter-item-list>
                    <my-filter-item-list params="id: 'period-popup', label: 'Period', popupId: popupId, open: popup.bind($component), values: periodValue"></my-filter-item-list>
                    <my-filter-item-list params="id: 'assignees-popup', label: 'Assigned To', popupId: popupId, open: popup.bind($component), values: assigneesValue"></my-filter-item-list>
                    <my-filter-item-list params="id: 'states-popup', label: 'States', popupId: popupId, open: popup.bind($component), values: statesValue"></my-filter-item-list>
                    <my-filter-item-list params="id: 'priorities-popup', label: 'Priorities', popupId: popupId, open: popup.bind($component), values: prioritiesValue"></my-filter-item-list>
                    <my-filter-item-list params="id: 'tags-popup', label: 'Tags', popupId: popupId, open: popup.bind($component), values: tagsValue"></my-filter-item-list>
                    <my-filter-item-list params="id: 'areas-popup', label: 'Areas', popupId: popupId, open: popup.bind($component), values: areasValue"></my-filter-item-list>
                    <my-filter-item-list params="id: 'parents-popup', label: 'Parents', popupId: popupId, open: popup.bind($component), values: parentsValue, empty: '@Without parent'"></my-filter-item-list>
                    <div class="vss-FilterBar--right-items">
                        <div class="vss-FilterBar--action vss-FilterBar--action-clear">
                            <button class="filter-bar-button bolt-button bolt-icon-button enabled subtle icon-only bolt-focus-treatment" role="button" tabindex="-1" type="button"
                                    data-bind="click: () => { popup(); keywords(''); assigneesValue([]); statesValue([]); prioritiesValue([]); tagsValue([]); areasValue([]); parentsValue([]); periodValue([]); asOfValue([]); }">
                                <span class="fluent-icons-enabled">
                                    <span aria-hidden="true" class="left-icon flex-noshrink fabric-icon ms-Icon--Cancel medium"></span>
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
                <my-filter-popup-single-date params="id: 'asof-popup', popupId: popupId, top: popupTop, left: popupLeft, values: asOfValue"></my-filter-popup-single-date>
                <my-filter-popup-date params="id: 'period-popup', popupId: popupId, top: popupTop, left: popupLeft, values: periodValue"></my-filter-popup-date>
                <my-filter-popup-list params="id: 'assignees-popup', popupId: popupId, top: popupTop, left: popupLeft, items: assignees, values: assigneesValue, zeroText: 'There are not any work items that would be assigned to the user'"></my-filter-popup-list>
                <my-filter-popup-list params="id: 'states-popup', popupId: popupId, top: popupTop, left: popupLeft, items: states, values: statesValue"></my-filter-popup-list>
                <my-filter-popup-list params="id: 'priorities-popup', popupId: popupId, top: popupTop, left: popupLeft, items: priorities, values: prioritiesValue"></my-filter-popup-list>
                <my-filter-popup-list params="id: 'tags-popup', popupId: popupId, top: popupTop, left: popupLeft, items: tags, values: tagsValue, zeroText: 'There are not any work items that would be tagged'"></my-filter-popup-list>
                <my-filter-popup-list params="id: 'areas-popup', popupId: popupId, top: popupTop, left: popupLeft, items: areas, values: areasValue"></my-filter-popup-list>
                <my-filter-popup-list params="id: 'parents-popup', popupId: popupId, top: popupTop, left: popupLeft, items: parents, values: parentsValue, empty: '@Without parent'"></my-filter-popup-list>
            </div>`
    });

    //#endregion
});