"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(path.join(__dirname, "../js/components/timeline.js"), "utf8");
const handler = source.match(/Timeline\.prototype\._onGroupTitleSelect = function \(e\) \{([\s\S]*?)\n    \};/);

assert.ok(handler, "the work-item title event handler should exist");
assert.ok(handler[1].includes("e.stopPropagation()"), "title events should not select the vis-timeline row");
assert.strictEqual(handler[1].includes("preventDefault"), false, "native anchor navigation must not be cancelled");
assert.strictEqual(handler[1].includes("openNewWindow"), false, "the iframe host callback must not replace native target=_blank navigation");
assert.ok(source.includes('target="_blank" rel="noopener noreferrer"'), "every timeline work-item title should explicitly open in a safe new tab");
assert.ok(source.includes('addEventListener("pointerdown", vm._onGroupTitleSelect.bind(vm), false)'));
assert.ok(source.includes('addEventListener("click", vm._onGroupTitleSelect.bind(vm), false)'));

console.log("timeline link navigation tests passed");
