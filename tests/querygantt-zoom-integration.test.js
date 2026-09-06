"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const browserValues = new Map();
const browserStorage = {
    getItem: function (key) { return browserValues.has(key) ? browserValues.get(key) : null; },
    setItem: function (key, value) { browserValues.set(key, value); }
};

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

const makeDocument = function () {
    return {
        readyState: "loading",
        _ready: null,
        addEventListener: function (name, callback) {
            if (name === "DOMContentLoaded") { this._ready = callback; }
        },
        querySelector: function () { return null; },
        head: { querySelectorAll: function () { return []; }, appendChild: function () {} },
        createElement: function () {
            return {
                classList: { add: function () {} },
                style: {},
                innerHTML: "",
                setAttribute: function () {},
                querySelector: function () { return null; }
            };
        }
    };
};

const loadService = function (name) {
    let result = null;
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/services/" + name + ".js"), "utf8"), {
        Date: Date,
        Map: Map,
        Number: Number,
        console: { warn: function () {} },
        define: function (dependencies, factory) { result = factory(); },
        encodeURIComponent: encodeURIComponent,
        isNaN: isNaN,
        localStorage: browserStorage
    }, { filename: name + ".js" });
    return result;
};

const loadAmd = function (filename, dependencies, exposeModel) {
    let result = null;
    let source = fs.readFileSync(filename, "utf8");
    if (exposeModel) {
        source = source.replace(/\n\}\);\s*$/, "\n    return { Model: Model };\n});\n");
    }
    else {
        source = "String.prototype.truncate = function () { return this.toString(); };\n" + source;
    }

    const document = makeDocument();
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
        isNaN: isNaN,
        localStorage: browserStorage
    }, { filename: path.basename(filename) });

    return {
        result: result,
        runReady: function () { if (document._ready) { document._ready(); } }
    };
};

const plain = function (value) { return JSON.parse(JSON.stringify(value)); };
const zoomService = loadService("timeline-zoom");
const browserSettingsService = loadService("browser-settings");

let timelineRegistration = null;
const timelineKnockout = Object.assign({}, knockout, {
    components: {
        register: function (name, registration) {
            if (name === "my-timeline") { timelineRegistration = registration; }
        }
    }
});

const DataSet = function (data) { this.data = data; };
DataSet.prototype.forEach = function (callback) { this.data.forEach(callback); };
DataSet.prototype.getIds = function () { return this.data.map(function (item) { return item.id; }); };
DataSet.prototype.update = function () {};

let latestTimeline = null;
const TimelineStub = function (node, records, groups, options) {
    // vis-timeline exposes a provisional window before its asynchronous
    // automatic fit completes.
    this.window = {
        start: new Date("2026-08-20T00:00:00.000Z"),
        end: new Date("2026-08-26T00:00:00.000Z")
    };
    this.fitWindow = {
        start: new Date("2026-07-01T00:00:00.000Z"),
        end: new Date("2026-10-01T00:00:00.000Z")
    };
    this.handlers = {};
    this.options = options;
    this.selection = [];
    this.body = { domProps: { center: { width: 420 } } };
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
    this.window = { start: new Date(this.fitWindow.start), end: new Date(this.fitWindow.end) };
};
TimelineStub.prototype.moveTo = function (time, options) {
    const duration = this.window.end.getTime() - this.window.start.getTime();
    const center = new Date(time).getTime();
    this.moveToTime = new Date(time);
    this.moveToOptions = options;
    this.window = {
        start: new Date(center - duration / 2),
        end: new Date(center + duration / 2)
    };
};
TimelineStub.prototype.zoomIn = function () {};
TimelineStub.prototype.zoomOut = function () {};
TimelineStub.prototype.focus = function () {};
TimelineStub.prototype.getSelection = function () { return this.selection; };
TimelineStub.prototype.setSelection = function (value) { this.selection = value; };
TimelineStub.prototype.on = function (name, callback) { this.handlers[name] = callback; };
TimelineStub.prototype.emit = function (name, value) { this.handlers[name](value); };
TimelineStub.prototype.destroy = function () {};

loadAmd(path.join(__dirname, "../js/components/timeline.js"), {
    knockout: timelineKnockout,
    "services/timeline-zoom": zoomService,
    "vis-timeline": { DataSet: DataSet, Timeline: TimelineStub },
    "vis-timeline-arrow": function () {}
}, false);

const item = {
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

const changes = [];
const timelineViewModel = timelineRegistration.viewModel.createViewModel({
    items: observable([item]),
    states: observable([]),
    priorities: observable([]),
    types: observable([]),
    typesOther: observable([]),
    icons: observable({}),
    showFields: observable([]),
    zoomView: observable({
        preset: "custom",
        start: "2026-08-18T00:00:00.000Z",
        end: "2026-08-25T00:00:00.000Z"
    }),
    callbacks: { zoomChanged: function (view) { changes.push(view); } },
    actions: {}
}, { element: { querySelector: function () {}, firstChild: {} } });

timelineViewModel._onItemsChanged();
assert.strictEqual(typeof(latestTimeline.options.onInitialDrawComplete), "function");
assert.strictEqual(latestTimeline.window.start.toISOString(), "2026-08-20T00:00:00.000Z", "the provisional constructor window must not be restored against");

latestTimeline.window = latestTimeline.fitWindow;
latestTimeline.options.onInitialDrawComplete();
assert.strictEqual(latestTimeline.window.start.toISOString(), "2026-08-18T00:00:00.000Z", "the saved start should be restored after the automatic fit");
assert.strictEqual(latestTimeline.window.end.toISOString(), "2026-08-25T00:00:00.000Z", "the saved end should be restored after the automatic fit");

latestTimeline.emit("rangechanged", latestTimeline.getWindow());
assert.strictEqual(changes.length, 0, "restoring a saved range should not immediately rewrite it");

const fittedDuration = new Date("2026-10-01T00:00:00.000Z") - new Date("2026-07-01T00:00:00.000Z");
timelineViewModel.setZoomPreset("200");
assert.strictEqual(latestTimeline.window.end - latestTimeline.window.start, fittedDuration / 2, "200% should show half of the fitted range");
latestTimeline.emit("rangechanged", latestTimeline.getWindow());
assert.strictEqual(changes[0].preset, "200");

const arbitrary = {
    start: new Date("2026-09-01T00:00:00.000Z"),
    end: new Date("2026-09-04T00:00:00.000Z")
};
latestTimeline.emit("rangechanged", arbitrary);
assert.strictEqual(changes[1].preset, "custom", "free wheel, button, or pinch zoom should be recorded as Custom");

timelineViewModel.setZoomPreset("100");
latestTimeline.emit("rangechanged", latestTimeline.getWindow());
assert.strictEqual(changes[2].preset, "100");
assert.deepStrictEqual(plain(zoomService.serializeView(changes[2])), { preset: "100" });

const today = new Date("2026-09-02T12:00:00.000Z");
const beforeTodayWindow = latestTimeline.getWindow();
const beforeTodayDuration = beforeTodayWindow.end.getTime() - beforeTodayWindow.start.getTime();
timelineViewModel.moveToday(today);
const afterTodayWindow = latestTimeline.getWindow();
assert.strictEqual(latestTimeline.moveToTime.toISOString(), today.toISOString(), "Jump to today should center the visible range on today");
assert.deepStrictEqual(plain(latestTimeline.moveToOptions), { animation: false }, "Jump to today should move directly without altering the selected zoom preset");
assert.strictEqual(afterTodayWindow.end.getTime() - afterTodayWindow.start.getTime(), beforeTodayDuration,
    "Jump to today must retain the current zoom duration");
assert.strictEqual((afterTodayWindow.start.getTime() + afterTodayWindow.end.getTime()) / 2, today.getTime(),
    "Jump to today must place today at the center of the visible window");

timelineViewModel.setZoomPreset("daily");
const dailyDuration = latestTimeline.window.end - latestTimeline.window.start;
const dailyMinimumStep = dailyDuration * 70 / latestTimeline.body.domProps.center.width;
assert.ok(dailyMinimumStep > 12 * 60 * 60 * 1000 && dailyMinimumStep < 24 * 60 * 60 * 1000, "the 1 day option should use the drawable chart width and select daily labels");
latestTimeline.emit("rangechanged", latestTimeline.getWindow());
assert.strictEqual(changes[3].preset, "daily");

const extensionWrites = [];
const manager = {
    getValue: function () { return Promise.resolve(JSON.stringify({ showFields: ["duration"] })); },
    setValue: function (key, value) {
        extensionWrites.push({ key: key, value: value });
        return Promise.resolve();
    }
};
const appModule = loadAmd(path.join(__dirname, "../js/querygantt-tab-app.js"), {
    module: { config: function () { return { priorities: [], fields: [] }; } },
    knockout: knockout,
    sdk: {},
    "services/browser-settings": browserSettingsService,
    "services/timeline-zoom": zoomService
}, true).result;
const appModel = new appModule.Model({
    version: "1",
    priorities: [],
    fields: [],
    user: "User",
    project: { id: "project-id", name: "Project" },
    query: { id: "query-a", name: "Query A" },
    manager: manager,
    settingsKey: "gantt_project-id",
    extensionId: "publisher.internal",
    browserStorage: browserStorage,
    zoomView: { preset: "100" }
});

let moveTodayCalls = 0;
appModel._timeline_moveTodayAction(function () { moveTodayCalls += 1; });
appModel.moveToday();
assert.strictEqual(moveTodayCalls, 1, "the toolbar action should be forwarded to the timeline component");

let selectedPreset = null;
appModel._timeline_setZoomPresetAction(function (preset) { selectedPreset = preset; });
appModel.zoomPreset("100");
appModel.applyZoomPreset(appModel, { target: { value: "300" } });
assert.strictEqual(selectedPreset, "300", "the event value should be used before Knockout updates its value binding");
assert.strictEqual(appModel.zoomPreset(), "300");

(async function () {
    await appModel.zoomChanged({
        preset: "custom",
        start: "2026-08-20T00:00:00.000Z",
        end: "2026-08-23T00:00:00.000Z"
    });
    assert.deepStrictEqual(plain(browserSettingsService.read("publisher.internal", "project-id", "zoomView", "query-a", browserStorage)), {
        preset: "custom",
        start: "2026-08-20T00:00:00.000Z",
        end: "2026-08-23T00:00:00.000Z"
    });
    assert.strictEqual(extensionWrites.length, 0, "personal zoom should not be written to shared Azure Extension Data");

    await appModel.zoomChanged({
        preset: "400",
        start: "2026-08-20T00:00:00.000Z",
        end: "2026-08-21T00:00:00.000Z"
    });
    assert.deepStrictEqual(plain(browserSettingsService.read("publisher.internal", "project-id", "zoomView", "query-a", browserStorage)), { preset: "400" });

    browserSettingsService.write("publisher.extension", "project-id", "zoomView", "query-a", {
        preset: "custom",
        start: "2026-08-10T00:00:00.000Z",
        end: "2026-08-17T00:00:00.000Z"
    }, browserStorage);

    let startupModel = null;
    const commonServiceIds = { ProjectPageService: "project", HostNavigationService: "navigation" };
    const startupSdk = {
        init: function () {},
        ready: function () { return Promise.resolve(); },
        getService: function (id) {
            if (id === "project") {
                return Promise.resolve({ getProject: function () { return Promise.resolve({ id: "project-id", name: "Project" }); } });
            }
            if (id === "navigation") {
                return Promise.resolve({ getQueryParams: function () { return Promise.resolve({ showFields: "dates" }); } });
            }
            throw new Error("Unexpected service");
        },
        getConfiguration: function () { return { query: { id: "query-a", name: "Query A" } }; },
        getExtensionContext: function () { return { id: "publisher.extension" }; },
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
        "services/data": { getManager: function () { return Promise.resolve(manager); } },
        "services/browser-settings": browserSettingsService,
        "services/timeline-zoom": zoomService
    }, true);
    startupLoader.result.Model.prototype.init = function () { return Promise.resolve(); };
    startupLoader.runReady();
    await new Promise(function (resolve) { setImmediate(resolve); });

    assert.ok(startupModel, "the tab should initialize from persisted settings");
    assert.deepStrictEqual(plain(startupModel.showFields()), ["duration"], "saved visible columns should win over the stale query parameter written by a previous view");
    assert.strictEqual(startupModel.zoomPreset(), "custom");
    assert.strictEqual(startupModel.zoomView().start.toISOString(), "2026-08-10T00:00:00.000Z");
    assert.strictEqual(startupModel.zoomView().end.toISOString(), "2026-08-17T00:00:00.000Z");

    const html = fs.readFileSync(path.join(__dirname, "../html/querygantt-tab.html"), "utf8");
    ["Custom", "100%", "200%", "300%", "400%", "1 day"].forEach(function (label) {
        assert.ok(html.includes(">" + label + "</option>"));
    });
    assert.strictEqual(html.includes(">500%</option>"), false, "the zoom selector should stop at 400%");
    assert.ok(html.includes('title="Jump to today"') && html.includes("click: moveToday"), "the redundant zoom reset should be replaced by Jump to today");
    assert.strictEqual(html.includes("click: zoomReset"), false, "the toolbar should no longer expose a separate zoom reset action");
    console.log("querygantt zoom integration tests passed");
})().catch(function (error) {
    console.error(error);
    process.exitCode = 1;
});
