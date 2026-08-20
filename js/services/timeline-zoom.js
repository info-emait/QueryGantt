define([], function () {
    const fit = "fit";
    const month = "month";
    const week = "week";
    const day = "day";
    const custom = "custom";
    const dayMilliseconds = 24 * 60 * 60 * 1000;
    const durations = {
        month: 30 * dayMilliseconds,
        week: 7 * dayMilliseconds,
        day: dayMilliseconds
    };

    /**
     * Returns a supported zoom preset.
     *
     * @param {string} value Zoom preset.
     */
    const normalizePreset = function (value) {
        return [fit, month, week, day, custom].includes(value) ? value : fit;
    };


    /**
     * Converts a value to a valid Date or null.
     *
     * @param {*} value Date value.
     */
    const toDate = function (value) {
        if (value === null || typeof(value) === "undefined") {
            return null;
        }

        const result = value instanceof Date ? new Date(value.getTime()) : new Date(value);
        return isNaN(result.getTime()) ? null : result;
    };


    /**
     * Normalizes a persisted or live zoom view.
     *
     * @param {object} value Zoom view.
     */
    const normalizeView = function (value) {
        const preset = normalizePreset((value || {}).preset);
        const start = toDate((value || {}).start);
        const end = toDate((value || {}).end);

        if (preset === fit) {
            return { preset: fit, start: null, end: null };
        }

        if (start && end && start.getTime() < end.getTime()) {
            return { preset, start, end };
        }

        if (preset === custom) {
            return { preset: fit, start: null, end: null };
        }

        return { preset, start: null, end: null };
    };


    /**
     * Converts a zoom view to JSON-safe settings data.
     *
     * @param {object} value Zoom view.
     */
    const serializeView = function (value) {
        const view = normalizeView(value);
        const result = { preset: view.preset };

        if (view.start && view.end) {
            result.start = view.start.toISOString();
            result.end = view.end.toISOString();
        }

        return result;
    };


    /**
     * Gets a preset window around the supplied center.
     *
     * @param {string} preset Zoom preset.
     * @param {Date} center Visible window center.
     */
    const getPresetWindow = function (preset, center) {
        const normalizedPreset = normalizePreset(preset);
        const duration = durations[normalizedPreset];
        const normalizedCenter = toDate(center);

        if (!duration || !normalizedCenter) {
            return null;
        }

        const centerTime = normalizedCenter.getTime();
        return {
            start: new Date(centerTime - duration / 2),
            end: new Date(centerTime + duration / 2)
        };
    };


    /**
     * Identifies a preset from the visible window duration.
     *
     * @param {Date} start Visible start.
     * @param {Date} end Visible end.
     */
    const identifyPreset = function (start, end) {
        const normalizedStart = toDate(start);
        const normalizedEnd = toDate(end);

        if (!normalizedStart || !normalizedEnd || normalizedStart.getTime() >= normalizedEnd.getTime()) {
            return custom;
        }

        const duration = normalizedEnd.getTime() - normalizedStart.getTime();
        const match = Object.keys(durations).find((name) => Math.abs(duration - durations[name]) <= durations[name] * 0.005);
        return match || custom;
    };


    return {
        fit,
        month,
        week,
        day,
        custom,
        durations,
        normalizePreset,
        normalizeView,
        serializeView,
        getPresetWindow,
        identifyPreset
    };
});
