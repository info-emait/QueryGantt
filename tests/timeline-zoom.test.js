"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let service = null;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/services/timeline-zoom.js"), "utf8"), {
    Date: Date,
    Number: Number,
    define: function (dependencies, factory) { service = factory(); },
    isNaN: isNaN
});

const plain = function (value) { return JSON.parse(JSON.stringify(value)); };
const fitted = {
    start: new Date("2026-07-01T00:00:00.000Z"),
    end: new Date("2026-10-01T00:00:00.000Z")
};
const fittedDuration = fitted.end.getTime() - fitted.start.getTime();
const center = new Date("2026-08-21T12:00:00.000Z");

["100", "200", "300", "400", "custom"].forEach(function (preset) {
    assert.strictEqual(service.normalizePreset(preset), preset);
});
assert.strictEqual(service.normalizePreset("fit"), "100", "legacy Fit all should migrate to 100%");
assert.strictEqual(service.normalizePreset("500"), "400", "a previously saved 500% preference should migrate to the new maximum");
assert.strictEqual(service.normalizePreset("unsupported"), "custom");
assert.deepStrictEqual(plain(service.normalizeView()), { preset: "100", start: null, end: null });
assert.deepStrictEqual(plain(service.normalizeView({ preset: "custom", start: "invalid", end: "invalid" })), { preset: "100", start: null, end: null });

const restored = service.normalizeView({
    preset: "custom",
    start: "2026-08-18T00:00:00.000Z",
    end: "2026-08-25T00:00:00.000Z"
});
assert.ok(restored.start instanceof Date);
assert.deepStrictEqual(plain(service.serializeView(restored)), {
    preset: "custom",
    start: "2026-08-18T00:00:00.000Z",
    end: "2026-08-25T00:00:00.000Z"
});
assert.deepStrictEqual(plain(service.serializeView({ preset: "300", start: restored.start, end: restored.end })), { preset: "300" }, "percentage presets should remain relative to current data");
assert.strictEqual(service.normalizeView({ preset: "week", start: restored.start, end: restored.end }).preset, "custom", "legacy named ranges should retain their exact window");

[100, 200, 300, 400].forEach(function (percentage) {
    const preset = String(percentage);
    const range = service.getPresetWindow(preset, fitted, center);
    assert.strictEqual(range.end.getTime() - range.start.getTime(), fittedDuration / (percentage / 100));
    assert.strictEqual((range.start.getTime() + range.end.getTime()) / 2, center.getTime());
    assert.strictEqual(service.identifyPreset(range.start, range.end, fitted), preset);
});

assert.strictEqual(service.getPresetWindow("custom", fitted, center), null);
assert.strictEqual(service.getPresetWindow("200", {}, center), null);
assert.strictEqual(service.identifyPreset(new Date(0), new Date(123456), fitted), "custom");
assert.strictEqual(service.identifyPreset(fitted.end, fitted.start, fitted), "custom");

console.log("timeline zoom tests passed");
