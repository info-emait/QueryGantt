define([
    "knockout"
], function (ko) {
    //#region [ Constructors ]
    
    /**
     * Constructor.
     * 
     * @param {object} args Arguments.
     */
    let Count = function (args = {}) {
        console.debug("Count()");

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
    Count.prototype.koDescendantsComplete = function (node) {
        // Replace custom element placehoder
        let root = node.firstElementChild;
        node.replaceWith(root);
    };


    /**
     * Dispose.
     */
    Count.prototype.dispose = function () {
        console.log("~Count()");
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
    Count.createViewModel = function (params, componentInfo) {
        params = params || {};
        params.element = componentInfo.element.querySelector ? componentInfo.element : componentInfo.element.parentElement || componentInfo.element.parentNode;

        return new Count(params);
    };

    //#endregion


    //#region [ Registration ]

    ko.components.register("my-count", {
        viewModel: { 
            createViewModel: Count.createViewModel 
        },
        template: 
            `<div class="my-count">Showing <b data-bind="text: items().length"></b> work <span data-bind="text: items().length === 1 ? 'item' : 'items'"></span></div>`
    });

    //#endregion
});