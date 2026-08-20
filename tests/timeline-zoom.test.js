"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const loadService = function () {
    let result = null;
    const filename = path.join(__dirname, "../js/services/timeline-zoom.js");
    const source = fs.readFileSync(filename, "utf8");

    vm.runInNewContext(source, {
        Date: Date,
        define: function (dependencies, factory) {
            result = factory();
        },
        isNaN: isNaN
    }, { filename: path.basename(filename) });

    return result;
};

const plain = function (value) {
    return JSON.parse(JSON.stringify(value));
};

const service = loadService();
const hour = 60 * 60 * 1000;
const center = new Date("2026-08-21T12:00:00.000Z");

assert.strictEqual(service.normalizePreset("fit"), "fit");
assert.strictEqual(service.normalizePreset("month"), "month");
assert.strictEqual(service.normalizePreset("week"), "week");
assert.strictEqual(service.normalizePreset("day"), "day");
assert.strictEqual(service.normalizePreset("custom"), "custom");
assert.strictEqual(service.normalizePreset("unsupported"), "fit", "unknown presets should safely fall back to fit-all");

assert.deepStrictEqual(plain(service.normalizeView()), {
    preset: "fit",
    start: null,
    end: null
}, "missing saved data should retain the current fit-all behavior");
assert.deepStrictEqual(plain(service.normalizeView({ preset: "custom", start: "invalid", end: "invalid" })), {
    preset: "fit",
    start: null,
    end: null
}, "an invalid custom range should safely fall back to fit-all");

const restored = service.normalizeView({
    preset: "custom",
    start: "2026-08-18T00:00:00.000Z",
    end: "2026-08-25T00:00:00.000Z"
});
assert.ok(restored.start instanceof Date);
assert.ok(restored.end instanceof Date);
assert.deepStrictEqual(plain(service.serializeView(restored)), {
    preset: "custom",
    start: "2026-08-18T00:00:00.000Z",
    end: "2026-08-25T00:00:00.000Z"
}, "saved ranges should round-trip as ISO strings");
assert.deepStrictEqual(plain(service.serializeView({
    preset: "fit",
    start: "2026-08-18T00:00:00.000Z",
    end: "2026-08-25T00:00:00.000Z"
})), { preset: "fit" }, "fit-all should be recalculated from current work items after reload");

[
    ["month", 30 * 24 * hour],
    ["week", 7 * 24 * hour],
    ["day", 24 * hour]
].forEach(function (entry) {
    const range = service.getPresetWindow(entry[0], center);
    assert.strictEqual(range.end.getTime() - range.start.getTime(), entry[1], entry[0] + " should use the documented window size");
    assert.strictEqual((range.start.getTime() + range.end.getTime()) / 2, center.getTime(), entry[0] + " should retain the visible center");
    assert.strictEqual(service.identifyPreset(range.start, range.end), entry[0]);
});

assert.strictEqual(service.getPresetWindow("fit", center), null);
assert.strictEqual(service.getPresetWindow("day", "invalid"), null);
assert.strictEqual(service.identifyPreset(new Date(0), new Date(3 * 24 * hour)), "custom");
assert.strictEqual(service.identifyPreset(new Date(0), new Date(24 * hour + 30 * 1000)), "day", "minor range rounding should not hide a named preset");
assert.strictEqual(service.identifyPreset(new Date(24 * hour), new Date(0)), "custom");

console.log("timeline zoom tests passed");
