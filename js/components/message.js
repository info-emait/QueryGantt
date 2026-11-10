define([
    "knockout",
    "services/hierarchy-diagnostics"
], function (ko, diagnostics) {
    //#region [ Constructors ]
    
    /**
     * Constructor.
     * 
     * @param {object} args Arguments.
     */
    let Message = function (args = {}) {
        console.debug("Message()");

        this.text = ko.isObservable(args.text) ? args.text : ko.observable(args.text || "");
        this.diagnostics = diagnostics.create(this.text, args.context);
        this.action = this.diagnostics.action;
        this.busy = this.diagnostics.busy;
        this.analysis = this.diagnostics.analysis;
        this.label = this.diagnostics.label;
    };

    //#endregion


    //#region [ Methods : Public ]

    Message.prototype.runAction = function () {
        const action = this.action();
        if (typeof(action) === "function" && !this.busy()) {
            return action();
        }
    };

    /**
     * Direct method to receive a descendantsComplete notification.
     * Knockout will call it with the component’s node once all descendants are bound.
     * 
     * @param {element} node Html element. 
     */
    Message.prototype.koDescendantsComplete = function (node) {
        let root = node.firstElementChild;
        node.replaceWith(root);
    };


    /**
     * Dispose.
     */
    Message.prototype.dispose = function () {
        this.diagnostics.dispose();
        console.log("~Message()");
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
    Message.createViewModel = function (params, componentInfo) {
        params = params || {};
        params.element = componentInfo.element.querySelector ? componentInfo.element : componentInfo.element.parentElement || componentInfo.element.parentNode;

        return new Message(params);
    };

    //#endregion


    //#region [ Registration ]

    ko.components.register("my-message", {
        viewModel: { 
            createViewModel: Message.createViewModel 
        },
        template: 
            `<div class="flex-row margin-top-16" style="display: none" data-bind="visible: text().length">
                <div class="flex-self-stretch bolt-messagecard bolt-card flex-column depth-8 bolt-card-white"
                        style="width: 100%">
                    <div class="bolt-messagebar severity-error">
                        <div class="bolt-breakpoint relative">
                            <div class="bolt-breakpoint-container absolute-fill scroll-hidden">
                                <div class="bolt-breakpoint-observation absolute"></div>
                            </div>
                        </div>
                        <div class="bolt-messagebar-content flex-grow flex-row">
                            <div class="flex-row">
                                <div class="bolt-messagebar-icons flex-row">
                                    <span class="fluent-icons-enabled">
                                        <span aria-hidden="true" class="bolt-messagebar-icon medium flex-noshrink fabric-icon ms-Icon--Error"></span>
                                    </span>
                                </div>
                                <div class="bolt-messagebar-message flex-row flex-wrap flex-grow flex-shrink flex-center body-m word-break" data-bind="text: text"></div>
                            </div>
                            <div class="bolt-messagebar-buttons flex-noshrink flex-row flex-center flex-self-stretch">
                                <button class="bolt-button enabled bolt-focus-treatment" type="button"
                                        data-bind="visible: action, click: runAction, disable: busy, text: label(busy() ? 'analyzing' : 'analyze')"></button>
                                <button class="bolt-messagebar-close-button bolt-button bolt-icon-button enabled subtle icon-only bolt-focus-treatment" role="button" tabindex="0" type="button"
                                        data-bind="click: () => text(''), attr: { title: label('dismiss'), 'aria-label': label('dismiss') }">
                                    <span class="fluent-icons-enabled">
                                        <span aria-hidden="true" class="left-icon flex-noshrink fabric-icon ms-Icon--Cancel medium"></span>
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="querygantt-tab__analysis" data-bind="with: analysis">
                        <p role="status" data-bind="text: summary"></p>
                        <ul data-bind="foreach: findings">
                            <li>
                                <span data-bind="text: text"></span>
                                <a target="_blank" rel="noopener noreferrer" data-bind="attr: { href: childUrl }, text: $component.label('openItem', { id: child })"></a>
                                <a target="_blank" rel="noopener noreferrer" data-bind="attr: { href: parentUrl }, text: $component.label('openItem', { id: parent })"></a>
                            </li>
                        </ul>
                        <ul data-bind="foreach: warnings"><li data-bind="text: $data"></li></ul>
                        <details data-bind="visible: traces.length">
                            <summary data-bind="text: $component.label('checkedChains')"></summary>
                            <ul data-bind="foreach: traces">
                                <li>
                                    <span data-bind="text: text"></span>
                                    <div data-bind="foreach: items">
                                        <a target="_blank" rel="noopener noreferrer" data-bind="attr: { href: url }, text: text"></a>
                                        <span data-bind="visible: $index() < $parent.items.length - 1"> → </span>
                                    </div>
                                </li>
                            </ul>
                        </details>
                    </div>
                </div>
            </div>`
    });

    //#endregion
});
