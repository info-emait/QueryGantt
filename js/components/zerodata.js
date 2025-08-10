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
        console.debug("ZeroData()");

        this.title = ko.isObservable(args.title) ? args.title : ko.observable(args.title || "");
        this.text = ko.isObservable(args.text) ? args.text : ko.observable(args.text || "");
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
        console.log("~ZeroData()");
    };

    //#endregion

    
    //#region [ Template ]

    Model.template =
        `<div class="vss-ZeroData flex-row justify-center single">
            <div class="vss-ZeroDataItem flex-column flex-center">
                <svg class="vss-ZeroDataItem--image vss-ZeroDataItem--svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M2 21v-2h20v2zm1-3v-7h3v7zm5 0V6h3v12zm5 0V9h3v9zm5 0V3h3v15z"></path>
                </svg>
                <div class="vss-ZeroDataItem--primary margin-horizontal-16 title-l" data-bind="text: title"></div>
                <div class="vss-ZeroDataItem--secondary margin-horizontal-16">
                    <span data-bind="html: text"></span>
                </div>
                <!--
                <button class="vss-ZeroDataItem--action bolt-button enabled primary bolt-focus-treatment" role="button" tabindex="0" type="button">
                    <span class="bolt-button-text body-m">Button</span>
                </button>
                -->
            </div>
        </div>`;

    //#endregion


    //#region [ Registration ]

    ko.components.register("my-zero-data", {
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