"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const observable = function (initial) {
    const result = function (value) {
        if (arguments.length) {
            initial = value;
            return result;
        }
        return initial;
    };
    result.__observable = true;
    result.extend = function () { return result; };
    result.peek = function () { return initial; };
    result.subscribe = function () { return { dispose: function () {} }; };
    result.dispose = function () {};
    return result;
};

const knockout = {
    observable: observable,
    observableArray: observable,
    isObservable: function (value) { return Boolean(value && value.__observable); },
    isObservableArray: function (value) { return Boolean(value && value.__observable); },
    computed: function () { return observable(null); },
    computedContext: { isInitial: function () { return false; } },
    components: { register: function () {} },
    applyBindings: function () {}
};

const loadService = function () {
    let result = null;
    const filename = path.join(__dirname, "../js/services/timeline-zoom.js");
    const source = fs.readFileSync(filename, "utf8");
    vm.runInNewContext(source, {
        Date: Date,
        define: function (dependencies, factory) { result = factory(); },
        isNaN: isNaN
    }, { filename: path.basename(filename) });
    return result;
};

const loadAmd = function (filename, dependencies, exposeModel) {
    let result = null;
    let readyCallback = null;
    let source = fs.readFileSync(filename, "utf8");

    if (exposeModel) {
        source = source.replace(/\n\}\);\s*$/, "\n    return { Model: Model };\n});\n");
    }
    else {
        source = "String.prototype.truncate = function () { return this.toString(); };\n" + source;
    }

    const document = {
        readyState: "loading",
        addEventListener: function (name, callback) {
            if (name === "DOMContentLoaded") {
                readyCallback = callback;
            }
        },
        head: {
            querySelectorAll: function () { return []; },
            appendChild: function () {}
        },
        createElement: function () {
            return {
                classList: { add: function () {} },
                setAttribute: function () {},
                querySelector: function () { return { addEventListener: function () {} }; },
                innerHTML: "",
                style: {}
            };
        },
        querySelector: function () { return null; }
    };

    vm.runInNewContext(source, {
        Array: Array,
        Date: Date,
        Map: Map,
        Number: Number,
        Promise: Promise,
        Set: Set,
        console: { debug: function () {}, log: function () {}, warn: function () {} },
        define: function (names, factory) {
            result = factory.apply(null, names.map(function (name) { return dependencies[name] || {}; }));
        },
        document: document,
        fetch: function () { throw new Error("Unexpected fetch"); },
        isNaN: isNaN
    }, { filename: path.basename(filename) });

    return {
        result: result,
        runReady: function () {
            if (readyCallback) {
                readyCallback();
            }
        }
    };
};

const plain = function (value) {
    return JSON.parse(JSON.stringify(value));
};

const zoomService = loadService();

let timelineRegistration = null;
const timelineKnockout = Object.assign({}, knockout, {
    components: {
        register: function (name, registration) {
            if (name === "my-timeline") {
                timelineRegistration = registration;
            }
        }
    }
});

const DataSet = function (data) {
    this.data = data;
};
DataSet.prototype.forEach = function (callback) { this.data.forEach(callback); };
DataSet.prototype.getIds = function () { return this.data.map(function (item) { return item.id; }); };
DataSet.prototype.update = function () {};

let latestTimeline = null;
const TimelineStub = function () {
    this.window = {
        start: new Date("2026-07-01T00:00:00.000Z"),
        end: new Date("2026-10-01T00:00:00.000Z")
    };
    this.handlers = {};
    this.selection = [];
    latestTimeline = this;
};
TimelineStub.prototype.getWindow = function () {
    return { start: new Date(this.window.start), end: new Date(this.window.end) };
};
TimelineStub.prototype.setWindow = function (start, end) {
    if (arguments.length === 1) {
        end = start.end;
        start = start.start;
    }
    this.window = { start: new Date(start), end: new Date(end) };
};
TimelineStub.prototype.fit = function () {
    this.window = {
        start: new Date("2026-07-01T00:00:00.000Z"),
        end: new Date("2026-10-01T00:00:00.000Z")
    };
};
TimelineStub.prototype.zoomIn = function () {};
TimelineStub.prototype.zoomOut = function () {};
TimelineStub.prototype.focus = function () {};
TimelineStub.prototype.getSelection = function () { return this.selection; };
TimelineStub.prototype.setSelection = function (selection) { this.selection = selection; };
TimelineStub.prototype.on = function (name, callback) { this.handlers[name] = callback; };
TimelineStub.prototype.emit = function (name, value) { this.handlers[name](value); };
TimelineStub.prototype.destroy = function () {};

loadAmd(path.join(__dirname, "../js/components/timeline.js"), {
    knockout: timelineKnockout,
    "services/timeline-zoom": zoomService,
    "vis-timeline": { DataSet: DataSet, Timeline: TimelineStub },
    "vis-timeline-arrow": function () {}
}, false);

const makeItem = function () {
    return {
        id: 1,
        parentId: null,
        parentTitle: "",
        project: "Project",
        areaPath: "Project",
        nodeName: "Project",
        remainingWork: 0,
        completedWork: 0,
        effort: 0,
        iterationPath: "Project",
        isCompleted: false,
        childCount: 0,
        childCompletedCount: 0,
        assignedTo: "",
        url: "https://example.test/_apis/wit/workItems/1",
        level: 1,
        path: "1",
        parent: "",
        title: "Item 1",
        type: "Task",
        state: "New",
        priority: 2,
        tags: [],
        dependencies: [],
        startDate: new Date("2026-07-01T00:00:00.000Z"),
        targetDate: new Date("2026-10-01T00:00:00.000Z")
    };
};

const zoomChanges = [];
const restoredStart = "2026-08-18T00:00:00.000Z";
const restoredEnd = "2026-08-25T00:00:00.000Z";
const timelineViewModel = timelineRegistration.viewModel.createViewModel({
    items: observable([makeItem()]),
    states: observable([]),
    priorities: observable([]),
    types: observable([]),
    typesOther: observable([]),
    icons: observable({}),
    showFields: observable([]),
    zoomView: observable({ preset: "custom", start: restoredStart, end: restoredEnd }),
    callbacks: {
        zoomChanged: function (view) { zoomChanges.push(view); }
    },
    actions: {}
}, { element: { querySelector: function () {}, firstChild: {} } });

timelineViewModel._onItemsChanged();
assert.strictEqual(latestTimeline.window.start.toISOString(), restoredStart, "the saved visible start should be restored after the initial fit");
assert.strictEqual(latestTimeline.window.end.toISOString(), restoredEnd, "the saved visible end should be restored after the initial fit");

latestTimeline.emit("rangechanged", latestTimeline.getWindow());
assert.strictEqual(zoomChanges.length, 0, "restoring a window should not write the same setting back");

const centerBeforeDay = (latestTimeline.window.start.getTime() + latestTimeline.window.end.getTime()) / 2;
timelineViewModel.setZoomPreset("day");
assert.strictEqual(latestTimeline.window.end.getTime() - latestTimeline.window.start.getTime(), zoomService.durations.day);
assert.strictEqual((latestTimeline.window.start.getTime() + latestTimeline.window.end.getTime()) / 2, centerBeforeDay, "preset jumps should preserve the current center");
latestTimeline.emit("rangechanged", latestTimeline.getWindow());
assert.strictEqual(zoomChanges[0].preset, "day");

const pannedWeek = {
    start: new Date("2026-09-01T00:00:00.000Z"),
    end: new Date("2026-09-08T00:00:00.000Z")
};
latestTimeline.emit("rangechanged", pannedWeek);
assert.strictEqual(zoomChanges[1].preset, "week", "panning should retain the matching named zoom level");

const manualRange = {
    start: new Date("2026-09-01T00:00:00.000Z"),
    end: new Date("2026-09-04T00:00:00.000Z")
};
latestTimeline.emit("rangechanged", manualRange);
assert.strictEqual(zoomChanges[2].preset, "custom", "an arbitrary manual zoom should be represented as Custom");

timelineViewModel.setZoomPreset("fit");
latestTimeline.emit("rangechanged", latestTimeline.getWindow());
assert.strictEqual(zoomChanges[3].preset, "fit");
assert.deepStrictEqual(plain(zoomChanges[3]), { preset: "fit", start: null, end: null }, "fit-all should remain data-relative rather than storing stale dates");

let persisted = JSON.stringify({
    showFields: ["duration"],
    orderMode: "backlog",
    dateGranularity: "day",
    zoomViews: {
        "other-query": { preset: "month", start: "2026-01-01T00:00:00.000Z", end: "2026-01-31T00:00:00.000Z" }
    }
});
const writes = [];
const settingsManager = {
    getValue: function () { return Promise.resolve(persisted); },
    setValue: function (key, value, options) {
        persisted = value;
        writes.push({ key: key, value: JSON.parse(value), options: options });
        return Promise.resolve();
    }
};

const appModule = loadAmd(path.join(__dirname, "../js/querygantt-tab-app.js"), {
    module: { config: function () { return { priorities: [], fields: [] }; } },
    knockout: knockout,
    sdk: {},
    "services/timeline-zoom": zoomService
}, true).result;
const appModel = new appModule.Model({
    version: "1.0.0",
    priorities: [],
    fields: [],
    user: "User",
    project: { id: "project-id", name: "Project" },
    query: { id: "query-a", name: "Query A" },
    manager: settingsManager,
    settingsKey: "gantt_project-id",
    settings: { showFields: ["stale-value"] },
    zoomView: { preset: "fit" }
});

let selectedPreset = null;
appModel._timeline_setZoomPresetAction(function (preset) { selectedPreset = preset; });
appModel.zoomPreset("week");
appModel.applyZoomPreset();
assert.strictEqual(selectedPreset, "week", "the toolbar dropdown should invoke the timeline preset action");

let configurationWrite = null;
let panelResult = null;
const configurationManager = {
    getValue: function () { return Promise.resolve(persisted); },
    setValue: function (key, value, options) {
        configurationWrite = { key: key, value: JSON.parse(value), options: options };
        return Promise.resolve();
    }
};
const configurationModule = loadAmd(path.join(__dirname, "../js/querygantt-configuration-app.js"), {
    module: { config: function () { return {}; } },
    knockout: knockout,
    sdk: {},
    "api/index": { CommonServiceIds: {} },
    "services/data": { getManager: function () { return Promise.resolve(configurationManager); } }
}, true).result;
const configurationModel = new configurationModule.Model({
    project: { id: "project-id" },
    fields: [],
    fieldsValue: ["dates", "duration"],
    panel: { close: function (result) { panelResult = result; } }
});

let startupModel = null;
const pageService = { getProject: function () { return Promise.resolve({ id: "project-id", name: "Project" }); } };
const navigationService = { getQueryParams: function () { return Promise.resolve({}); } };
const commonServiceIds = {
    ProjectPageService: "project-page",
    HostNavigationService: "navigation"
};
const startupManager = {
    getValue: function () {
        return Promise.resolve(JSON.stringify({
            showFields: ["duration"],
            zoomViews: {
                "query-a": { preset: "week", start: restoredStart, end: restoredEnd },
                "query-b": { preset: "day", start: "2026-09-01T00:00:00.000Z", end: "2026-09-02T00:00:00.000Z" }
            }
        }));
    }
};
const startupSdk = {
    init: function () {},
    ready: function () { return Promise.resolve(); },
    getService: function (id) {
        if (id === commonServiceIds.ProjectPageService) { return Promise.resolve(pageService); }
        if (id === commonServiceIds.HostNavigationService) { return Promise.resolve(navigationService); }
        throw new Error("Unexpected service: " + id);
    },
    getConfiguration: function () { return { query: { id: "query-a", name: "Query A" } }; },
    getUser: function () { return { displayName: "User" }; },
    notifyLoadSucceeded: function () {},
    register: function () {}
};
const startupKnockout = Object.assign({}, knockout, {
    applyBindings: function (model) { startupModel = model; }
});
const startupLoader = loadAmd(path.join(__dirname, "../js/querygantt-tab-app.js"), {
    module: { config: function () { return { priorities: [], fields: [] }; } },
    knockout: startupKnockout,
    sdk: startupSdk,
    "api/index": { CommonServiceIds: commonServiceIds },
    "api/WorkItemTracking/index": {},
    "services/data": { getManager: function () { return Promise.resolve(startupManager); } },
    "services/timeline-zoom": zoomService
}, true);
startupLoader.result.Model.prototype.init = function () { return Promise.resolve(); };

(async function () {
    await appModel.zoomChanged({
        preset: "custom",
        start: "2026-08-20T00:00:00.000Z",
        end: "2026-08-23T00:00:00.000Z"
    });
    assert.strictEqual(writes.length, 1);
    assert.deepStrictEqual(plain(writes[0]), {
        key: "gantt_project-id",
        value: {
            showFields: ["duration"],
            orderMode: "backlog",
            dateGranularity: "day",
            zoomViews: {
                "other-query": { preset: "month", start: "2026-01-01T00:00:00.000Z", end: "2026-01-31T00:00:00.000Z" },
                "query-a": { preset: "custom", start: "2026-08-20T00:00:00.000Z", end: "2026-08-23T00:00:00.000Z" }
            }
        },
        options: { scopeType: "User" }
    }, "zoom saves should merge the latest settings and leave other queries and features untouched");

    await configurationModel.save();
    assert.deepStrictEqual(plain(configurationWrite.value.zoomViews), plain(writes[0].value.zoomViews), "saving visible fields should preserve every query's zoom setting");
    assert.deepStrictEqual(plain(configurationWrite.value.showFields), ["dates", "duration"]);
    assert.deepStrictEqual(plain(panelResult), { fieldsValue: ["dates", "duration"] });

    startupLoader.runReady();
    await new Promise(function (resolve) { setImmediate(resolve); });
    assert.ok(startupModel, "the tab should initialize from persisted settings");
    assert.strictEqual(startupModel.zoomPreset(), "week");
    assert.strictEqual(startupModel.zoomView().start.toISOString(), restoredStart, "the current query should restore its own saved range");
    assert.strictEqual(startupModel.zoomView().end.toISOString(), restoredEnd);

    console.log("querygantt zoom integration tests passed");
})().catch(function (error) {
    console.error(error);
    process.exitCode = 1;
});
