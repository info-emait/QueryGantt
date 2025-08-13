define([
    "knockout"
], function (ko) {
    //#region [ Constructors ]
    
    /**
     * Constructor.
     * 
     * @param {object} args Arguments.
     */
    let Legend = function (args = {}) {
        console.debug("Legend()");

        this.classes = ko.isObservable(args.classes) ? args.classes : ko.observable(args.classes || "");
        this.title = ko.isObservable(args.title) ? args.title : ko.observable(args.title || "");
        this.items = ko.isObservable(args.items) ? args.items : ko.observable(args.items || []);
        this.isVisible = ko.isObservable(args.isVisible) ? args.isVisible : ko.observable(typeof(args.isVisible) === "boolean" ? args.isVisible : true);
        this.total = ko.observable(null);
        this.format = args.format || ((val) => `${val}`);
        this.reduce = args.reduce;

        this.getTotal = ko.computed(this._getTotal, this);
    };

    //#endregion


    //#region [ Methods : Public ]

    /**
     * Direct method to receive a descendantsComplete notification.
     * Knockout will call it with the component’s node once all descendants are bound.
     * 
     * @param {element} node Html element. 
     */
    Legend.prototype.koDescendantsComplete = function (node) {
        let root = node.firstElementChild;
        node.replaceWith(root);
    };


    /**
     * Dispose.
     */
    Legend.prototype.dispose = function () {
        console.log("~Legend()");

        this.getTotal.dispose();
    };

    //#endregion


    //#region [ Methods : Private ]

    /**
     * Gets the total info for the curren items.
     */
    Legend.prototype._getTotal = function() {
        const items = this.items();

        if ((!items.length) || (typeof(this.reduce) !== "function")) {
            this.total(null);
            return;
        }

        this.total(items.reduce(this.reduce, 0));
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
    Legend.createViewModel = function (params, componentInfo) {
        params = params || {};
        params.element = componentInfo.element.querySelector ? componentInfo.element : componentInfo.element.parentElement || componentInfo.element.parentNode;

        return new Legend(params);
    };

    //#endregion


    //#region [ Registration ]

    ko.components.register("my-legend", {
        viewModel: { 
            createViewModel: Legend.createViewModel 
        },
        template: 
            `<div class="my-legend" style="display: none" data-bind="class: classes, visible: isVisible">
                <b data-bind="text: title"></b>
                <!-- ko if: typeof(reduce) === "function" -->
                    <div class="my-legend__item">
                        <span data-bind="text: format(total())"></span>
                    </div>
                <!-- /ko -->
                <!-- ko ifnot: typeof(reduce) === "function" -->
                    <!-- ko foreach: items -->
                    <div class="my-legend__item" data-bind="attr: { title: name }">
                        <i data-bind="style: { background: '#' + color }"></i>
                        <span data-bind="text: name.split(', ')[0]"></span>
                    </div>
                    <!-- /ko -->
                <!-- /ko -->
            </div>`
    });

    //#endregion
});