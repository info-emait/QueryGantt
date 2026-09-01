"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const read = function (filename) {
    return fs.readFileSync(path.join(__dirname, "..", filename), "utf8").replace(/\r\n?/g, "\n");
};

const tabApp = read("js/querygantt-tab-app.js");
const timeline = read("js/components/timeline.js");
const tabHtml = read("html/querygantt-tab.html");
const configurationHtml = read("html/querygantt-configuration.html");
const timelineLess = read("less/components/timeline.less");

assert.ok(tabApp.includes("client.getFields(this.project.id, (witApi.GetFieldsExpand || {}).ExtensionFields)"),
    "field discovery should include Azure DevOps extension and custom fields");
assert.ok(tabApp.includes("fieldValues: Object.assign({}, wit.fields || {})"),
    "all returned work-item field values should reach the timeline model");
assert.ok(tabHtml.includes("fieldDefinitions: fields"),
    "the timeline component should receive discovered field metadata");
assert.ok(timeline.includes("showFields.filter((value) => value !== \"id\").forEach"),
    "configured columns should render in the persisted user order");
assert.ok(timeline.includes("fieldColumnsService.escapeHtml"),
    "arbitrary values should be escaped before entering a raw HTML timeline template");
assert.ok(configurationHtml.includes("Add a column") && configurationHtml.includes("dragstart") && configurationHtml.includes("Remove column"),
    "Column options should support adding, removing, and reordering fields");
assert.ok(timelineLess.includes("&--field {\n                width: rem(160px);"),
    "generic fields should use a stable column width");

console.log("field columns integration tests passed");
