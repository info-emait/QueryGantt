"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const observable = function (initial) {
    const subscribers = [];
    const result = function (value) {
        if (arguments.length) {
            initial = value;
            subscribers.slice().forEach(function (subscriber) { subscriber(value); });
            return result;
        }
        return initial;
    };
    result.__observable = true;
    result.extend = function () { return result; };
    result.dispose = function () {};
    result.subscribe = function (subscriber) {
        subscribers.push(subscriber);
        return {
            dispose: function () {
                const index = subscribers.indexOf(subscriber);
                if (index >= 0) {
                    subscribers.splice(index, 1);
                }
            }
        };
    };
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
    const filename = path.join(__dirname, "../js/services/date-granularity.js");
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
        }
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
            result = factory.apply(null, names.map((name) => dependencies[name] || {}));
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

const dateGranularityService = loadService();

let timelineRegistration = null;
let timelineCaptures = [];
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
DataSet.prototype.getIds = function () { return this.data.map((item) => item.id); };
DataSet.prototype.update = function () {};

const TimelineStub = function (node, records, groups, options) {
    this.setOptionsCalls = [];
    this.window = { start: new Date("2026-08-01T00:00:00.000Z"), end: new Date("2026-09-01T00:00:00.000Z") };
    timelineCaptures.push({ node: node, records: records, groups: groups, options: options, instance: this });
};
TimelineStub.prototype.on = function () {};
TimelineStub.prototype.destroy = function () {};
TimelineStub.prototype.setOptions = function (options) { this.setOptionsCalls.push(options); };
TimelineStub.prototype.getWindow = function () { return this.window; };

loadAmd(path.join(__dirname, "../js/components/timeline.js"), {
    knockout: timelineKnockout,
    "services/date-granularity": dateGranularityService,
    "vis-timeline": { DataSet: DataSet, Timeline: TimelineStub },
    "vis-timeline-arrow": function () {}
}, false);

const makeItem = function (id, hour, minute) {
    return {
        id: id,
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
        url: "https://example.test/_apis/wit/workItems/" + id,
        level: 1,
        path: String(id),
        parent: "",
        title: "Item " + id,
        type: "Task",
        state: "New",
        priority: 2,
        tags: [],
        dependencies: [],
        startDate: new Date(2026, 7, 21, hour, minute),
        targetDate: new Date(2026, 7, 21, hour, minute)
    };
};

const granularity = observable("day");
const timelineNode = { clientWidth: 1200 };
const timelineViewModel = timelineRegistration.viewModel.createViewModel({
    items: observable([makeItem(1, 1, 20), makeItem(2, 23, 50)]),
    states: observable([]),
    priorities: observable([]),
    types: observable([]),
    typesOther: observable([]),
    icons: observable({}),
    showFields: observable([]),
    dateGranularity: granularity,
    actions: {}
}, { element: { querySelector: function () {}, firstChild: timelineNode } });

timelineViewModel._onItemsChanged();
let capture = timelineCaptures[timelineCaptures.length - 1];
assert.strictEqual(capture.records.data[0].start.getTime(), capture.records.data[1].start.getTime(), "the built timeline should align same-day timestamps");
assert.strictEqual(capture.records.data[0].end.getTime(), capture.records.data[1].end.getTime(), "the built timeline should render equal full-day bars");
assert.strictEqual(capture.groups.data[0].duration, 1);
assert.strictEqual(typeof capture.options.snap, "function", "day mode should configure day snapping");
assert.strictEqual(capture.options.snap(new Date(2026, 7, 21, 18, 30)).getHours(), 0);
assert.strictEqual(capture.options.zoomMin, dateGranularityService.getZoomMin("day", 1200), "day mode should cap the finest visible axis at calendar days");
timelineNode.clientWidth = 1800;
timelineViewModel._resizeTimeline();
assert.strictEqual(capture.instance.setOptionsCalls[0].zoomMin, dateGranularityService.getZoomMin("day", 1800), "the day cap should follow host panel resizes");

const insideElement = { style: {} };
const outsideElement = { style: {} };
capture.instance.itemSet = { items: {
    inside: { data: { start: new Date("2026-08-20T00:00:00.000Z"), end: new Date("2026-08-22T00:00:00.000Z") }, dom: { box: insideElement } },
    outside: { data: { start: new Date("2026-09-23T00:00:00.000Z"), end: new Date("2026-09-26T00:00:00.000Z") }, dom: { box: outsideElement } }
} };
timelineViewModel._syncRangeItemVisibility();
assert.strictEqual(insideElement.style.visibility, "", "a work item overlapping the visible date range should remain visible");
assert.strictEqual(outsideElement.style.visibility, "hidden", "a stale work item outside the visible date range should not remain pinned to an edge");
capture.instance.window = { start: new Date("2026-09-20T00:00:00.000Z"), end: new Date("2026-09-30T00:00:00.000Z") };
timelineViewModel._syncRangeItemVisibility();
assert.strictEqual(outsideElement.style.visibility, "", "the visibility guard should clear when the date range reaches the work item");

granularity("time");
timelineViewModel._onItemsChanged();
capture = timelineCaptures[timelineCaptures.length - 1];
assert.notStrictEqual(capture.records.data[0].start.getTime(), capture.records.data[1].start.getTime(), "time mode should retain timestamp offsets");
assert.strictEqual(Object.prototype.hasOwnProperty.call(capture.options, "snap"), false, "time mode should retain vis-timeline's existing snap behavior");
assert.strictEqual(Object.prototype.hasOwnProperty.call(capture.options, "zoomMin"), false, "time mode should permit the original hour/minute zoom");

const browserValues = new Map();
const browserStorage = {
    getItem: function (key) { return browserValues.has(key) ? browserValues.get(key) : null; },
    setItem: function (key, value) { browserValues.set(key, value); }
};
let browserSettingsService = null;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/services/browser-settings.js"), "utf8"), {
    console: { warn: function () {} },
    define: function (dependencies, factory) { browserSettingsService = factory(); },
    encodeURIComponent: encodeURIComponent,
    localStorage: browserStorage
});

let savedSettings = null;
let panelResult = null;
const settingsManager = {
    getValue: function () { return Promise.resolve(JSON.stringify({ orderMode: "backlog", customSetting: true })); },
    setValue: function (key, value, options) {
        savedSettings = { key: key, value: JSON.parse(value), options: options };
        return Promise.resolve();
    }
};
const configurationModule = loadAmd(path.join(__dirname, "../js/querygantt-configuration-app.js"), {
    module: { config: function () { return {}; } },
    knockout: knockout,
    sdk: {},
    "api/index": { CommonServiceIds: {} },
    "services/data": { getManager: function () { return Promise.resolve(settingsManager); } },
    "services/browser-settings": browserSettingsService,
    "services/date-granularity": dateGranularityService
}, true).result;
const configurationModel = new configurationModule.Model({
    project: { id: "project-id" },
    fields: [],
    fieldsValue: ["dates", "duration"],
    dateGranularity: "day",
    extensionId: "publisher.extension",
    browserStorage: browserStorage,
    panel: { close: function (result) { panelResult = result; } }
});

let openedPanel = null;
let startupModel = null;
const pageService = { getProject: function () { return Promise.resolve({ id: "project-id", name: "Project" }); } };
const navigationService = { getQueryParams: function () { return Promise.resolve({ showFields: "id" }); } };
const layoutService = { openPanel: function (id, options) { openedPanel = { id: id, options: options }; } };
const commonServiceIds = {
    ProjectPageService: "project-page",
    HostNavigationService: "navigation",
    HostPageLayoutService: "layout"
};
const sdk = {
    init: function () {},
    ready: function () { return Promise.resolve(); },
    getService: function (id) {
        if (id === commonServiceIds.ProjectPageService) { return Promise.resolve(pageService); }
        if (id === commonServiceIds.HostNavigationService) { return Promise.resolve(navigationService); }
        if (id === commonServiceIds.HostPageLayoutService) { return Promise.resolve(layoutService); }
        throw new Error("Unexpected service: " + id);
    },
    getConfiguration: function () { return { query: { id: "query-id", name: "Query" } }; },
    getExtensionContext: function () { return { id: "publisher.extension" }; },
    getUser: function () { return { displayName: "User" }; },
    notifyLoadSucceeded: function () {},
    register: function () {}
};
const startupSettingsManager = {
    getValue: function () { return Promise.resolve(JSON.stringify({ showFields: ["duration"], dateGranularity: "time" })); }
};
const appKnockout = Object.assign({}, knockout, {
    applyBindings: function (model) { startupModel = model; }
});
const appLoader = loadAmd(path.join(__dirname, "../js/querygantt-tab-app.js"), {
    module: { config: function () { return { priorities: [], fields: [] }; } },
    knockout: appKnockout,
    sdk: sdk,
    "api/index": { CommonServiceIds: commonServiceIds },
    "api/WorkItemTracking/index": {},
    "services/data": { getManager: function () { return Promise.resolve(startupSettingsManager); } },
    "services/browser-settings": browserSettingsService,
    "services/date-granularity": dateGranularityService
}, true);
appLoader.result.Model.prototype.init = function () { return Promise.resolve(); };

(async function () {
    await configurationModel.save();
    assert.deepStrictEqual(JSON.parse(JSON.stringify(savedSettings)), {
        key: "gantt_project-id",
        value: {
            orderMode: "backlog",
            customSetting: true,
            showFields: ["dates", "duration"]
        },
        options: { scopeType: "User" }
    }, "configuration saves should merge instead of overwriting other settings");
    assert.deepStrictEqual(JSON.parse(JSON.stringify(panelResult)), {
        fieldsValue: ["dates", "duration"],
        dateGranularity: "day"
    });

    appLoader.runReady();
    await new Promise((resolve) => setImmediate(resolve));
    assert.ok(startupModel, "the tab should initialize from persisted settings");
    assert.strictEqual(startupModel.dateGranularity(), "day", "the browser-local granularity should win over legacy shared settings");
    assert.deepStrictEqual(JSON.parse(JSON.stringify(startupModel.showFields())), ["duration"], "saved columns should not be replaced by a stale query-string value");

    startupModel.openSettings();
    await Promise.resolve();
    assert.strictEqual(openedPanel.options.configuration.dateGranularity, "day", "the configuration panel should receive the current granularity");
    assert.strictEqual(openedPanel.options.configuration.extensionId, "publisher.extension");
    openedPanel.options.onClose({ fieldsValue: ["dates"], dateGranularity: "time" });
    assert.strictEqual(startupModel.dateGranularity(), "time", "closing the panel should update the live timeline setting");
    assert.strictEqual(browserSettingsService.read("publisher.extension", "project-id", "dateGranularity", null, browserStorage), "time", "the last granularity should survive reloads in this browser profile");

    console.log("querygantt date granularity integration tests passed");
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
