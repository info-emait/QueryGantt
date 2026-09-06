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
    vm.runInNewContext(source, {
        Promise: Promise,
        Set: Set,
        console: { debug: function () {}, log: function () {} },
        document: { readyState: "loading", addEventListener: function () {} },
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
    return result;
};

const ConfigurationModel = loadConfiguration().Model;
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

console.log("field columns tests passed");
