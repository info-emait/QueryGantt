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
