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

const makeTargetElement = function (id, top) {
    const attributes = { "data-work-item-id": id + "" };
    return {
        attributes: attributes,
        classList: makeClassList(),
        getAttribute: function (name) { return attributes[name] || null; },
        setAttribute: function (name, value) { attributes[name] = value; },
        removeAttribute: function (name) { delete attributes[name]; },
        getBoundingClientRect: function () { return { top: top, height: 30 }; },
        closest: function (selector) { return selector === ".my-timeline-group" ? this : null; }
    };
};
const targetElement = makeTargetElement(2, 100);
const nextTargetElement = makeTargetElement(3, 130);
const dropZone = { classList: makeClassList(), style: {} };
const chart = {};
const scrollContainer = {
    scrollTop: 200,
    addEventListener: function () {},
    removeEventListener: function () {}
};
const root = {
    classList: makeClassList(),
    closest: function (selector) { return selector === ".v-scroll-auto" ? scrollContainer : null; },
    contains: function (element) { return element === targetElement || element === nextTargetElement; },
    getBoundingClientRect: function () { return { top: 60, left: 80 }; },
    querySelectorAll: function (selector) {
        if (selector === ".my-timeline-group") { return [targetElement, nextTargetElement]; }
        if (selector === "[data-backlog-drop-position]") {
            return [targetElement, nextTargetElement].filter((element) => element.attributes["data-backlog-drop-position"]);
        }
        return [];
    },
    querySelector: function (selector) {
        if (selector === ".my-timeline__root-drop-zone") { return dropZone; }
        if (selector === ".my-timeline__chart") { return chart; }
        if (selector === "[data-backlog-drop-position]") {
            return [targetElement, nextTargetElement].find((element) => element.attributes["data-backlog-drop-position"]) || null;
        }
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
const groupData = new Map([
    [1, { id: 1, treeLevel: 1, visible: true, showNested: false, nestedGroups: [2, 3] }],
    [2, { id: 2, treeLevel: 2, visible: false, showNested: false, nestedGroups: [4] }],
    [3, { id: 3, treeLevel: 2, visible: false }],
    [4, { id: 4, treeLevel: 3, visible: false }]
]);
viewModel.groups = {
    forEach: function (callback) { groupData.forEach(callback); },
    get: function (id) { return groupData.get(Number(id)); },
    update: function (updates) {
        updates.forEach((update) => groupData.set(update.id, Object.assign({}, groupData.get(update.id), update)));
        groupUpdates.push(updates);
    }
};
viewModel.expand();
assert.strictEqual(groupUpdates.length, 1, "expanding one level should update the DataSet in one redraw batch");
assert.strictEqual(groupData.get(1).showNested, true);
assert.strictEqual(groupData.get(2).visible, true);
assert.strictEqual(groupData.get(2).showNested, false, "a newly visible parent should remain collapsed until the next click");
assert.strictEqual(groupData.get(3).visible, true);
assert.strictEqual(groupData.get(4).visible, false, "the first click must not reveal grandchildren");
viewModel.expand();
assert.strictEqual(groupUpdates.length, 2, "the second click should expand the next hierarchy level");
assert.strictEqual(groupData.get(2).showNested, true);
assert.strictEqual(groupData.get(4).visible, true);
viewModel.collapse();
assert.strictEqual(groupUpdates.length, 3, "collapsing one level should update the DataSet in one redraw batch");
assert.strictEqual(groupData.get(1).showNested, true, "the first collapse should leave the shallower level open");
assert.strictEqual(groupData.get(2).showNested, false);
assert.strictEqual(groupData.get(4).visible, false);
viewModel.collapse();
assert.strictEqual(groupUpdates.length, 4, "the second collapse should close the root level");
assert.strictEqual(groupData.get(1).showNested, false);
assert.strictEqual(groupData.get(2).visible, false);
assert.strictEqual(groupData.get(3).visible, false);

const makeDataSet = function (items, onUpdate) {
    const data = new Map(items.map((item) => [item.id + "", Object.assign({}, item)]));
    return {
        data: data,
        forEach: function (callback) { data.forEach((value) => callback(value)); },
        get: function (id) { return data.get(id + "") || null; },
        getIds: function () { return Array.from(data.values()).map((item) => item.id); },
        remove: function (ids) { ids.forEach((id) => data.delete(id + "")); },
        update: function (updates) {
            (updates instanceof Array ? updates : [updates]).forEach((update) => {
                const current = data.get(update.id + "") || {};
                data.set(update.id + "", Object.assign({}, current, update));
            });
            if (onUpdate) { onUpdate(); }
        }
    };
};
const makeWit = function (id, pathValue, parent, level, type) {
    return {
        id: id, originalId: id, path: pathValue, parent: parent, level: level,
        parentId: null, parentTitle: "", project: "Project", areaPath: "Project", nodeName: "Project",
        remainingWork: 0, completedWork: 0, effort: 0, iterationPath: "Project", isCompleted: false,
        childCount: 0, childCompletedCount: 0, assignedTo: "", url: `https://example.test/_apis/wit/workItems/${id}`,
        title: `Work item ${id}`, type: type, state: "New", priority: 1, tags: [],
        startDate: new Date("2026-08-01T00:00:00.000Z"), targetDate: new Date("2026-08-02T00:00:00.000Z"),
        dependencies: [], backlogOrder: { eligible: true, targetEligible: true }
    };
};
const reorderedItems = [
    makeWit(20, "20", "", 1, "User Story"),
    makeWit(10, "10", "", 1, "User Story"),
    makeWit(11, "10/11", "10", 2, "Task")
];
viewModel.items(reorderedItems);
viewModel.groups = makeDataSet([
    { id: 10, order: 0, treeLevel: 1, visible: true, showNested: false, nestedGroups: [11] },
    { id: 11, order: 1, treeLevel: 2, visible: false, showNested: true, nestedInGroup: 10 },
    { id: 20, order: 2, treeLevel: 1, visible: true, showNested: true }
], function () { scrollContainer.scrollTop = 0; });
viewModel.records = makeDataSet([
    { id: 10, group: 10 }, { id: 11, group: 11 }, { id: 20, group: 20 }
]);
let timelineDestroyed = false;
const liveTimeline = { destroy: function () { timelineDestroyed = true; } };
viewModel.timeline = liveTimeline;
viewModel._renderContext = {
    states: viewModel.states(), priorities: viewModel.priorities(), types: viewModel.types(),
    typesOther: viewModel.typesOther(), icons: viewModel.icons(), showFields: viewModel.showFields(),
    backlogOrder: viewModel.backlogOrder()
};
viewModel._dependenciesKey = viewModel._getDependenciesKey(reorderedItems);
scrollContainer.scrollTop = 640;
viewModel._onItemsChanged();
assert.strictEqual(viewModel.timeline, liveTimeline, "a backlog reorder must keep the existing vis-timeline instance");
assert.strictEqual(timelineDestroyed, false, "a backlog reorder must not destroy and reconstruct the timeline");
assert.strictEqual(viewModel.groups.get(10).showNested, false, "the moved user's collapsed hierarchy state must be retained");
assert.strictEqual(viewModel.groups.get(11).visible, false, "tasks below a collapsed moved item must stay hidden");
assert.strictEqual(viewModel.groups.get(20).order, 0, "the live DataSet should receive the new backlog order");
assert.strictEqual(scrollContainer.scrollTop, 640, "a backlog reorder must restore page scroll after the DataSet redraw");
scrollContainer.scrollTop = 200;

const dragged = { id: 1, originalId: 1, backlogEligible: true, backlogTargetEligible: true, backlogId: "stories", backlogRank: 1, backlogParentId: 11, backlogParentValid: true, isCompleted: true };
const target = { id: 2, originalId: 2, backlogEligible: true, backlogTargetEligible: true, backlogId: "stories", backlogRank: 1, backlogParentId: 11, backlogParentValid: true };
const nextTarget = { id: 3, originalId: 3, backlogEligible: true, backlogTargetEligible: true, backlogId: "stories", backlogRank: 1, backlogParentId: 11, backlogParentValid: true };
viewModel.groups = { get: function (id) { return [dragged, target, nextTarget].find((group) => group.id === Number(id)) || null; } };
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
assert.strictEqual(viewModel._getBacklogDropPosition(dragged, Object.assign({}, target, { backlogParentValid: false }), targetElement, pointerEvent("pointermove", 105)), null, "an invalid destination hierarchy must not expose a drop line");
assert.strictEqual(viewModel._getBacklogDropPosition(dragged, Object.assign({}, target, { backlogEligible: false }), targetElement, pointerEvent("pointermove", 105)), null, "a target outside the current team's Area Paths must not expose a drop line");

viewModel._onBacklogPointerDown(dragged, handle, pointerEvent("pointerdown", 100));
assert.strictEqual(viewModel._backlogDraggedId, 1, "completed work items should start the same pointer drag as active items");
assert.ok(listeners.pointermove && listeners.pointerup, "the drag should track pointer movement outside the handle");
assert.strictEqual(dropZone.style.top, "64px");

hitElement = targetElement;
viewModel._onBacklogPointerMove(pointerEvent("pointermove", 124));
assert.strictEqual(targetElement.attributes["data-backlog-drop-position"], undefined);
assert.strictEqual(nextTargetElement.attributes["data-backlog-drop-position"], "before", "the lower half of one row should canonicalize to the next sibling's upper boundary");
hitElement = nextTargetElement;
viewModel._onBacklogPointerMove(pointerEvent("pointermove", 132));
assert.strictEqual(nextTargetElement.attributes["data-backlog-drop-position"], "before", "moving a few pixels across the same logical boundary should keep one drop target");
viewModel._onBacklogPointerUp(pointerEvent("pointerup", 132));
assert.deepStrictEqual(JSON.parse(JSON.stringify(move)), { draggedId: 1, targetId: 3, position: "before" });
assert.strictEqual(viewModel._backlogDraggedId, null);

assert.ok(source.includes("pointerdown"), "drag handles should use pointer events");
assert.strictEqual(source.includes('draggable="true"'), false, "native HTML drag should not be used inside vis-timeline");
assert.ok(fs.readFileSync(path.join(__dirname, "../html/querygantt-tab.html"), "utf8").includes("<span>Sort:</span>"));

const timelineLess = fs.readFileSync(path.join(__dirname, "../less/components/timeline.less"), "utf8")
    .replace(/\r\n?/g, "\n");
assert.ok(timelineLess.includes("&--drop-inside {\n            .my-timeline-group__title"), "a child drop should highlight the target title rather than draw another sibling line");
assert.ok(timelineLess.includes("--status-success-background"), "the child destination should use a distinct light green success highlight");

console.log("timeline backlog interaction tests passed");
