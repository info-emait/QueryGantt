define([
    "knockout"
], function (ko) {
    //#region [ Fields ]

    let Handler = {};
    let domNode = null;
    let placeholders = [];
    let lastChar = null;
    let timeout = null;
    let lastCharTimeout = null;
    let placeholdersIdx = 0;
    let charIndex = 0;
    let blinkCounter = 0;

    //#endregion


    //#region [ Method : Public ]

    /**
     * This will be called when the binding is first applied to an element.
     * 
     * @param {object} element The DOM element involved in this binding.
     * @param {function} valueAccessor A JavaScript function that you can call to get the current model property that is involved in this binding.
     * @param {object} allBindings A JavaScript object that you can use to access all the model values bound to this DOM element.
     * @param {object} viewModel This parameter is deprecated in Knockout 3.x. Use bindingContext.$data or bindingContext.$rawData to access the view model instead.
     * @param {object} albindingContext An object that holds the binding context available to this element’s bindings.
     */
    Handler.init = function (element, valueAccessor, allBindings, viewModel, bindingContext) {
        domNode = element;
        let text = ko.unwrap(valueAccessor());
        
        if (Array.isArray(text)) {
            placeholders = text.filter((t) => (t || "").length);
        }
        else if (typeof (text) === "string") {
            placeholders.push(text);
        }

        // Grab some more data from another binding property
        lastChar = allBindings.get("placeholderLastChar") || "|";

        // Clear placeholder
        domNode.setAttribute("placeholder", "");

        // Stop typing in focues and restart on focus out
        domNode.addEventListener("focus", _domNode_onFocus);
        domNode.addEventListener("blur", _domNode_onBlur);

        // Start typing
        timeout = setTimeout(_typeIn, 1000);

        // Dispose anything
        ko.utils.domNodeDisposal.addDisposeCallback(element, function () {
            if (lastCharTimeout) {
                clearTimeout(lastCharTimeout);
                lastCharTimeout = null;
            }
    
            if (timeout) {
                clearTimeout(timeout);
                timeout = null;
            }
        });
    };


    /**
     * This will be called once when the binding is first applied to an element, and again whenever any observables/computeds that are accessed change.
     * 
     * @param {object} element The DOM element involved in this binding.
     * @param {function} valueAccessor A JavaScript function that you can call to get the current model property that is involved in this binding.
     * @param {object} allBindings A JavaScript object that you can use to access all the model values bound to this DOM element.
     * @param {object} viewModel This parameter is deprecated in Knockout 3.x. Use bindingContext.$data or bindingContext.$rawData to access the view model instead.
     * @param {object} albindingContext An object that holds the binding context available to this element’s bindings.
     */
    Handler.update = function (element, valueAccessor, allBindings, viewModel, bindingContext) {
        if (lastCharTimeout) {
            clearTimeout(lastCharTimeout);
            lastCharTimeout = null;
        }

        if (timeout) {
            clearTimeout(timeout);
            timeout = null;
        }

        placeholders = [];
        placeholdersIdx = 0;
        charIndex = 0;
        blinkCounter = 0;

        let text = ko.unwrap(valueAccessor());

        if (Array.isArray(text)) {
            placeholders = text.filter((t) => (t || "").length);
        }
        else if (typeof (text) === "string") {
            placeholders.push(text);
        }

        // Grab some more data from another binding property
        lastChar = allBindings.get("placeholderLastChar") || "|";

        // Clear placeholder
        domNode.setAttribute("placeholder", "");

        // Start typing
        timeout = setTimeout(_typeIn, 1000);
    };

    //#endregion


    //#region [ Event Handlers ]

    /**
     * Event handler for the domNode focus event.
     *
     * @param {object} e Event arguments.
     */
    let _domNode_onFocus = function (e) {
        if (lastCharTimeout) {
            clearTimeout(lastCharTimeout);
            lastCharTimeout = null;
        }

        if (timeout) {
            clearTimeout(timeout);
            timeout = null;
        }

        domNode.setAttribute("placeholder", "");
        charIndex = 0;
        blinkCounter = 0;
    };


    /**
     * Event handler for the domNode blur event.
     *
     * @param {object} e Event arguments.
     */
    let _domNode_onBlur = function (e) {
        if (domNode.value) {
            return;
        }

        // Start typing
        timeout = setTimeout(_typeIn, 1000);
    };

    //#endregion


    //#region [ Methods : Private ]

    /**
     * Animates blinking of the last character.
     */
    let _blinkLastChar = function () {
        if (lastCharTimeout) {
            clearTimeout(lastCharTimeout);
            lastCharTimeout = null;
        }

        // Get the actual placeholder
        let plc = domNode.getAttribute("placeholder");
        if (plc[plc.length - 1] === lastChar) {
            plc = plc.substring(0, plc.length - 1);
        }
        else {
            plc = plc + lastChar;
        }

        domNode.setAttribute("placeholder", plc);
        blinkCounter++;

        if (blinkCounter < 8) {
            lastCharTimeout = setTimeout(_blinkLastChar, 500);
        }
    };


    /**
     * Animates typing in in the textbox.
     */
    var _typeIn = function () {
        if (timeout) {
            clearTimeout(timeout);
            timeout = null;
        }

        // Get next character
        charIndex++;

        // Get actual placeholder text
        var txt = placeholders[placeholdersIdx];

        // Get the the displaying part of the current placeholder text
        var type = txt.substring(0, charIndex);
        if (charIndex < txt.length) {
            type = type + lastChar;
        }

        // Set the placeholder text
        domNode.setAttribute("placeholder", type);

        // Get next timeout length
        var t = Math.round(Math.random() * (200 - 30)) + 30;

        // If we hit the last char of the placeholder get the next one
        if (charIndex == txt.length) {
            t = 5000;
            charIndex = 0;
            placeholdersIdx = (placeholdersIdx < (placeholders.length - 1)) ? placeholdersIdx + 1 : 0;

            // Animation for the last char blink
            blinkCounter = 0;
            lastCharTimeout = setTimeout(_blinkLastChar, 500);
        }

        timeout = setTimeout(_typeIn, t);
    };

    //#endregion

    ko.bindingHandlers["placeholder"] = Handler;
});