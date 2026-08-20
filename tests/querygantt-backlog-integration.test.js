"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const loadAmd = function (filename, dependencies) {
    let result = null;
    let source = fs.readFileSync(filename, "utf8");
    source = source.replace(/\n\}\);\s*$/, "\n    return { Model: Model };\n});\n");
    const context = {
        console: {
            debug: function () {},
            log: function () {},
            warn: function () {}
        },
        document: {
            readyState: "loading",
            addEventListener: function () {}
        },
        fetch: function () { throw new Error("Unexpected fetch"); },
        Map: Map,
        Number: Number,
        Promise: Promise,
        Set: Set,
        define: function (names, factory) {
            result = factory.apply(null, names.map((name) => dependencies[name] || {}));
        }
    };
    vm.runInNewContext(source, context, { filename: path.basename(filename) });
    return result;
};

const loadBacklogService = function () {
    let result = null;
    const source = fs.readFileSync(path.join(__dirname, "../js/services/backlog-order.js"), "utf8");
    vm.runInNewContext(source, {
        define: function (dependencies, factory) { result = factory(); },
        Map: Map,
        Number: Number,
        Set: Set
    });
    return result;
};

const observable = function (initial) {
    return function (value) {
        if (arguments.length) {
            initial = value;
            return this;
        }
        return initial;
    };
};

const backlogOrderService = loadBacklogService();
const workApi = { WorkRestClient: function WorkRestClient() {} };
let workClient = null;
const api = {
    getClient: function (clientType) {
        assert.strictEqual(clientType, workApi.WorkRestClient, "the Work REST client should be requested");
        return workClient;
    },
    CommonServiceIds: {}
};
const app = loadAmd(path.join(__dirname, "../js/querygantt-tab-app.js"), {
    module: { config: function () { return {}; } },
    knockout: {},
    sdk: {},
    "api/index": api,
    "api/Work/index": workApi,
    "services/backlog-order": backlogOrderService
});
const Model = app.Model;
let settingsManager = null;
const configurationApp = loadAmd(path.join(__dirname, "../js/querygantt-configuration-app.js"), {
    module: { config: function () { return {}; } },
    knockout: {},
    sdk: {},
    "api/index": { CommonServiceIds: {} },
    "services/data": {
        getManager: function () { return Promise.resolve(settingsManager); }
    }
});

const backlogs = [
    { id: "features", rank: 2, isHidden: false, workItemTypes: [{ name: "Feature" }] },
    { id: "stories", rank: 1, isHidden: false, workItemTypes: [{ name: "User Story" }] },
    { id: "hidden", rank: 0, isHidden: true, workItemTypes: [{ name: "Task" }] }
];
const responses = {
    features: { workItems: [{ source: null, target: { id: 11 } }, { source: null, target: { id: 12 } }] },
    stories: { workItems: [{ source: { id: 11 }, target: { id: 1 } }, { source: { id: 11 }, target: { id: 2 } }, { source: { id: 12 }, target: { id: 3 } }] }
};

const makeModel = function () {
    const model = Object.create(Model.prototype);
    model.project = { id: "project-id", name: "Project" };
    model.team = { id: "team-id", name: "Team" };
    model._backlogRequestId = 0;
    model.backlogIndex = observable(backlogOrderService.empty());
    model.backlogAvailable = observable(false);
    model.backlogLoading = observable(false);
    model.orderMode = observable(backlogOrderService.queryOrder);
    model.message = observable("");
    model.isLoading = observable(false);
    return model;
};

(async function () {
    const fetchedBacklogs = [];
    workClient = {
        getBacklogs: function (context) {
            assert.deepStrictEqual(JSON.parse(JSON.stringify(context)), { projectId: "project-id", teamId: "team-id" });
            return Promise.resolve(backlogs);
        },
        getBacklogLevelWorkItems: function (context, backlogId) {
            fetchedBacklogs.push(backlogId);
            return Promise.resolve(responses[backlogId]);
        }
    };
    const successfulWorkClient = workClient;

    const model = makeModel();
    assert.strictEqual((await model._loadBacklogOrder(null)).size, 5, "current queries should load backlog order");
    assert.deepStrictEqual(fetchedBacklogs, ["features", "stories"], "hidden backlog levels should not be fetched");
    assert.strictEqual(model.backlogLoading(), false);
    assert.strictEqual(model.backlogAvailable(), true);
    assert.strictEqual(model.backlogIndex().size, 5);

    fetchedBacklogs.length = 0;
    assert.strictEqual((await model._loadBacklogOrder("2026-01-01")).size, 0, "historical queries should not load current backlog state");
    assert.deepStrictEqual(fetchedBacklogs, []);
    assert.strictEqual(model.backlogAvailable(), false);

    let resolveBacklogs = null;
    const delayedBacklogs = new Promise((resolve) => resolveBacklogs = resolve);
    const raceModel = makeModel();
    workClient = {
        getBacklogs: function () { return delayedBacklogs; },
        getBacklogLevelWorkItems: function (context, backlogId) { return Promise.resolve(responses[backlogId]); }
    };
    const currentLoad = raceModel._loadBacklogOrder(null);
    await raceModel._loadBacklogOrder("2026-01-01");
    resolveBacklogs(backlogs);
    assert.strictEqual((await currentLoad).size, 0, "a stale current-order request should be ignored after switching to a historical query");
    assert.strictEqual(raceModel.backlogAvailable(), false, "stale data must not enable drag operations on a historical query");

    workClient = successfulWorkClient;
    await model._loadBacklogOrder(null);
    const entry1 = backlogOrderService.getEntry(model.backlogIndex(), 1, "User Story");
    const entry2 = backlogOrderService.getEntry(model.backlogIndex(), 2, "User Story");
    const story1 = { id: 1, originalId: 1, type: "User Story", backlogOrder: Object.assign({ eligible: true }, entry1) };
    const story2 = { id: 2, originalId: 2, type: "User Story", backlogOrder: Object.assign({ eligible: true }, entry2) };
    model.wits = observable([story1, story2]);
    let operation = null;
    let refreshed = 0;
    workClient.reorderBacklogWorkItems = function (value, context) {
        operation = value;
        assert.deepStrictEqual(JSON.parse(JSON.stringify(context)), { projectId: "project-id", teamId: "team-id" });
        return Promise.resolve([]);
    };
    model.refresh = function () {
        refreshed += 1;
        model.isLoading(false);
        return Promise.resolve();
    };

    assert.strictEqual(await model.reorderWit({ draggedId: 2, targetId: 1, position: "before" }), true);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(operation)), { ids: [2], parentId: 11, previousId: 0, nextId: 1 });
    assert.strictEqual(refreshed, 1, "a successful reorder should refresh data from Azure DevOps");

    operation = null;
    const unsupported = { id: 999, originalId: 999, type: "User Story", backlogOrder: { eligible: false } };
    model.wits = observable([story1, unsupported]);
    assert.strictEqual(await model.reorderWit({ draggedId: 999, targetId: 1, position: "before" }), false);
    assert.strictEqual(operation, null, "invalid moves must not call Azure DevOps");

    model.wits = observable([story1, story2]);
    workClient.reorderBacklogWorkItems = function () { return Promise.reject(new Error("reorder rejected")); };
    assert.strictEqual(await model.reorderWit({ draggedId: 2, targetId: 1, position: "before" }), false);
    assert.strictEqual(model.isLoading(), false, "a failed request should leave the UI usable");
    assert.ok(model.message().includes("#2"), "a failed request should identify the work item");
    assert.strictEqual(refreshed, 1, "a failed request should not refresh an uncommitted order");

    let saved = null;
    model.manager = {
        setValue: function (key, value, options) {
            saved = { key: key, value: JSON.parse(value), options: options };
            return Promise.resolve();
        }
    };
    model.settingsKey = "gantt_project-id";
    model.settings = { showFields: ["duration"] };
    model._saveOrderMode(backlogOrderService.backlogOrder);
    await Promise.resolve();
    assert.deepStrictEqual(JSON.parse(JSON.stringify(saved)), {
        key: "gantt_project-id",
        value: { showFields: ["duration"], orderMode: "backlog" },
        options: { scopeType: "User" }
    }, "display order should be merged into the existing per-user/project settings");

    let configurationSaved = null;
    let panelResult = null;
    settingsManager = {
        getValue: function () { return Promise.resolve(JSON.stringify({ orderMode: "backlog" })); },
        setValue: function (key, value, options) {
            configurationSaved = { key: key, value: JSON.parse(value), options: options };
            return Promise.resolve();
        }
    };
    const configurationModel = Object.create(configurationApp.Model.prototype);
    configurationModel.project = { id: "project-id" };
    configurationModel.fieldsValue = observable(["dates", "duration"]);
    configurationModel.panel = { close: function (result) { panelResult = result; } };
    await configurationModel.save();
    assert.deepStrictEqual(JSON.parse(JSON.stringify(configurationSaved)), {
        key: "gantt_project-id",
        value: { orderMode: "backlog", showFields: ["dates", "duration"] },
        options: { scopeType: "User" }
    }, "saving field visibility should preserve the selected backlog order");
    assert.deepStrictEqual(JSON.parse(JSON.stringify(panelResult)), { fieldsValue: ["dates", "duration"] });

    console.log("querygantt backlog integration tests passed");
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
