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
        // Replace custom element placehoder
        let root = node.firstElementChild;
        node.replaceWith(root);
    };


    /**
     * Dispose.
     */
    Legend.prototype.dispose = function () {
        console.log("~Legend()");
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
            `<div class="my-legend" data-bind="class: classes">
                <b data-bind="text: title"></b>
                <!-- ko foreach: items -->
                <div class="my-legend__item" data-bind="attr: { title: name }">
                    <i data-bind="style: { background: '#' + color }"></i>
                    <span data-bind="text: name.split(', ')[0]"></span>
                </div>
                <!-- /ko -->
            </div>`
    });

    //#endregion
});