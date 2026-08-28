define([], function () {
    const minListWidth = 240;
    const minTimelineWidth = 320;
    const narrowListRatio = 0.3;
    const narrowTimelineRatio = 0.3;
    const keyboardStep = 16;


    /**
     * Normalizes a persisted or user supplied list width.
     */
    const normalize = function (value) {
        const result = Number(value);
        return Number.isFinite(result) && result > 0 ? Math.round(result) : null;
    };


    /**
     * Returns the usable list-width range for the available component width.
     * On very narrow screens fixed desktop minimums cannot both fit, so both
     * panes retain at least 30 percent of the available space.
     */
    const getBounds = function (totalWidth) {
        totalWidth = normalize(totalWidth);
        if (totalWidth === null) {
            return null;
        }

        if (totalWidth >= minListWidth + minTimelineWidth) {
            return {
                min: minListWidth,
                max: totalWidth - minTimelineWidth
            };
        }

        return {
            min: Math.round(totalWidth * narrowListRatio),
            max: Math.round(totalWidth * (1 - narrowTimelineRatio))
        };
    };


    /**
     * Keeps a requested width inside the currently usable range.
     */
    const clamp = function (value, totalWidth) {
        value = normalize(value);
        const bounds = getBounds(totalWidth);
        if (value === null || bounds === null) {
            return null;
        }
        return Math.max(bounds.min, Math.min(bounds.max, value));
    };


    return {
        minListWidth,
        minTimelineWidth,
        keyboardStep,
        normalize,
        getBounds,
        clamp
    };
});
