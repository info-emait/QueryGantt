define([], function () {
    const global = (function () { return this; })();
    const prefix = "querygantt";

    const normalizeSegment = function (value) {
        return encodeURIComponent((value === null || typeof(value) === "undefined" ? "default" : value) + "");
    };

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

    return { getKey, read, write };
});
