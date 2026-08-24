"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const makeClassList = function () {
    const values = new Set();
    return {
        add: function () { Array.from(arguments).forEach((value) => values.add(value)); },
        remove: function () { Array.from(arguments).forEach((value) => values.delete(value)); },
        contains: function (value) { return values.has(value); }
    };
};

const observable = function (initial) {
    const result = function (value) {
        if (arguments.length) {
            initial = value;
            return result;
        }
        return initial;
    };
    result.__observable = true;
    return result;
};

const ko = {
    observable: observable,
    observableArray: observable,
    isObservable: function (value) { return Boolean(value && value.__observable); },
    isObservableArray: function (value) { return Boolean(value && value.__observable); },
    computed: function () {
        const result = { dispose: function () {} };
        result.extend = function () { return result; };
        return result;
    },
    components: {
        register: function (name, registration) {
            if (name === "my-timeline") {
                ko.registration = registration;
            }
        }
    }
};

const filter = {
    getBoundingClientRect: function () { return { top: 0, bottom: 48 }; }
};
const document = {
    _listeners: {},
    addEventListener: function (name, callback) { this._listeners[name] = callback; },
    removeEventListener: function (name, callback) { if (this._listeners[name] === callback) { delete this._listeners[name]; } },
    querySelector: function (selector) { return selector === ".querygantt-tab__filter" ? filter : null; },
    head: { querySelectorAll: function () { return []; }, appendChild: function () {} },
    body: {
        appendChild: function (element) { element.parentNode = this; },
        removeChild: function (element) { element.parentNode = null; }
    },
    createElement: function () {
        return {
            classList: makeClassList(), style: {}, innerHTML: "", firstChild: null,
            setAttribute: function () {},
            appendChild: function (element) { this.firstChild = element; },
            querySelectorAll: function () { return []; }
        };
    }
};

let axisTop = -20;
const axis = {
    getBoundingClientRect: function () { return { top: axisTop, left: 420, width: 600, height: 44 }; },
    cloneNode: function () {
        return {
            classList: makeClassList(), style: {},
            removeAttribute: function () {},
            querySelectorAll: function () { return []; }
        };
    }
};
const scrollContainer = {
    scrollTop: 200,
    addEventListener: function () {},
    removeEventListener: function () {}
};
const chartListeners = {};
const chart = {
    clientWidth: 600,
    closest: function (selector) { return selector === ".v-scroll-auto" ? scrollContainer : null; },
    addEventListener: function (name, callback) { chartListeners[name] = callback; },
    removeEventListener: function (name, callback) { if (chartListeners[name] === callback) { delete chartListeners[name]; } },
    querySelector: function (selector) { return selector === ".vis-panel.vis-top" ? axis : null; },
    getBoundingClientRect: function () { return { bottom: 500, width: 600 }; }
};

let source = "String.prototype.truncate = function () { return this.toString(); };\n"
    + fs.readFileSync(path.join(__dirname, "../js/components/timeline.js"), "utf8");
vm.runInNewContext(source, {
    Array: Array, Date: Date, Map: Map, Number: Number, Promise: Promise, Set: Set,
    console: { debug: function () {}, log: function () {}, warn: function () {} },
    document: document, isNaN: isNaN,
    addEventListener: function () {}, removeEventListener: function () {},
    define: function (dependencies, factory) {
        factory.apply(null, dependencies.map(function (name) {
            if (name === "knockout") { return ko; }
            if (name === "vis-timeline") { return {}; }
            return function () {};
        }));
    }
});

const viewModel = ko.registration.viewModel.createViewModel({
    items: observable([]), states: observable([]), priorities: observable([]),
    types: observable([]), typesOther: observable([]), icons: observable({}),
    showFields: observable([]), callbacks: {}, actions: {}
}, { element: { firstChild: chart, querySelector: function () {} } });

const originalStart = new Date("2026-08-01T00:00:00.000Z");
const originalEnd = new Date("2026-08-31T00:00:00.000Z");
let visibleWindow = { start: originalStart, end: originalEnd };
viewModel.timeline = {
    range: { options: { moveable: true } },
    getWindow: function () { return visibleWindow; },
    setWindow: function (start, end) { visibleWindow = { start: start, end: end }; },
    destroy: function () {}
};
viewModel._syncFloatingAxis(true);
assert.ok(viewModel.floatingAxis.classList.contains("my-timeline__floating-axis--visible"));
assert.strictEqual(viewModel.floatingAxis.style.top, "48px");
assert.strictEqual(viewModel.floatingAxis.style.left, "420px");
assert.ok(viewModel.floatingAxis.firstChild, "the live top axis should be mirrored into the fixed layer");

axisTop = 80;
viewModel._syncFloatingAxis(false);
assert.strictEqual(viewModel.floatingAxis.classList.contains("my-timeline__floating-axis--visible"), false);

let prevented = false;
viewModel._onTimelineWheel({
    deltaX: 0, deltaY: 120, shiftKey: false, ctrlKey: false, cancelable: true,
    preventDefault: function () { prevented = true; }, stopPropagation: function () {}
});
assert.strictEqual(prevented, false, "a vertical wheel should remain available to the page");
assert.strictEqual(visibleWindow.start.getTime(), originalStart.getTime());
viewModel._onTimelineWheel({
    deltaX: 60, deltaY: 0, shiftKey: false, ctrlKey: false, cancelable: true,
    preventDefault: function () { prevented = true; }, stopPropagation: function () {}
});
assert.strictEqual(prevented, true, "horizontal trackpad input should pan the date range");
assert.ok(visibleWindow.start.getTime() > originalStart.getTime());

const gestureTarget = { closest: function () { return null; } };
viewModel._onTimelinePointerDown({ pointerId: 20, pointerType: "mouse", button: 0, clientX: 300, clientY: 300, target: gestureTarget });
viewModel._onTimelinePointerMove({ pointerId: 20, clientX: 302, clientY: 250, cancelable: true, preventDefault: function () {} });
assert.strictEqual(scrollContainer.scrollTop, 250, "a vertical background drag should scroll the page");
assert.strictEqual(viewModel.timeline.range.options.moveable, false);
viewModel._onTimelinePointerUp({ pointerId: 20 });
assert.strictEqual(viewModel.timeline.range.options.moveable, true);

let renderedNode = null;
viewModel.exportImage(function (node) {
    renderedNode = node;
    return Promise.resolve("png");
}).then(function (result) {
    assert.strictEqual(result, "png");
    assert.strictEqual(renderedNode, chart, "the naturally expanded timeline should be exported directly");

    assert.ok(/axis:\s*"top"/.test(source), "only the top time axis should be rendered");
    assert.ok(/verticalScroll:\s*false/.test(source), "work item rows should use page scrolling");
    assert.ok(/horizontalScroll:\s*false/.test(source), "vertical wheel input should not be converted to horizontal panning");
    assert.strictEqual(/maxHeight\s*:/.test(source), false, "the timeline must not retain a fixed-height cap");

    viewModel.dispose();
    console.log("timeline header tests passed");
}).catch(function (error) {
    console.error(error);
    process.exitCode = 1;
});
