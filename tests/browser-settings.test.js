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

const view = { preset: "custom", start: "2026-08-21T00:00:00.000Z", end: "2026-08-28T00:00:00.000Z" };
assert.strictEqual(service.write("publisher.internal", "project-a", "zoomView", "query-a", view, storage), true);
assert.deepStrictEqual(JSON.parse(JSON.stringify(service.read("publisher.internal", "project-a", "zoomView", "query-a", storage))), view);
assert.strictEqual(service.read("publisher.internal", "project-a", "zoomView", "query-b", storage), null, "zoom windows must be scoped per query");
assert.strictEqual(service.read("publisher.public", "project-a", "zoomView", "query-a", storage), null, "different extension builds must not share preferences");

values.set(service.getKey("publisher.internal", "project-a", "zoomView", "broken"), "not-json");
assert.strictEqual(service.read("publisher.internal", "project-a", "zoomView", "broken", storage), null, "malformed browser data should fail safely");
assert.strictEqual(service.write("publisher.internal", "project-a", "zoomView", "query-a", view, {}), false, "disabled storage should not break the extension");

console.log("browser settings tests passed");
