"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let service = null;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/services/browser-settings.js"), "utf8"), {
    console: { warn: function () {} },
    define: function (dependencies, factory) { service = factory(); },
    encodeURIComponent: encodeURIComponent
});

const values = new Map();
const storage = {
    getItem: function (key) { return values.has(key) ? values.get(key) : null; },
    setItem: function (key, value) { values.set(key, value); }
};

assert.strictEqual(service.write("publisher.internal", "project-a", "dateGranularity", null, "day", storage), true);
assert.strictEqual(service.read("publisher.internal", "project-a", "dateGranularity", null, storage), "day");
assert.strictEqual(service.read("publisher.public", "project-a", "dateGranularity", null, storage), null, "different extension builds must not share preferences");
assert.strictEqual(service.read("publisher.internal", "project-b", "dateGranularity", null, storage), null, "projects must not share preferences");

values.set(service.getKey("publisher.internal", "project-a", "dateGranularity", null), "not-json");
assert.strictEqual(service.read("publisher.internal", "project-a", "dateGranularity", null, storage), null, "malformed browser data should fail safely");
assert.strictEqual(service.write("publisher.internal", "project-a", "dateGranularity", null, "day", {}), false, "disabled storage should not break the extension");

console.log("browser settings tests passed");
