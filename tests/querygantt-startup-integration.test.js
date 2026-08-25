"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ko = require("knockout");

const loadAmd = function (filename, dependencies, exposeModel) {
    let result = null;
    let source = fs.readFileSync(filename, "utf8");
    if (exposeModel) {
        source = source.replace(/\n\}\);\s*$/, "\n    return { Model: Model };\n});\n");
    }
    const document = {
        readyState: "loading", addEventListener: function () {}, querySelector: function () { return null; },
        head: { querySelectorAll: function () { return []; }, appendChild: function () {} },
        createElement: function () { return { classList: { add: function () {} }, setAttribute: function () {}, innerHTML: "", style: {} }; }
    };
    vm.runInNewContext(source, {
        Array: Array, Date: Date, Map: Map, Number: Number, Promise: Promise, Set: Set,
        console: { debug: function () {}, log: function () {}, warn: function () {} },
        define: function (names, factory) {
            result = factory.apply(null, names.map(function (name) { return dependencies[name] || {}; }));
        },
        document: document,
        fetch: dependencies.__fetch || function () { throw new Error("Unexpected fetch"); },
        isNaN: isNaN
    }, { filename: path.basename(filename) });
    return result;
};

const loadService = function (name) {
    let result = null;
    const filename = path.join(__dirname, "../js/services/" + name + ".js");
    vm.runInNewContext(fs.readFileSync(filename, "utf8"), {
        Date: Date, Map: Map, Number: Number, Set: Set,
        define: function (dependencies, factory) { result = factory(); }, isNaN: isNaN
    }, { filename: path.basename(filename) });
    return result;
};

const backlogOrderService = loadService("backlog-order");
const dateGranularityService = {};
const timelineZoomService = {};

const app = loadAmd(path.join(__dirname, "../js/querygantt-tab-app.js"), {
    module: { config: function () { return {}; } },
    knockout: ko,
    sdk: {},
    "services/backlog-order": backlogOrderService
}, true);

const initCalls = [];
app.Model.prototype.init = function (asOf) { initCalls.push(asOf || null); return Promise.resolve(); };
const model = new app.Model({
    version: "test", priorities: [], fields: [], user: "User",
    project: { id: "project-id", name: "Project" }, team: { id: "team-id", name: "Team" },
    query: { id: "query-id", name: "Query" }, showFields: []
});

assert.strictEqual(initCalls.length, 0, "constructing the model must not start duplicate Query and Backlog API loads");
const asOf = new Date(2026, 7, 21);
model.filterPrimary({ asOf: [asOf] });
assert.deepStrictEqual(initCalls, ["2026-08-21T00:00:00.0000000"], "a real As of change should still reload once");
model.dispose();

let filterRegistration = null;
const filterKnockout = Object.create(ko);
filterKnockout.components = { register: function (name, registration) { if (name === "my-filter") { filterRegistration = registration; } } };
loadAmd(path.join(__dirname, "../js/components/filter.js"), { knockout: filterKnockout }, false);

const primaryFilter = ko.observable({});
let primaryWrites = 0;
primaryFilter.subscribe(function () { primaryWrites += 1; });
const filter = filterRegistration.viewModel.createViewModel({
    value: ko.observable({}), valuePrimary: primaryFilter, queryType: ko.observable("flat"),
    assignees: [], states: [], priorities: [], tags: [], areas: [], parents: []
}, { element: { firstElementChild: {}, querySelector: function () { return null; } } });

assert.strictEqual(primaryWrites, 0, "creating the filter must not publish an unchanged empty As of filter");
filter.asOfValue([asOf]);
assert.strictEqual(primaryWrites, 1);
filter.asOfValue([]);
assert.strictEqual(primaryWrites, 2);
filter.dispose();

(async function () {
    let resolveBacklogs = null;
    const delayedBacklogs = new Promise((resolve) => resolveBacklogs = resolve);
    const witApi = { WorkItemTrackingRestClient: function WorkItemTrackingRestClient() {} };
    const workApi = { WorkRestClient: function WorkRestClient() {} };
    const workClient = {
        getBacklogs: function () { return delayedBacklogs; },
        getBacklogConfigurations: function () { return Promise.resolve({ backlogFields: { typeFields: { Order: "Microsoft.VSTS.Common.StackRank" } } }); },
        getTeamFieldValues: function () { return Promise.resolve(null); },
        getBacklogLevelWorkItems: function () { return Promise.resolve({ workItems: [{ source: null, target: { id: 1 } }] }); }
    };
    const witClient = {
        _options: { rootPath: Promise.resolve("https://dev.azure.com/example/") },
        queryByWiql: function () { return Promise.resolve({ queryType: 1, sortColumns: [], workItems: [{ id: 1 }] }); },
        getWorkItems: function () {
            return Promise.resolve([{
                id: 1,
                url: "https://dev.azure.com/example/_apis/wit/workItems/1",
                fields: {
                    "System.Id": 1,
                    "System.Rev": 1,
                    "System.TeamProject": "Project",
                    "System.WorkItemType": "Task",
                    "System.Title": "Visible before backlog discovery",
                    "System.State": "New",
                    "System.AreaPath": "Project",
                    "System.NodeName": "Project",
                    "System.IterationPath": "Project",
                    "System.CreatedBy": { displayName: "Creator" },
                    "System.ChangedBy": { displayName: "Changer" },
                    "System.CreatedDate": "2026-08-01T00:00:00.000Z",
                    "System.ChangedDate": "2026-08-01T00:00:00.000Z",
                    "Microsoft.VSTS.Common.StackRank": 100
                },
                relations: []
            }]);
        }
    };
    const asyncApi = {
        CommonServiceIds: {},
        getClient: function (type) { return type === witApi.WorkItemTrackingRestClient ? witClient : workClient; }
    };
    const asyncApp = loadAmd(path.join(__dirname, "../js/querygantt-tab-app.js"), {
        module: { config: function () { return {}; } },
        knockout: ko,
        sdk: { getAccessToken: function () { return Promise.resolve("token"); } },
        "api/index": asyncApi,
        "api/WorkItemTracking/index": witApi,
        "api/Work/index": workApi,
        "services/backlog-order": backlogOrderService,
        "services/browser-settings": { write: function () { return true; } },
        "services/date-granularity": dateGranularityService,
        "services/timeline-zoom": timelineZoomService,
        "services/icon": { fetch: function () { return new Promise(function () {}); } },
        __fetch: function () {
            return Promise.resolve({
                ok: true,
                json: function () {
                    return Promise.resolve({ value: [{ name: "Task", icon: { url: "https://example.test/task.svg" }, states: [{ name: "New", category: "Proposed" }] }] });
                }
            });
        }
    }, true);
    const asyncModel = new asyncApp.Model({
        version: "test", priorities: [], fields: [], user: "User",
        project: { id: "project-id", name: "Project" }, team: { id: "team-id", name: "Team" },
        query: { id: "query-id", name: "Query", wiql: "SELECT [System.Id] FROM WorkItems" },
        showFields: [], orderMode: backlogOrderService.backlogOrder
    });

    const initPromise = asyncModel.init();
    const renderedWithoutBacklog = await Promise.race([
        initPromise.then(() => true),
        new Promise((resolve) => setTimeout(() => resolve(false), 100))
    ]);
    assert.strictEqual(renderedWithoutBacklog, true, "slow backlog discovery must not block the first query render");
    assert.strictEqual(asyncModel.wits().length, 1);
    assert.strictEqual(asyncModel.backlogAvailable(), false);

    resolveBacklogs([{ id: "tasks", rank: 0, isHidden: false, workItemTypes: [{ name: "Task" }] }]);
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    assert.strictEqual(asyncModel.backlogAvailable(), true, "late backlog data should activate without reloading the query");
    assert.strictEqual(asyncModel.wits()[0].backlogOrder.eligible, true);

    asyncModel.dispose();
    console.log("querygantt startup integration tests passed");
})().catch(function (error) {
    console.error(error);
    process.exitCode = 1;
});
