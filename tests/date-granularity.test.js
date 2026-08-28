"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const loadService = function () {
    let result = null;
    const filename = path.join(__dirname, "../js/services/date-granularity.js");
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

const assertLocalDate = function (actual, year, month, day, hour, minute, message) {
    assert.ok(actual instanceof Date, message);
    assert.deepStrictEqual([
        actual.getFullYear(),
        actual.getMonth(),
        actual.getDate(),
        actual.getHours(),
        actual.getMinutes(),
        actual.getSeconds(),
        actual.getMilliseconds()
    ], [year, month, day, hour, minute, 0, 0], message);
};

const service = loadService();
const early = new Date(2026, 7, 21, 1, 20, 0, 0);
const late = new Date(2026, 7, 21, 23, 50, 0, 0);
const earlyValue = early.getTime();
const lateValue = late.getTime();

assert.strictEqual(service.normalize("day"), "day");
assert.strictEqual(service.normalize("time"), "time");
assert.strictEqual(service.normalize("unsupported"), "time", "unknown values should retain the existing timestamp behavior");
assert.strictEqual(service.getZoomMin("time", 1200), null, "time mode should retain vis-timeline's native maximum zoom");
assert.strictEqual(service.getZoomMin("day", 0), 24 * 60 * 60 * 1000);
assert.ok(service.getZoomMin("day", 1200) >= 12 * 24 * 60 * 60 * 1000, "a wide chart should stop before its automatic axis reaches hours");

const earlyDayRange = service.getTimelineRange(early, early, new Date(), "day");
const lateDayRange = service.getTimelineRange(late, late, new Date(), "day");
assertLocalDate(earlyDayRange.start, 2026, 7, 21, 0, 0, "day mode should align an early timestamp to midnight");
assertLocalDate(earlyDayRange.end, 2026, 7, 22, 0, 0, "a same-day item should occupy one inclusive calendar day");
assert.strictEqual(earlyDayRange.start.getTime(), lateDayRange.start.getTime(), "timestamps on the same date should start at the same position");
assert.strictEqual(earlyDayRange.end.getTime(), lateDayRange.end.getTime(), "timestamps on the same date should have the same day-width bar");

const timeRange = service.getTimelineRange(early, early, new Date(), "time");
assertLocalDate(timeRange.start, 2026, 7, 21, 1, 20, "time mode should retain the Start Date time");
assertLocalDate(timeRange.end, 2026, 7, 22, 1, 20, "time mode should retain the current inclusive Target Date behavior");

const markerRange = service.getTimelineRange(null, late, new Date(), "day");
assertLocalDate(markerRange.start, 2026, 7, 21, 0, 0, "target-only markers should align to the target calendar day");

const snapped = service.startOfDay(new Date(2026, 7, 22, 16, 42, 13, 12));
assertLocalDate(snapped, 2026, 7, 22, 0, 0, "day snapping should clear the time component");

assert.strictEqual(service.getDuration(early, late, "day"), 1, "same-day timestamps should have a one-day duration");
assert.strictEqual(service.getDuration(late, early, "day"), 1, "day mode should ignore reversed times within the same calendar date");
assert.strictEqual(
    service.getDuration(new Date(2026, 7, 21, 23, 50), new Date(2026, 7, 22, 1, 20), "day"),
    2,
    "day duration should count inclusive calendar dates"
);
assert.strictEqual(service.getDuration(late, early, "time"), 0, "time mode should preserve the existing invalid-range check");
assert.strictEqual(service.getDuration(null, late, "day"), 0);

const daylightSavingRange = service.getTimelineRange(
    new Date(2026, 2, 8, 1, 30),
    new Date(2026, 2, 8, 1, 30),
    new Date(),
    "day"
);
assertLocalDate(daylightSavingRange.start, 2026, 2, 8, 0, 0, "day ranges should begin at local midnight across daylight-saving changes");
assertLocalDate(daylightSavingRange.end, 2026, 2, 9, 0, 0, "day ranges should end at the next local midnight across daylight-saving changes");

assert.strictEqual(early.getTime(), earlyValue, "range conversion must not mutate Start Date");
assert.strictEqual(late.getTime(), lateValue, "range conversion must not mutate Target Date");

console.log("date granularity tests passed");
