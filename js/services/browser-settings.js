define([], function () {
    const global = (function () { return this; })();
    const prefix = "querygantt";

    /**
     * Converts a key segment to a stable value that cannot collide with the
     * separators used by this service.
     */
    const normalizeSegment = function (value) {
        return encodeURIComponent((value === null || typeof(value) === "undefined" ? "default" : value) + "");
    };


    /**
     * Builds a setting key scoped to the installed extension, project, and an
     * optional query. The extension id keeps the public and internal builds
     * independent even when they are opened in the same browser profile.
     */
    const getKey = function (extensionId, projectId, name, queryId) {
        const segments = [prefix, extensionId, projectId, name].map(normalizeSegment);
        if (queryId !== null && typeof(queryId) !== "undefined") {
            segments.push(normalizeSegment(queryId));
        }
        return segments.join(":");
    };


    const getStorage = function (storage) {
        if (storage) {
            return storage;
        }
        try {
            return global.localStorage;
        }
        catch (error) {
            return null;
        }
    };


    /**
     * Reads JSON data from browser-local storage. Storage access is guarded
     * because it can be disabled by browser privacy policy.
     */
    const read = function (extensionId, projectId, name, queryId, storage) {
        storage = getStorage(storage);
        if (!storage || typeof(storage.getItem) !== "function") {
            return null;
        }

        try {
            const value = storage.getItem(getKey(extensionId, projectId, name, queryId));
            return value === null ? null : JSON.parse(value);
        }
        catch (error) {
            console.warn("Browser settings could not be read.");
            console.warn(error);
            return null;
        }
    };


    /**
     * Writes JSON data to browser-local storage.
     */
    const write = function (extensionId, projectId, name, queryId, value, storage) {
        storage = getStorage(storage);
        if (!storage || typeof(storage.setItem) !== "function") {
            return false;
        }

        try {
            storage.setItem(getKey(extensionId, projectId, name, queryId), JSON.stringify(value));
            return true;
        }
        catch (error) {
            console.warn("Browser settings could not be saved.");
            console.warn(error);
            return false;
        }
    };


    return {
        getKey,
        read,
        write
    };
});
