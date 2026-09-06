define([], function () {
    const custom = "custom";
    const percent100 = "100";
    const percent200 = "200";
    const percent300 = "300";
    const percent400 = "400";
    const daily = "daily";
    const presets = [percent100, percent200, percent300, percent400];
    const dayMilliseconds = 24 * 60 * 60 * 1000;
    const minorLabelWidth = 70;

    /**
     * Returns a supported zoom preset. Previous preset names are migrated
     * without losing an explicitly saved custom window.
     */
    const normalizePreset = function (value) {
        value = (value === null || typeof(value) === "undefined") ? "" : value + "";
        if (presets.includes(value) || value === custom || value === daily) {
            return value;
        }
        if (value === "500") {
            return percent400;
        }
        return value === "fit" ? percent100 : custom;
    };

    const toDate = function (value) {
        if (value === null || typeof(value) === "undefined") {
            return null;
        }
        const result = value instanceof Date ? new Date(value.getTime()) : new Date(value);
        return isNaN(result.getTime()) ? null : result;
    };

    const normalizeView = function (value) {
        value = value || {};
        const start = toDate(value.start);
        const end = toDate(value.end);
        let preset = normalizePreset(value.preset);

        // Old Month/Week/Day settings contain an exact window. Preserve it as
        // Custom because those names no longer map to a percentage.
        if (["month", "week", "day"].includes(value.preset) && start && end) {
            preset = custom;
        }

        if (start && end && start.getTime() < end.getTime()) {
            return { preset, start, end };
        }

        return {
            preset: preset === custom ? percent100 : preset,
            start: null,
            end: null
        };
    };

    /**
     * Percentage presets are data-relative; Custom retains its exact window.
     */
    const serializeView = function (value) {
        const view = normalizeView(value);
        const result = { preset: view.preset };
        if (view.preset === custom && view.start && view.end) {
            result.start = view.start.toISOString();
            result.end = view.end.toISOString();
        }
        return result;
    };

    const getFactor = function (preset) {
        preset = normalizePreset(preset);
        return presets.includes(preset) ? Number(preset) / 100 : null;
    };

    /**
     * Gets a percentage window from the fitted data range while retaining the
     * current visible center.
     */
    const getPresetWindow = function (preset, fittedRange, center, width) {
        preset = normalizePreset(preset);
        const factor = getFactor(preset);
        const start = toDate((fittedRange || {}).start);
        const end = toDate((fittedRange || {}).end);
        const normalizedCenter = toDate(center);

        // vis-timeline selects a one-day minor scale when the time represented
        // by one label is between half a day and one day. Use the actual chart
        // width (excluding row labels) and a small safety margin so every day
        // receives a label regardless of the selected field columns.
        if (preset === daily) {
            const centerTime = normalizedCenter
                ? normalizedCenter.getTime()
                : (start && end && start.getTime() < end.getTime()
                    ? (start.getTime() + end.getTime()) / 2
                    : null);
            if (centerTime === null) {
                return null;
            }
            const normalizedWidth = Number.isFinite(Number(width)) && Number(width) > 0
                ? Math.max(minorLabelWidth, Number(width))
                : minorLabelWidth * 10;
            const duration = dayMilliseconds * 0.7 * normalizedWidth / minorLabelWidth;
            return {
                start: new Date(centerTime - duration / 2),
                end: new Date(centerTime + duration / 2)
            };
        }

        if (!factor || !start || !end || start.getTime() >= end.getTime()) {
            return null;
        }

        const duration = (end.getTime() - start.getTime()) / factor;
        const centerTime = normalizedCenter
            ? normalizedCenter.getTime()
            : (start.getTime() + end.getTime()) / 2;
        return {
            start: new Date(centerTime - duration / 2),
            end: new Date(centerTime + duration / 2)
        };
    };

    /**
     * Identifies a percentage from the visible range relative to the fitted
     * data range. Arbitrary wheel, button, or pinch zooms are Custom.
     */
    const identifyPreset = function (start, end, fittedRange) {
        const normalizedStart = toDate(start);
        const normalizedEnd = toDate(end);
        const fittedStart = toDate((fittedRange || {}).start);
        const fittedEnd = toDate((fittedRange || {}).end);
        if (!normalizedStart || !normalizedEnd || !fittedStart || !fittedEnd
            || normalizedStart.getTime() >= normalizedEnd.getTime()
            || fittedStart.getTime() >= fittedEnd.getTime()) {
            return custom;
        }

        const duration = normalizedEnd.getTime() - normalizedStart.getTime();
        const fittedDuration = fittedEnd.getTime() - fittedStart.getTime();
        const match = presets.find((preset) => {
            const expected = fittedDuration / getFactor(preset);
            return Math.abs(duration - expected) <= expected * 0.005;
        });
        return match || custom;
    };

    return {
        custom,
        percent100,
        percent200,
        percent300,
        percent400,
        daily,
        presets,
        normalizePreset,
        normalizeView,
        serializeView,
        getFactor,
        getPresetWindow,
        identifyPreset
    };
});
