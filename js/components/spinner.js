define([
    "knockout"
], function (ko) {
    //#region [ Constructors ]
    
    /**
     * Constructor.
     * 
     * @param {object} args Arguments.
     */
    let Spinner = function (args = {}) {
        console.debug("Spinner()");

        this.isVisible = ko.isObservable(args.isVisible) ? args.isVisible : ko.observable(args.isVisible || false);
    };

    //#endregion


    //#region [ Methods : Public ]

    /**
     * Direct method to receive a descendantsComplete notification.
     * Knockout will call it with the component’s node once all descendants are bound.
     * 
     * @param {element} node Html element. 
     */
    Spinner.prototype.koDescendantsComplete = function (node) {
        let root = node.firstElementChild;
        node.replaceWith(root);
    };


    /**
     * Dispose.
     */
    Spinner.prototype.dispose = function () {
        console.log("~Spinner()");
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
    Spinner.createViewModel = function (params, componentInfo) {
        params = params || {};
        params.element = componentInfo.element.querySelector ? componentInfo.element : componentInfo.element.parentElement || componentInfo.element.parentNode;

        return new Spinner(params);
    };

    //#endregion


    //#region [ Registration ]

    ko.components.register("my-spinner", {
        viewModel: { 
            createViewModel: Spinner.createViewModel 
        },
        template: 
            `<div class="querygantt-tab__spinner bolt-spinner flex-column text-center rhythm-vertical-8" style="display: none" data-bind="visible: isVisible">
                <div class="bolt-spinner-circle medium"></div>
                <div class="bolt-spinner-label">... loading</div>
            </div>`
    });

    //#endregion
});