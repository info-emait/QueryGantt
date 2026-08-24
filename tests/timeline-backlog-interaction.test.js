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
    const result = function (value) { if (arguments.length) { initial = value; return result; } return initial; };
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
    components: { register: function (name, registration) { if (name === "my-timeline") { ko.registration = registration; } } }
};

const listeners = {};
let hitElement = null;
const document = {
    addEventListener: function (name, callback) { listeners[name] = callback; },
    removeEventListener: function (name, callback) { if (listeners[name] === callback) { delete listeners[name]; } },
    elementFromPoint: function () { return hitElement; },
    head: { querySelectorAll: function () { return []; }, appendChild: function () {} },
    createElement: function () { return { classList: makeClassList(), setAttribute: function () {}, innerHTML: "" }; }
};

const attributes = { "data-work-item-id": "2" };
const targetElement = {
    classList: makeClassList(),
    getAttribute: function (name) { return attributes[name] || null; },
    setAttribute: function (name, value) { attributes[name] = value; },
    removeAttribute: function (name) { delete attributes[name]; },
    getBoundingClientRect: function () { return { top: 100, height: 30 }; },
    closest: function (selector) { return selector === ".my-timeline-group" ? this : null; }
};
const dropZone = { classList: makeClassList(), style: {} };
const chart = {};
const root = {
    classList: makeClassList(),
    contains: function (element) { return element === targetElement; },
    getBoundingClientRect: function () { return { top: 60, left: 80 }; },
    querySelectorAll: function (selector) { return selector === "[data-backlog-drop-position]" && attributes["data-backlog-drop-position"] ? [targetElement] : []; },
    querySelector: function (selector) {
        if (selector === ".my-timeline__root-drop-zone") { return dropZone; }
        if (selector === ".my-timeline__chart") { return chart; }
        if (selector === "[data-backlog-drop-position]") { return attributes["data-backlog-drop-position"] ? targetElement : null; }
        return null;
    }
};

const source = "String.prototype.truncate = function () { return this.toString(); };\n"
    + fs.readFileSync(path.join(__dirname, "../js/components/timeline.js"), "utf8");
vm.runInNewContext(source, {
    Array: Array, Date: Date, Map: Map, Number: Number, Promise: Promise, Set: Set,
    console: { debug: function () {}, log: function () {}, warn: function () {} },
    document: document, isNaN: isNaN,
    define: function (dependencies, factory) {
        factory.apply(null, dependencies.map(function (name) {
            if (name === "knockout") { return ko; }
            if (name === "vis-timeline") { return {}; }
            return function () {};
        }));
    }
});

let move = null;
const viewModel = ko.registration.viewModel.createViewModel({
    items: observable([]), backlogOrder: observable(true), states: observable([]), priorities: observable([]),
    types: observable([]), typesOther: observable([]), icons: observable({}), showFields: observable([]),
    callbacks: { reorderWit: function (value) { move = value; return Promise.resolve(true); } }, actions: {}
}, { element: { firstChild: root, querySelector: function () {} } });

const groupUpdates = [];
viewModel.timeline = {};
viewModel.groups = {
    forEach: function (callback) {
        [{ id: 1, treeLevel: 1, nestedGroups: [2] }, { id: 2, treeLevel: 2 }].forEach(callback);
    },
    update: function (updates) { groupUpdates.push(updates); }
};
viewModel.expand();
assert.strictEqual(groupUpdates.length, 1, "expand all should update the DataSet in one redraw batch");
assert.strictEqual(groupUpdates[0].length, 2);
groupUpdates.length = 0;
viewModel.collapse();
assert.strictEqual(groupUpdates.length, 1, "collapse all should update the DataSet in one redraw batch");
assert.deepStrictEqual(JSON.parse(JSON.stringify(groupUpdates[0])), [
    { id: 1, showNested: false },
    { id: 2, visible: false }
]);

const dragged = { id: 1, originalId: 1, backlogEligible: true, backlogId: "stories", backlogRank: 1, isCompleted: true };
const target = { id: 2, originalId: 2, backlogEligible: true, backlogId: "stories", backlogRank: 1 };
viewModel.groups = { get: function (id) { return Number(id) === 1 ? dragged : Number(id) === 2 ? target : null; } };
const handle = {
    captured: null,
    setPointerCapture: function (id) { this.captured = id; },
    hasPointerCapture: function (id) { return this.captured === id; },
    releasePointerCapture: function () { this.captured = null; }
};
const pointerEvent = function (type, clientY) {
    return {
        type: type, pointerId: 7, pointerType: "mouse", button: 0, clientX: 100, clientY: clientY,
        preventDefault: function () {}, stopPropagation: function () {}, stopImmediatePropagation: function () {}
    };
};

viewModel._onBacklogPointerDown(dragged, handle, pointerEvent("pointerdown", 100));
assert.strictEqual(viewModel._backlogDraggedId, 1, "completed work items should start the same pointer drag as active items");
assert.ok(listeners.pointermove && listeners.pointerup, "the drag should track pointer movement outside the handle");
assert.strictEqual(dropZone.style.top, "64px");

hitElement = targetElement;
viewModel._onBacklogPointerMove(pointerEvent("pointermove", 124));
assert.strictEqual(attributes["data-backlog-drop-position"], "after");
viewModel._onBacklogPointerUp(pointerEvent("pointerup", 124));
assert.deepStrictEqual(JSON.parse(JSON.stringify(move)), { draggedId: 1, targetId: 2, position: "after" });
assert.strictEqual(viewModel._backlogDraggedId, null);

assert.ok(source.includes("pointerdown"), "drag handles should use pointer events");
assert.strictEqual(source.includes('draggable="true"'), false, "native HTML drag should not be used inside vis-timeline");
assert.ok(fs.readFileSync(path.join(__dirname, "../html/querygantt-tab.html"), "utf8").includes("<span>Sort:</span>"));

console.log("timeline backlog interaction tests passed");
