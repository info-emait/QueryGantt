define([], function () {
    const day = "day";
    const time = "time";
    const dayMilliseconds = 24 * 60 * 60 * 1000;
    const dayLabelWidth = 70;

    /**
     * Returns a supported date granularity.
     *
     * @param {string} value Date granularity.
     */
    const normalize = function (value) {
        return value === day ? day : time;
    };


    /**
     * Returns true when the value is a valid Date.
     *
     * @param {*} value Value to check.
     */
    const isValidDate = function (value) {
        return value instanceof Date && !isNaN(value.getTime());
    };


    /**
     * Clones a date and aligns it to the start of its local calendar day.
     *
     * @param {Date} value Date to align.
     */
    const startOfDay = function (value) {
        const result = new Date(value.getTime());
        result.setHours(0, 0, 0, 0);
        return result;
    };


    /**
     * Gets the minimum visible interval that keeps vis-timeline on a calendar
     * day scale. The value grows with the chart width so zooming cannot expose
     * an hour/minute axis on wide screens.
     *
     * @param {string} granularity Date granularity.
     * @param {number} width Timeline width in pixels.
     */
    const getZoomMin = function (granularity, width) {
        if (normalize(granularity) !== day) {
            return null;
        }

        width = Number(width);
        if (!isFinite(width) || width <= 0) {
            return dayMilliseconds;
        }

        // vis-timeline targets about seven characters per minor label. At
        // roughly 3/4 day per label slot its finest automatic scale is Day.
        return Math.max(dayMilliseconds, Math.ceil((width / dayLabelWidth) * 0.75) * dayMilliseconds);
    };


    /**
     * Creates the inclusive range used by vis-timeline.
     *
     * @param {Date} startDate Work Item Start Date.
     * @param {Date} targetDate Work Item Target Date.
     * @param {Date} now Fallback date.
     * @param {string} granularity Date granularity.
     */
    const getTimelineRange = function (startDate, targetDate, now, granularity) {
        const fallback = isValidDate(now) ? now : new Date();
        const sourceStart = isValidDate(startDate) ? startDate : isValidDate(targetDate) ? targetDate : fallback;
        const sourceEnd = isValidDate(targetDate) ? targetDate : isValidDate(startDate) ? startDate : fallback;
        let start = new Date(sourceStart.getTime());
        let end = new Date(sourceEnd.getTime());

        if (normalize(granularity) === day) {
            start = startOfDay(start);
            end = startOfDay(end);
        }

        // Target Date is inclusive in Query Gantt, while vis-timeline ranges
        // use an exclusive end.
        end.setDate(end.getDate() + 1);

        return { start, end };
    };


    /**
     * Gets the inclusive duration in days.
     *
     * @param {Date} startDate Work Item Start Date.
     * @param {Date} targetDate Work Item Target Date.
     * @param {string} granularity Date granularity.
     */
    const getDuration = function (startDate, targetDate, granularity) {
        if (!isValidDate(startDate) || !isValidDate(targetDate)) {
            return 0;
        }

        if (normalize(granularity) === day) {
            const startDay = Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
            const targetDay = Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());

            if (startDay > targetDay) {
                return 0;
            }

            return Math.round((targetDay - startDay) / (1000 * 60 * 60 * 24)) + 1;
        }

        const startTime = startDate.getTime();
        const targetTime = targetDate.getTime();

        if (startTime > targetTime) {
            return 0;
        }

        return Math.ceil((targetTime - startTime) / (1000 * 60 * 60 * 24)) + 1;
    };


    return {
        day,
        time,
        dayMilliseconds,
        normalize,
        startOfDay,
        getZoomMin,
        getTimelineRange,
        getDuration
    };
});
