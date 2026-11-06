"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const loadAmd = function (filename, dependencies, exposeModel, timerOverrides) {
    let result;
    let source = fs.readFileSync(path.join(__dirname, "../js/", filename), "utf8");
    if (exposeModel) {
        source = source.replace("return { start };", "return { Model: Model, start };");
    }
    vm.runInNewContext(source, Object.assign({
        console: { debug: function () {}, warn: function () {} },
        document: { readyState: "loading", addEventListener: function () {} },
        Map, Set, Number, Promise, setTimeout, clearTimeout,
        define: function (names, factory) {
            result = factory.apply(null, names.map((name) => dependencies[name] || {}));
        }
    }, timerOverrides || {}), { filename });
    return result;
};

const service = loadAmd("services/backlog-order.js", {});
const backlogs = [
    { id: "epics", rank: 3, workItemTypes: [{ name: "Epic" }] },
    { id: "features", rank: 2, workItemTypes: [{ name: "Feature" }] },
    { id: "stories", rank: 1, workItemTypes: [{ name: "User Story" }] },
    { id: "tasks", rank: 0, workItemTypes: [{ name: "Task" }] }
];
const makeIndex = function () {
    return service.createIndex(backlogs, [
        { workItems: [{ source: { id: 40 }, target: { id: 10 } }] },
        { workItems: [{ source: { id: 10 }, target: { id: 20 } }] },
        { workItems: [
            { source: { id: 20 }, target: { id: 30 } },
            { source: null, target: { id: 40 } },
            { source: null, target: { id: 60 } }
        ] },
        { workItems: [{ source: { id: 60 }, target: { id: 50 } }] }
    ]);
};
const chain = [
    { id: 30, type: "User Story", parentId: 20 },
    { id: 20, type: "Feature", parentId: 10 },
    { id: 10, type: "Epic", parentId: 40 },
    { id: 40, type: "User Story", parentId: 0 }
];

assert.strictEqual(typeof service.describeParentChain, "function",
    "backlog failures must identify a bad Parent link beyond the immediate parent");
const hint = service.describeParentChain(makeIndex(), chain);
assert.ok(hint.includes("#10 (Epic)") && hint.includes("#40 (User Story)"), "identify both ends and types of the reversed ancestor link");
assert.ok(hint.includes("Links > Parent") && hint.includes("Related"), "give the user a specific repair location and a non-hierarchical alternative");
assert.ok(hint.includes("#30 (User Story) -> #20 (Feature) -> #10 (Epic) -> #40 (User Story)"), "include the route from the drop target to the offending ancestor");
assert.ok(!hint.includes("remove the link between #30"), "do not blame a valid immediate Parent link");
assert.ok(service.describeParentChain(makeIndex(), [
    { id: 30, type: "User Story", parentId: 40 },
    { id: 40, type: "User Story", parentId: 0 }
]).includes("same backlog category"), "explain a same-category link");
assert.ok(!service.describeParentChain(makeIndex(), [
    { id: 30, type: "User Story", parentId: 10 },
    { id: 10, type: "Epic", parentId: 0 }
]).includes("Invalid"), "do not blame a skipped higher category for a same-category server rejection");
assert.ok(!service.describeParentChain(makeIndex(), [
    { id: 30, type: "User Story", parentId: 70 },
    { id: 70, type: "Custom type", parentId: 0 }
]).includes("Invalid"), "unknown process categories must not be reported as confirmed invalid");
assert.ok(service.describeParentChain(makeIndex(), [
    { id: 30, type: "User Story", parentId: 20 },
    { id: 20, type: "Feature", parentId: 30 },
    { id: 30, type: "User Story", parentId: 20 }
]).includes("cycle"), "a Parent cycle should have an actionable diagnosis");

const workApi = { WorkRestClient: function () {} };
const witApi = { WorkItemTrackingRestClient: function () {} };
let reorderCalls = 0;
let trackingCalls = [];
let getWorkItems;
let rejection = "Work item 50 can't be reordered under work item 30 because work item 30's parent is on the same category.";
const workClient = {
    reorderBacklogWorkItems: function () {
        reorderCalls += 1;
        return rejection ? Promise.reject(new Error(rejection)) : Promise.resolve([]);
    }
};
const trackingClient = {
    getWorkItems: function (ids, project, fields, asOf, expand) {
        trackingCalls.push(ids[0]);
        assert.strictEqual(project, "project-id");
        assert.deepStrictEqual(Array.from(fields), ["System.Id", "System.WorkItemType", "System.Parent"]);
        assert.strictEqual(asOf, null, "diagnose current server state rather than the query snapshot");
        assert.strictEqual(expand, "relations", "Parent relations must remain available when System.Parent is absent");
        return getWorkItems(ids[0]);
    }
};
const api = {
    getClient: function (type) {
        if (type === workApi.WorkRestClient) { return workClient; }
        assert.strictEqual(type, witApi.WorkItemTrackingRestClient);
        return trackingClient;
    },
    CommonServiceIds: {}
};
const modelDependencies = {
    module: { config: function () { return {}; } },
    "api/index": api,
    "api/Work/index": workApi,
    "api/WorkItemTracking/index": witApi,
    "services/backlog-order": service
};
const Model = loadAmd("querygantt-tab-app.js", modelDependencies, true).Model;
const observable = function (value) {
    return function (next) { if (arguments.length) { value = next; } return value; };
};
const makeModel = function (prototype) {
    const model = Object.create(prototype || Model.prototype);
    model.project = { id: "project-id", name: "Project" };
    model.team = { id: "team-id" };
    model.backlogIndex = observable(makeIndex());
    model.wits = observable([
        { id: 50, originalId: 50, type: "Task", path: "60/50", parent: "60", parentId: 60, backlogOrder: { eligible: true } },
        { id: 30, originalId: 30, type: "User Story", path: "10/20/30", parent: "10/20", parentId: 20, backlogOrder: { eligible: true } }
    ]);
    model.message = observable("");
    model._backlogReorderInFlight = false;
    return model;
};
const serverItem = function (node) {
    return {
        id: node.id,
        fields: { "System.Id": node.id, "System.WorkItemType": node.type, "System.Parent": node.parentId, "System.Title": "private-title-must-not-appear" }
    };
};
const move = { draggedId: 50, targetId: 30, position: "inside" };

(async function () {
    const model = makeModel();
    const before = JSON.stringify(model.wits());
    const indexBefore = JSON.stringify(model.backlogIndex());
    getWorkItems = (id) => Promise.resolve([serverItem(chain.find((node) => node.id === id))]);
    assert.strictEqual(await model.reorderWit(move), false);
    assert.strictEqual(reorderCalls, 1, "deterministic hierarchy errors must not retry the write");
    assert.deepStrictEqual(trackingCalls, [30, 20, 10, 40], "follow ancestors outside the query to their current root");
    assert.ok(model.message().includes("#10 (Epic)") && model.message().includes("#40 (User Story)"));
    assert.ok(model.message().includes(rejection), "retain the original Azure rejection alongside the diagnosis");
    assert.ok(!model.message().includes("private-title"), "diagnostic messages should not include work item titles");
    assert.strictEqual(JSON.stringify(model.wits()), before, "diagnostics must not change local work items");
    assert.strictEqual(JSON.stringify(model.backlogIndex()), indexBefore, "diagnostics must not change the reorder index");
    assert.strictEqual(model._backlogReorderInFlight, false);
    assert.strictEqual(model._isRetryableBacklogError(new Error("TF400486: parent is on the same category")), false,
        "a deterministic hierarchy rejection must not be retried even if Azure also supplies the stale-snapshot code");

    trackingCalls = [];
    const anchorModel = makeModel();
    const anchorIndex = anchorModel.backlogIndex();
    const anchor = { id: 55, parentId: 30, backlogId: "tasks", backlogRank: 0, levelPosition: 3, position: 1 };
    anchorIndex.entries[55] = [anchor];
    anchorIndex.allEntries.push(anchor);
    const namedAnchorError = "Work item 50 can't be reordered above work item 55 because its parent is on the same category.";
    getWorkItems = (id) => Promise.resolve([serverItem(id === 55
        ? { id: 55, type: "Task", parentId: 30 }
        : chain.find(node => node.id === id))]);
    const anchorHint = await anchorModel._getBacklogHierarchyHint(service.planMove(anchorIndex, anchorModel.wits()[0], anchorModel.wits()[1], "inside"), { target: anchorModel.wits()[1] }, namedAnchorError);
    assert.deepStrictEqual(trackingCalls, [55, 30, 20, 10, 40], "follow an operation anchor named by Azure rather than an unrelated displayed target");
    assert.ok(anchorHint.includes("#10 (Epic)"));

    trackingCalls = [];
    const denied = makeModel();
    getWorkItems = () => Promise.reject(new Error("access denied"));
    assert.strictEqual(await denied.reorderWit(move), false);
    assert.ok(denied.message().includes(rejection), "a failed ancestor lookup must not hide the original server error");
    assert.ok(denied.message().includes("could not be completed"), "make the incomplete diagnostic explicit");
    assert.strictEqual(denied._backlogReorderInFlight, false);

    trackingCalls = [];
    const missing = makeModel();
    getWorkItems = () => Promise.resolve([]);
    assert.strictEqual(await missing.reorderWit(move), false);
    assert.ok(missing.message().includes("could not be completed"), "an omitted/deleted ancestor is not proof that the chain reaches a valid root");

    trackingCalls = [];
    const deep = makeModel();
    getWorkItems = (id) => Promise.resolve([serverItem({ id, type: "Custom type", parentId: id + 100 })]);
    assert.strictEqual(await deep.reorderWit(move), false);
    assert.strictEqual(trackingCalls.length, 32, "ancestor traversal must have a request-depth bound");
    assert.ok(deep.message().includes("could not be completed"));

    let timeoutCallback;
    let timeoutCleared = false;
    const timerModel = loadAmd("querygantt-tab-app.js", modelDependencies, true, {
        setTimeout: function (callback, delay) { assert.strictEqual(delay, 6000); timeoutCallback = callback; return 1; },
        clearTimeout: function (id) { assert.strictEqual(id, 1); timeoutCleared = true; }
    }).Model;
    const timedOut = makeModel(timerModel.prototype);
    let resolveSlowRequest;
    trackingCalls = [];
    getWorkItems = () => new Promise(resolve => { resolveSlowRequest = resolve; });
    const slowMove = timedOut.reorderWit(move);
    for (let i = 0; i < 12; i++) { await Promise.resolve(); }
    assert.ok(resolveSlowRequest, "the real lookup should be in flight before testing the timeout");
    timeoutCallback();
    assert.strictEqual(await slowMove, false);
    const timeoutMessage = timedOut.message();
    assert.ok(timeoutMessage.includes(rejection) && timeoutMessage.includes("could not be completed"));
    assert.ok(timeoutCleared);
    assert.strictEqual(timedOut._backlogReorderInFlight, false, "a slow lookup must release the move lock at the deadline");
    resolveSlowRequest([serverItem(chain[0])]);
    for (let i = 0; i < 12; i++) { await Promise.resolve(); }
    assert.deepStrictEqual(trackingCalls, [30], "a timed-out lookup must not continue fetching more ancestors");
    assert.strictEqual(timedOut.message(), timeoutMessage, "a late response must not replace the final error message");

    const dismissed = makeModel();
    let releaseDismissed;
    getWorkItems = () => new Promise(resolve => { releaseDismissed = resolve; });
    const dismissedMove = dismissed.reorderWit(move);
    for (let i = 0; i < 12; i++) { await Promise.resolve(); }
    dismissed.message("");
    releaseDismissed([]);
    assert.strictEqual(await dismissedMove, false);
    assert.strictEqual(dismissed.message(), "", "a dismissed error must not reappear after diagnostic completion");

    trackingCalls = [];
    const cyclic = makeModel();
    getWorkItems = (id) => Promise.resolve([serverItem(id === 30
        ? { id: 30, type: "User Story", parentId: 20 }
        : { id: 20, type: "Feature", parentId: 30 })]);
    assert.strictEqual(await cyclic.reorderWit(move), false);
    assert.deepStrictEqual(trackingCalls, [30, 20], "a cyclic hierarchy must not cause unbounded requests");
    assert.ok(cyclic.message().includes("cycle"));

    trackingCalls = [];
    const relationFallback = makeModel();
    getWorkItems = (id) => {
        const item = serverItem(chain.find((node) => node.id === id));
        const parentId = item.fields["System.Parent"];
        delete item.fields["System.Parent"];
        item.relations = parentId ? [{ rel: "System.LinkTypes.Hierarchy-Reverse", url: `https://example.test/_apis/wit/workItems/${parentId}` }] : [];
        return Promise.resolve([item]);
    };
    assert.strictEqual(await relationFallback.reorderWit(move), false);
    assert.ok(relationFallback.message().includes("#10 (Epic)"), "diagnose ancestors using hierarchy relations if the Parent field is unavailable");

    trackingCalls = [];
    rejection = "TF401027: insufficient permissions";
    assert.strictEqual(await makeModel().reorderWit(move), false);
    assert.deepStrictEqual(trackingCalls, [], "ordinary failures must not fetch an unrelated ancestor chain");

    trackingCalls = [];
    rejection = null;
    assert.strictEqual(await makeModel().reorderWit(move), true);
    assert.deepStrictEqual(trackingCalls, [], "successful moves must not pay the diagnostic request cost");
    console.log("backlog hierarchy diagnostic tests passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
