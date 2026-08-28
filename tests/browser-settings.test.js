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

assert.strictEqual(service.write("publisher.internal", "project-a", "timelineListWidth", null, 480, storage), true);
assert.strictEqual(service.read("publisher.internal", "project-a", "timelineListWidth", null, storage), 480);
assert.strictEqual(service.read("publisher.public", "project-a", "timelineListWidth", null, storage), null, "different extension builds must not share layout preferences");
assert.strictEqual(service.read("publisher.internal", "project-b", "timelineListWidth", null, storage), null, "layout preferences must be scoped per project");

values.set(service.getKey("publisher.internal", "project-a", "timelineListWidth", null), "not-json");
assert.strictEqual(service.read("publisher.internal", "project-a", "timelineListWidth", null, storage), null, "malformed browser data should fail safely");
assert.strictEqual(service.write("publisher.internal", "project-a", "timelineListWidth", null, 480, {}), false, "disabled storage should not break the extension");

console.log("browser settings tests passed");
