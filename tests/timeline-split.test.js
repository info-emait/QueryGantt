"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let splitService = null;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/services/timeline-split.js"), "utf8"), {
    Number: Number,
    define: function (dependencies, factory) { splitService = factory(); }
});

assert.strictEqual(splitService.normalize("481.4"), 481);
assert.strictEqual(splitService.normalize(0), null);
assert.strictEqual(splitService.normalize("invalid"), null);
assert.deepStrictEqual(JSON.parse(JSON.stringify(splitService.getBounds(1000))), { min: 240, max: 680 });
assert.deepStrictEqual(JSON.parse(JSON.stringify(splitService.getBounds(500))), { min: 150, max: 350 }, "narrow screens should retain usable space for both panes");
assert.strictEqual(splitService.clamp(100, 1000), 240);
assert.strictEqual(splitService.clamp(900, 1000), 680);

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

let componentWidth = 1000;
let leftWidth = 500;
const rootLeft = 100;
const chart = {
    get clientWidth() { return componentWidth; },
    getBoundingClientRect: function () { return { width: componentWidth }; }
};
const left = {
    style: {},
    getBoundingClientRect: function () { return { width: leftWidth }; }
};
Object.defineProperty(left.style, "width", {
    get: function () { return leftWidth + "px"; },
    set: function (value) { leftWidth = parseFloat(value); }
});
const center = {
    getBoundingClientRect: function () { return { left: rootLeft + leftWidth }; }
};

const splitterListeners = {};
const splitterAttributes = {};
const splitter = {
    style: {},
    captured: null,
    addEventListener: function (name, callback) { splitterListeners[name] = callback; },
    removeEventListener: function (name, callback) { if (splitterListeners[name] === callback) { delete splitterListeners[name]; } },
    setAttribute: function (name, value) { splitterAttributes[name] = value + ""; },
    setPointerCapture: function (id) { this.captured = id; },
    hasPointerCapture: function (id) { return this.captured === id; },
    releasePointerCapture: function () { this.captured = null; }
};
const root = {
    getBoundingClientRect: function () { return { left: rootLeft }; },
    querySelector: function (selector) {
        if (selector === ".my-timeline__chart") { return chart; }
        if (selector === ".my-timeline__splitter") { return splitter; }
        return null;
    }
};

let animationFrame = null;
let animationFrameId = 0;
const windowListeners = {};
const context = {
    Array: Array,
    Date: Date,
    Number: Number,
    console: { debug: function () {}, log: function () {}, warn: function () {} },
    document: {},
    isNaN: isNaN,
    addEventListener: function (name, callback) { windowListeners[name] = callback; },
    removeEventListener: function (name, callback) { if (windowListeners[name] === callback) { delete windowListeners[name]; } },
    requestAnimationFrame: function (callback) { animationFrame = callback; animationFrameId += 1; return animationFrameId; },
    cancelAnimationFrame: function () { animationFrame = null; },
    define: function (dependencies, factory) {
        factory.apply(null, dependencies.map(function (name) {
            if (name === "knockout") { return ko; }
            if (name === "services/timeline-split") { return splitService; }
            if (name === "vis-timeline") { return {}; }
            return function () {};
        }));
    }
};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/components/timeline.js"), "utf8"), context);

let savedWidth = null;
const viewModel = ko.registration.viewModel.createViewModel({
    items: observable([]),
    states: observable([]),
    priorities: observable([]),
    types: observable([]),
    typesOther: observable([]),
    icons: observable({}),
    showFields: observable([]),
    listWidth: observable(null),
    callbacks: { listWidthChanged: function (width) { savedWidth = width; } },
    actions: {}
}, { element: { firstChild: root, querySelector: function () {} } });

let redrawCount = 0;
let destroyed = false;
viewModel.timeline = {
    body: { dom: { leftContainer: left, centerContainer: center } },
    redraw: function () { redrawCount += 1; },
    off: function () {},
    destroy: function () { destroyed = true; }
};

viewModel._positionSplitter();
assert.strictEqual(splitter.style.left, "500px");
assert.strictEqual(splitterAttributes["aria-valuemin"], "240");
assert.strictEqual(splitterAttributes["aria-valuemax"], "680");

const pointerEvent = function (type, clientX) {
    return {
        type: type,
        button: 0,
        pointerId: 7,
        clientX: clientX,
        preventDefault: function () {}
    };
};
splitterListeners.pointerdown(pointerEvent("pointerdown", 500));
splitterListeners.pointermove(pointerEvent("pointermove", 420));
assert.strictEqual(savedWidth, null, "drag movement must not write browser storage on every pixel");
assert.ok(animationFrame, "drag redraws should be coalesced through requestAnimationFrame");
splitterListeners.pointerup(pointerEvent("pointerup", 420));
assert.strictEqual(leftWidth, 420);
assert.strictEqual(savedWidth, 420, "the final drag width should be saved once the pointer is released");
assert.strictEqual(viewModel.listWidth(), 420);

let keyPrevented = false;
splitterListeners.keydown({ key: "ArrowLeft", shiftKey: false, preventDefault: function () { keyPrevented = true; } });
assert.strictEqual(leftWidth, 404);
assert.strictEqual(savedWidth, 404);
assert.strictEqual(keyPrevented, true, "the separator should support keyboard resizing");

viewModel.listWidth(680);
componentWidth = 500;
windowListeners.resize();
assert.ok(animationFrame);
animationFrame();
animationFrame = null;
assert.strictEqual(leftWidth, 350, "a saved preference should be clamped on a narrow screen");
assert.strictEqual(viewModel.listWidth(), 680, "responsive clamping must not overwrite the user's preferred width");

componentWidth = 1000;
windowListeners.resize();
animationFrame();
animationFrame = null;
assert.strictEqual(leftWidth, 680, "the preferred width should return when enough screen space is available again");

const template = ko.registration.template;
assert.ok(template.includes('role="separator"'));
assert.ok(template.includes('data-noexport="true"'), "the splitter must not be included in PNG exports");

const appSource = fs.readFileSync(path.join(__dirname, "../js/querygantt-tab-app.js"), "utf8");
const appHtml = fs.readFileSync(path.join(__dirname, "../html/querygantt-tab.html"), "utf8");
const timelineLess = fs.readFileSync(path.join(__dirname, "../less/components/timeline.less"), "utf8");
assert.ok(appSource.includes('"timelineListWidth", null'), "the split should be persisted as a project-level browser preference");
assert.ok(appHtml.includes("listWidthChanged: listWidthChanged.bind($root)"));
assert.ok(timelineLess.includes("touch-action: none;"));

viewModel.dispose();
assert.strictEqual(destroyed, true);
assert.strictEqual(windowListeners.resize, undefined, "global resize listeners must be removed on disposal");

console.log("timeline split tests passed");
