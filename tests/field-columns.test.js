"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ko = require("knockout");

const loadService = function () {
    let result = null;
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/services/field-columns.js"), "utf8"), {
        Set: Set,
        define: function (dependencies, factory) { result = factory(); }
    }, { filename: "field-columns.js" });
    return result;
};

const service = loadService();
const definitions = service.mergeDefinitions([
    { name: "Duration", value: "duration" },
    { name: "Assigned To", value: "assignedTo" }
], [
    { name: "Title", referenceName: "System.Title", type: 0, usage: 1 },
    { name: "Assigned To", referenceName: "System.AssignedTo", type: 10, usage: 1 },
    { name: "Custom Score", referenceName: "Custom.Score", type: 7, usage: 1 },
    { name: "Acceptance Criteria", referenceName: "Microsoft.VSTS.Common.AcceptanceCriteria", type: "html", usage: "workItem" },
    { name: "Deleted", referenceName: "Custom.Deleted", type: 0, usage: 1, isDeleted: true },
    { name: "Link Comment", referenceName: "System.Links.Comment", type: 0, usage: 2 }
], ["duration", "field:Custom.Missing"]);

assert.deepStrictEqual(JSON.parse(JSON.stringify(definitions.map((field) => field.value))), [
    "duration",
    "assignedTo",
    "field:Microsoft.VSTS.Common.AcceptanceCriteria",
    "field:Custom.Score",
    "field:Custom.Missing"
], "legacy columns should remain compatible while arbitrary work-item fields are sorted and de-duplicated");
assert.strictEqual(definitions.find((field) => field.value === "field:Custom.Missing").unavailable, true,
    "a saved field must remain removable when Azure field discovery is temporarily unavailable");
assert.strictEqual(service.getReferenceName("field:Custom.Score"), "Custom.Score");
assert.strictEqual(service.getReferenceName("duration"), null);
assert.deepStrictEqual(JSON.parse(JSON.stringify(service.normalizeSelection(["duration", "", "duration", "field:Custom.Score"]))),
    ["duration", "field:Custom.Score"], "the persisted order should remove blanks and duplicates without sorting");
assert.strictEqual(service.formatValue({ displayName: "Ada Lovelace", uniqueName: "ada@example.test" }, { type: 10 }), "Ada Lovelace");
assert.strictEqual(service.formatValue(["One", "Two"], { type: 0 }), "One, Two");
assert.strictEqual(service.formatValue(false, { type: 9 }), "False");
assert.strictEqual(service.formatValue("<p>Hello <strong>world</strong></p><br>Next &amp; last", { type: 4 }), "Hello world Next & last");
assert.strictEqual(service.formatValue("<p>String enum</p>", { type: "html" }), "String enum",
    "REST string enum values should be handled as well as SDK numeric enum values");
assert.strictEqual(service.escapeHtml("<img src=x onerror='bad'>&\""), "&lt;img src=x onerror=&#39;bad&#39;&gt;&amp;&quot;",
    "arbitrary field values must be escaped because the legacy timeline disables its XSS filter");

const loadTimelineHelpers = function () {
    let result = null;
    let source = fs.readFileSync(path.join(__dirname, "../js/components/timeline.js"), "utf8");
    source = source.replace(/\n\}\);\s*$/, "\n    return { createGroupTemplate: createGroupTemplate };\n});\n");
    const timelineKnockout = { components: { register: function () {} } };
    const document = {
        head: { querySelectorAll: function () { return []; }, appendChild: function () {} },
        createElement: function () {
            return {
                classList: { add: function () {} },
                innerHTML: "",
                setAttribute: function () {},
                querySelector: function (selector) {
                    return selector === ".my-timeline-group__button--drag" ? null : { addEventListener: function () {} };
                }
            };
        }
    };
    vm.runInNewContext(source, {
        Array: Array,
        Date: Date,
        Map: Map,
        Number: Number,
        Promise: Promise,
        Set: Set,
        console: { debug: function () {}, log: function () {}, warn: function () {} },
        document: document,
        isNaN: isNaN,
        define: function (dependencies, factory) {
            const timelineDependencies = {
                knockout: timelineKnockout,
                "services/date-granularity": {},
                "services/field-columns": service,
                "services/timeline-split": {},
                "services/timeline-zoom": {},
                "vis-timeline": {},
                "vis-timeline-arrow": function () {}
            };
            result = factory.apply(null, dependencies.map(function (name) { return timelineDependencies[name] || {}; }));
        }
    }, { filename: "timeline.js" });
    return result;
};

const timelineHelpers = loadTimelineHelpers();
const renderedGroup = timelineHelpers.createGroupTemplate({
    _onGroupTitleSelect: function () {},
    _onGroupSelect: function () {},
    _onGroupEdit: function () {},
    _onBacklogPointerDown: function () {}
}, {
    id: 17,
    content: "Example item",
    fieldValues: {
        "Custom.Second": "<b>second</b>",
        "Custom.First": "first"
    },
    isCompleted: false,
    priority: 1,
    project: "Project",
    selected: false,
    state: "New",
    title: "Example item",
    type: "Task",
    url: "https://example.test/_apis/wit/workItems/17"
}, null, [], [{ value: 1, name: "Must have", color: "ff0000" }], [{
    name: "Task",
    icon: { url: "task-icon" },
    states: [{ name: "New", color: "0078d4" }]
}], [], { "task-icon": "<svg></svg>" }, ["field:Custom.Second", "field:Custom.First"], [{
    value: "field:Custom.First",
    referenceName: "Custom.First",
    name: "First",
    type: 0
}, {
    value: "field:Custom.Second",
    referenceName: "Custom.Second",
    name: "Second",
    type: 0
}], false);
const renderedHtml = renderedGroup.innerHTML;
assert.ok(renderedHtml.indexOf('title="Second"') < renderedHtml.indexOf('title="First"'),
    "the real timeline row should render arbitrary fields in the saved column order");
assert.ok(renderedHtml.includes("&lt;b&gt;second&lt;/b&gt;"),
    "the real timeline row should HTML-escape arbitrary field values");
assert.strictEqual(renderedHtml.includes("<b>second</b>"), false,
    "raw arbitrary field markup must never enter the timeline row");

const loadConfiguration = function () {
    let result = null;
    let source = fs.readFileSync(path.join(__dirname, "../js/querygantt-configuration-app.js"), "utf8");
    source = source.replace(/\n\}\);\s*$/, "\n    return { Model: Model };\n});\n");
    const listeners = {};
    const testDocument = {
        readyState: "loading",
        hitElement: null,
        addEventListener: function (name, handler) {
            listeners[name] = listeners[name] || [];
            listeners[name].push(handler);
        },
        removeEventListener: function (name, handler) {
            listeners[name] = (listeners[name] || []).filter((candidate) => candidate !== handler);
        },
        dispatch: function (name, event) {
            (listeners[name] || []).slice().forEach((handler) => handler(event));
        },
        listenerCount: function (name) {
            return (listeners[name] || []).length;
        },
        elementFromPoint: function () {
            return this.hitElement;
        }
    };
    vm.runInNewContext(source, {
        Promise: Promise,
        Set: Set,
        console: { debug: function () {}, log: function () {} },
        document: testDocument,
        define: function (names, factory) {
            const dependencies = {
                module: { config: function () { return {}; } },
                knockout: ko,
                sdk: {},
                "api/index": { CommonServiceIds: {} },
                "services/data": {},
                "services/field-columns": service
            };
            result = factory.apply(null, names.map((name) => dependencies[name] || {}));
        }
    }, { filename: "querygantt-configuration-app.js" });
    return { exports: result, document: testDocument };
};

const loadedConfiguration = loadConfiguration();
const ConfigurationModel = loadedConfiguration.exports.Model;
const configuration = new ConfigurationModel({
    project: { id: "project-id" },
    fields: definitions.filter((field) => !field.unavailable),
    fieldsValue: ["duration", "field:Custom.Score"],
    panel: { close: function () {} }
});

assert.strictEqual(configuration.addField(), true, "Add a column should append an unused definition");
assert.deepStrictEqual(configuration._getFieldsValue(), ["duration", "field:Custom.Score", "assignedTo"]);
let rowNotifications = 0;
configuration.fieldRows.subscribe(function () { rowNotifications += 1; });
configuration.moveField(configuration.fieldRows()[2], -2);
assert.deepStrictEqual(configuration._getFieldsValue(), ["assignedTo", "duration", "field:Custom.Score"], "drag/keyboard moves should persist visual order");
assert.strictEqual(rowNotifications, 1, "reorder must notify Knockout so the visible rows move immediately");
const changed = configuration.fieldRows()[1];
changed.value("field:Custom.Score");
configuration.changeField(changed);
assert.deepStrictEqual(configuration._getFieldsValue(), ["assignedTo", "field:Custom.Score", "duration"], "selecting an existing field should swap rows instead of creating a duplicate");
configuration.removeField(configuration.fieldRows()[0]);
assert.deepStrictEqual(configuration._getFieldsValue(), ["field:Custom.Score", "duration"], "Remove should retain the remaining order");
const configurationTemplate = fs.readFileSync(path.join(__dirname, "../html/querygantt-configuration.html"), "utf8");
assert.ok(configurationTemplate.includes("pointerdown: $root.startFieldPointerDrag.bind($root)"),
    "the real configuration template should wire its drag handle to pointer reorder");
assert.strictEqual(configurationTemplate.includes('draggable="true"'), false,
    "the configuration template should not fall back to unreliable iframe-native drag/drop");

const createClassList = function () {
    const names = new Set();
    return {
        add: function (name) { names.add(name); },
        remove: function (name) { names.delete(name); },
        contains: function (name) { return names.has(name); }
    };
};
const dragConfiguration = new ConfigurationModel({
    project: { id: "project-id" },
    fields: definitions.filter((field) => !field.unavailable),
    fieldsValue: ["duration", "field:Custom.Score", "assignedTo"],
    dateGranularity: "day",
    panel: { close: function () {} }
});
const draggedRow = dragConfiguration.fieldRows()[0];
const targetRow = dragConfiguration.fieldRows()[2];
const targetClassList = createClassList();
const targetElement = {
    classList: targetClassList,
    getAttribute: function (name) {
        return name === "data-field-row-id" ? targetRow.id + "" : null;
    },
    getBoundingClientRect: function () {
        return { top: 100, height: 40 };
    },
    closest: function () { return this; }
};
const targetChild = { closest: function () { return targetElement; } };
const capturedPointers = [];
const releasedPointers = [];
let handleFocused = false;
const handle = {
    focus: function () { handleFocused = true; },
    setPointerCapture: function (pointerId) { capturedPointers.push(pointerId); },
    releasePointerCapture: function (pointerId) { releasedPointers.push(pointerId); }
};
const pointerEvent = function (values) {
    return Object.assign({
        pointerId: 7,
        clientX: 20,
        clientY: 120,
        preventDefault: function () {},
        stopPropagation: function () {}
    }, values || {});
};

assert.strictEqual(typeof(dragConfiguration.startFieldPointerDrag), "function",
    "the configuration pane must expose an iframe-safe pointer drag entry point");
dragConfiguration.startFieldPointerDrag(draggedRow, pointerEvent({ button: 0, currentTarget: handle }));
assert.strictEqual(handleFocused, true, "pointer reorder should retain keyboard focus on its drag handle");
assert.deepStrictEqual(capturedPointers, [7], "pointer reorder should capture the active pointer");
assert.strictEqual(draggedRow.grabbed(), true, "the active row should expose its grabbed state");
assert.strictEqual(loadedConfiguration.document.listenerCount("pointermove"), 1,
    "pointer reorder should keep tracking outside the handle and row");

loadedConfiguration.document.hitElement = targetChild;
loadedConfiguration.document.dispatch("pointermove", pointerEvent({ clientY: 135 }));
assert.strictEqual(targetClassList.contains("querygantt-configuration__field-row--drop-after"), true,
    "the lower half of a field row should show an after-row drop target");
loadedConfiguration.document.dispatch("pointerup", pointerEvent({ clientY: 135 }));
assert.deepStrictEqual(dragConfiguration._getFieldsValue(), ["field:Custom.Score", "assignedTo", "duration"],
    "the real pointer lifecycle should reorder and persist the configured fields");
assert.strictEqual(draggedRow.grabbed(), false, "completed pointer reorder should clear grabbed state");
assert.deepStrictEqual(releasedPointers, [7], "completed pointer reorder should release pointer capture");
assert.strictEqual(targetClassList.contains("querygantt-configuration__field-row--drop-after"), false,
    "completed pointer reorder should clear its drop marker");
assert.strictEqual(loadedConfiguration.document.listenerCount("pointermove"), 0,
    "completed pointer reorder should remove document listeners");

const beforeCancel = dragConfiguration._getFieldsValue().slice();
const cancelDraggedRow = dragConfiguration.fieldRows()[0];
dragConfiguration.startFieldPointerDrag(cancelDraggedRow, pointerEvent({ button: 0, currentTarget: handle }));
loadedConfiguration.document.hitElement = targetChild;
loadedConfiguration.document.dispatch("pointermove", pointerEvent({ clientY: 135 }));
loadedConfiguration.document.dispatch("pointercancel", pointerEvent({ clientY: 135 }));
assert.deepStrictEqual(dragConfiguration._getFieldsValue(), beforeCancel,
    "a cancelled pointer gesture must not reorder configured fields");
assert.strictEqual(cancelDraggedRow.grabbed(), false, "a cancelled gesture should clear grabbed state");
assert.strictEqual(loadedConfiguration.document.listenerCount("pointermove"), 0,
    "a cancelled gesture should remove document listeners");

console.log("field columns tests passed");
