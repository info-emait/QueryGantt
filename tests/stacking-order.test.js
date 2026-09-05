"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const read = function (filename) {
    return fs.readFileSync(path.join(__dirname, "..", filename), "utf8").replace(/\r\n?/g, "\n");
};
const variables = read("less/_variables.less");
const tabLess = read("less/querygantt-tab.less");
const timelineLess = read("less/components/timeline.less");
const tabHtml = read("html/querygantt-tab.html");
const valueOf = function (name) {
    const match = variables.match(new RegExp("@" + name + "\\s*:\\s*(\\d+)\\s*;"));
    assert.ok(match, "missing stacking variable @" + name);
    return Number(match[1]);
};

const floatingAxis = valueOf("z-index-timeline-floating-axis");
const rootDropZone = valueOf("z-index-backlog-root-drop-zone");
const filter = valueOf("z-index-filter");

assert.ok(rootDropZone > floatingAxis, "the backlog root drop target should remain above the floating date axis");
assert.ok(filter > rootDropZone, "filter callouts must remain above every fixed timeline layer");
assert.ok(/&__sticky-region\s*\{[^}]*position:\s*sticky;[^}]*top:\s*0;[^}]*z-index:\s*@z-index-filter;/s.test(tabLess),
    "the alert and filter region must establish the highest application stacking context");
assert.ok(/class="querygantt-tab__sticky-region\b[^"]*"[^>]*>[\s\S]*?<my-message[\s\S]*?class="querygantt-tab__filter\b/s.test(tabHtml),
    "alerts and filters should share one sticky region so variable alert height cannot cause overlap");
assert.ok(/class="querygantt-tab__filter\b/.test(tabHtml), "the filter host must use the stacking-context class");
assert.strictEqual(/querygantt-tab__filter[^>]*style="[^"]*z-index/.test(tabHtml), false,
    "filter stacking should be owned by the sticky region rather than an inline magic number");

if (timelineLess.includes("&__floating-axis")) {
    assert.ok(/&__floating-axis\s*\{[^}]*z-index:\s*@z-index-timeline-floating-axis;/s.test(timelineLess),
        "the floating date axis must use the shared layer contract");
}
if (timelineLess.includes("&__root-drop-zone")) {
    assert.ok(/&__root-drop-zone\s*\{[^}]*z-index:\s*@z-index-backlog-root-drop-zone;/s.test(timelineLess),
        "the backlog root drop target must use the shared layer contract");
}

console.log("stacking order tests passed");
