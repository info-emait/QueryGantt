"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const timelineSource = fs.readFileSync(path.join(__dirname, "../js/components/timeline.js"), "utf8")
    .replace(/\r\n?/g, "\n");
const timelineLess = fs.readFileSync(path.join(__dirname, "../less/components/timeline.less"), "utf8")
    .replace(/\r\n?/g, "\n");

assert.ok(timelineSource.includes("content: wit.title,"), "the full work-item title should be supplied to the group template");
assert.strictEqual(timelineSource.includes("content: wit.title.truncate("), false, "work-item titles must not be shortened in JavaScript");

const titleRule = timelineLess.match(/&__title\s*\{([\s\S]*?)&--completed\s*\{/);
assert.ok(titleRule, "the group title rule should remain present");
assert.ok(titleRule[1].includes("white-space: nowrap;"), "titles should remain on one row");
assert.ok(titleRule[1].includes("overflow: hidden;"), "overflowing title text should be clipped at its column boundary");
assert.ok(titleRule[1].includes("text-overflow: clip;"), "clipped titles must not render an ellipsis");
assert.ok(titleRule[1].includes("min-width: 0;"), "the title must be allowed to shrink inside the flex row");
assert.ok(titleRule[1].includes("flex: 1 1 0;"), "the title column should consume the same remaining width on every row");
assert.ok(timelineLess.includes("&__dividier {\n            flex: 0 0 0;"), "a second flexible spacer must not make metadata alignment depend on title length");

assert.ok(timelineLess.includes("&__content {\n            flex: 0 0 auto;"), "fixed metadata columns should not shrink when the title is clipped");
assert.ok(timelineLess.includes("&-inner {\n            flex: 1;\n            box-sizing: border-box;\n            min-width: 0;\n            width: 100%;"), "tree indentation must stay inside a finite row width so metadata columns keep one right edge at every hierarchy level");

console.log("title clipping tests passed");
