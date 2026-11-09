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
        console: { debug: function () {}, warn: function () {}, log: function () {} },
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

const ko = require("knockout");
const localization = require("./helpers/load-pure-service")("hierarchy-localization");
const analysisDependencies = { "services/backlog-order": service, "services/hierarchy-localization": localization };
const analysisService = loadAmd("services/hierarchy-analysis.js", analysisDependencies);
const workApi = { WorkRestClient: function () {} };
const witApi = { WorkItemTrackingRestClient: function () {} };
let rejection = "Work item 50 can't be reordered under work item 30 because work item 30's parent is on the same category.";
let reorderCalls = 0;
let trackingCalls = [];
let getWorkItems;
const workClient = {
    reorderBacklogWorkItems: () => {
        reorderCalls++;
        return rejection ? Promise.reject(new Error(rejection)) : Promise.resolve();
    }
};
const trackingClient = {
    getWorkItems: (ids, project, fields, asOf, expand) => {
        assert.strictEqual(project, undefined, "ancestors in another project must remain readable");
        assert.deepStrictEqual(Array.from(fields), ["System.Id", "System.WorkItemType", "System.TeamProject"]);
        assert.strictEqual(asOf, null);
        assert.strictEqual(expand, 1, "request current Parent relations using the SDK's enum");
        trackingCalls.push(ids[0]);
        return getWorkItems(ids[0]);
    }
};
const dependencies = {
    module: { config: () => ({}) },
    knockout: ko,
    "api/index": {
        getClient: (type) => type === workApi.WorkRestClient ? workClient : trackingClient,
        CommonServiceIds: {}
    },
    "api/Work/index": workApi,
    "api/WorkItemTracking/index": witApi,
    "services/backlog-order": service,
    "services/hierarchy-analysis": analysisService,
    "services/hierarchy-localization": localization
};
for (const name of ["browser-settings", "date-granularity", "field-columns", "timeline-zoom", "timeline-split"]) {
    if (fs.existsSync(path.join(__dirname, "../js/services/" + name + ".js"))) {
        dependencies["services/" + name] = loadAmd("services/" + name + ".js", {});
    }
}
const Model = loadAmd("querygantt-tab-app.js", dependencies, true).Model;
const makeModel = (culture) => {
    const model = new Model({
        culture,
        project: { id: "project-id", name: "Project" },
        team: { id: "team-id" }, priorities: [], fields: [],
        query: { id: "query-id", name: "Synthetic" }, showFields: []
    });
    model.path = "https://example.test/";
    model.backlogIndex(makeIndex());
    model.wits([
        { id: 50, originalId: 50, title: "Source", state: "New", tags: [], type: "Task", path: "60/50", parent: "60", parentId: 60, backlogOrder: { eligible: true } },
        { id: 30, originalId: 30, title: "Target", state: "New", tags: [], type: "User Story", path: "10/20/30", parent: "10/20", parentId: 20, backlogOrder: { eligible: true } }
    ]);
    return model;
};
const serverItem = (node) => ({
    id: node.id,
    fields: { "System.Id": node.id, "System.WorkItemType": node.type, "System.TeamProject": node.project || "Project" },
    relations: node.parentId ? [{ rel: "System.LinkTypes.Hierarchy-Reverse", url: "https://example.test/_apis/wit/workItems/" + node.parentId }] : []
});
const serverChain = [...chain, { id: 50, type: "Task", parentId: 60 }, { id: 60, type: "User Story", parentId: 0 }];
const defaultRead = (id) => Promise.resolve([serverItem(serverChain.find((node) => node.id === id))]);
const move = { draggedId: 50, targetId: 30, position: "inside" };

(async () => {
    const model = makeModel();
    const originalItems = JSON.stringify(model.wits());
    const originalIndex = JSON.stringify(model.backlogIndex());
    getWorkItems = defaultRead;
    assert.strictEqual(await model.reorderWit(move), false);
    assert.strictEqual(reorderCalls, 1, "a deterministic rejection must not retry the write");
    assert.deepStrictEqual(trackingCalls, [], "analysis must start only when the user requests it");
    assert.strictEqual(model._backlogReorderInFlight, false, "reading ancestors must not hold the move lock");
    assert.strictEqual(typeof model.messageAction(), "function");
    await model.messageAction()();
    const result = model.messageAnalysis();
    assert.ok(result.findings.some((finding) => finding.child === 10 && finding.parent === 40));
    assert.ok(result.findings[0].childUrl.endsWith("/Project/_workitems/edit/10"));
    assert.ok(result.findings[0].text.includes("Links > Parent"));
    assert.ok(result.traces.some((trace) => trace.items[0].id === 50), "inspect the dragged item as well as the target");
    assert.strictEqual(new Set(trackingCalls).size, trackingCalls.length, "shared ancestors must be fetched once per analysis");
    assert.strictEqual(model.message(), "Unable to reorder work item #50. " + rejection, "the Azure rejection must remain visible");
    assert.strictEqual(JSON.stringify(model.wits()), originalItems, "analysis must not change items");
    assert.strictEqual(JSON.stringify(model.backlogIndex()), originalIndex, "analysis must not change order or links");

    const japanese = await analysisService.analyze({
        ids: [30], client: trackingClient, index: makeIndex(), projectName: "Project", culture: "ja-JP"
    });
    assert.ok(japanese.summary.includes("親子関係"), "a Japanese host culture must produce a Japanese analysis summary");
    assert.ok(japanese.findings[0].text.includes("親のバックログ階層が子より下位"));
    assert.ok(japanese.findings[0].text.includes("#10 (Epic) → #40 (User Story)"), "IDs and process type names remain unchanged");
    assert.ok(japanese.findings[0].text.includes("親（Parent）") && japanese.findings[0].text.includes("関連（Related）"));
    assert.strictEqual(japanese.traces[0].text, "#30 からたどった親階層");

    trackingCalls = [];
    getWorkItems = (id) => Promise.resolve([serverItem(id === 50 ? { id, type: "Task", parentId: 10 } : serverChain.find((node) => node.id === id))]);
    await model.messageAction()();
    assert.ok(model.messageAnalysis().traces.find((trace) => trace.items[0].id === 50).items.some((item) => item.id === 40), "source-side ancestors must be followed even when Azure names the dragged item");
    assert.strictEqual(trackingCalls.filter((id) => id === 10).length, 1);

    trackingCalls = [];
    getWorkItems = (id) => id === 50 ? Promise.reject({ status: 403 }) : defaultRead(id);
    await model.messageAction()();
    assert.ok(model.messageAnalysis().warnings.some((warning) => warning.includes("#50") && warning.includes("denied")));
    assert.ok(model.messageAnalysis().findings.length, "a denied source must not stop target analysis");

    const dismissed = makeModel();
    await dismissed.reorderWit(move);
    const releases = [];
    trackingCalls = [];
    getWorkItems = () => new Promise((resolve) => { releases.push(resolve); });
    const pending = dismissed.messageAction()();
    for (let i = 0; i < 8; i++) await Promise.resolve();
    assert.strictEqual(dismissed.messageActionBusy(), true);
    assert.strictEqual(await dismissed.analyzeBacklogFailure(), false, "double clicks must not start concurrent analyses");
    dismissed.message("");
    assert.strictEqual(dismissed.messageAction(), null);
    assert.strictEqual(dismissed.messageActionBusy(), false);
    releases.forEach((release) => release([]));
    assert.strictEqual(await pending, false);
    assert.strictEqual(dismissed.messageAnalysis(), null, "late results must not resurrect a closed error");

    const repeated = makeModel();
    await repeated.reorderWit(move);
    const repeatedReleases = [];
    getWorkItems = () => new Promise((resolve) => repeatedReleases.push(resolve));
    const earlierAnalysis = repeated.messageAction()();
    for (let i = 0; i < 8; i++) await Promise.resolve();
    assert.strictEqual(repeated.messageActionBusy(), true);
    await repeated.reorderWit(move);
    assert.strictEqual(repeated.messageActionBusy(), false, "an identical new rejection must release the earlier analysis state");
    assert.strictEqual(repeated.messageAnalysis(), null);
    repeatedReleases.forEach((release) => release([]));
    assert.strictEqual(await earlierAnalysis, false);
    getWorkItems = defaultRead;
    assert.strictEqual(await repeated.messageAction()(), true, "the new alert must remain analyzable after an identical rejection");

    let timeoutCallback;
    let timeoutCleared = false;
    const timed = loadAmd("services/hierarchy-analysis.js", analysisDependencies, false, {
        setTimeout: (callback, delay) => { assert.strictEqual(delay, 15000); timeoutCallback = callback; return 1; },
        clearTimeout: () => { timeoutCleared = true; }
    });
    let releaseTimeout;
    trackingCalls = [];
    getWorkItems = () => new Promise((resolve) => { releaseTimeout = resolve; });
    const timedResult = timed.analyze({ ids: [30], client: trackingClient, index: makeIndex(), projectName: "Project" });
    await Promise.resolve();
    timeoutCallback();
    assert.ok((await timedResult).warnings.some((warning) => warning.includes("time limit")));
    assert.ok(timeoutCleared);
    releaseTimeout([serverItem(chain[0])]);
    for (let i = 0; i < 8; i++) await Promise.resolve();
    assert.deepStrictEqual(trackingCalls, [30], "expired analysis must not fetch further ancestors");

    trackingCalls = [];
    getWorkItems = (id) => Promise.resolve([serverItem({ id, type: "Unknown", parentId: id + 1 })]);
    const bounded = await analysisService.analyze({ ids: [1], client: trackingClient, index: makeIndex(), projectName: "Project", maxItems: 8 });
    assert.strictEqual(trackingCalls.length, 8);
    assert.ok(bounded.warnings.some((warning) => warning.includes("limit")));
    assert.strictEqual(bounded.findings.length, 0, "unknown categories must not be called invalid");

    getWorkItems = (id) => Promise.resolve([serverItem({ id, type: "User Story", parentId: id === 30 ? 40 : 30 })]);
    const cyclic = await analysisService.analyze({ ids: [30], client: trackingClient, index: makeIndex(), projectName: "Project" });
    assert.ok(cyclic.findings.some((finding) => finding.text.includes("cycle")));

    getWorkItems = () => Promise.resolve([]);
    const missing = await analysisService.analyze({ ids: [30], client: trackingClient, index: makeIndex(), projectName: "Project" });
    assert.ok(missing.warnings[0].includes("#30"));
    assert.strictEqual(missing.findings.length, 0);

    getWorkItems = (id) => Promise.resolve([serverItem(id === 30
        ? { id, type: "User Story", parentId: 40 }
        : { id, type: "User Story", parentId: 0, project: "Another project" })]);
    const otherProject = await analysisService.analyze({ ids: [30], client: trackingClient, index: makeIndex(), projectName: "Project" });
    assert.strictEqual(otherProject.findings.length, 0, "another project's process must not be classified using the current team's categories");
    assert.ok(otherProject.warnings.some((warning) => warning.includes("another project")));

    const analyzeJapanese = (options) => analysisService.analyze(Object.assign({
        ids: [30], client: trackingClient, index: makeIndex(), projectName: "Project", culture: "ja-JP"
    }, options || {}));
    getWorkItems = (id) => Promise.resolve([serverItem({ id, type: "User Story", parentId: id === 30 ? 40 : 0 })]);
    assert.ok((await analyzeJapanese()).findings[0].text.includes("同じバックログ階層"));
    getWorkItems = (id) => Promise.resolve([serverItem({ id, type: "User Story", parentId: id === 30 ? 40 : 30 })]);
    assert.ok((await analyzeJapanese()).findings.some((finding) => finding.text.includes("循環")));
    getWorkItems = (id) => Promise.resolve([serverItem(id === 30
        ? { id, type: "User Story", parentId: 20 }
        : { id, type: "Feature", parentId: 0 })]);
    const noIssueJapanese = await analyzeJapanese();
    assert.strictEqual(noIssueJapanese.findings.length, 0);
    assert.strictEqual(noIssueJapanese.warnings.length, 0);
    assert.ok(noIssueJapanese.summary.startsWith("確認した範囲では"));
    for (const status of [401, 403, 404, 500]) {
        getWorkItems = () => Promise.reject({ status });
        const failureJapanese = await analyzeJapanese();
        assert.ok(failureJapanese.summary.includes("一部未完了"));
        assert.ok(failureJapanese.warnings[0].includes("#30"));
        assert.ok(failureJapanese.warnings[0].includes(status === 401 || status === 403 ? "閲覧権限" : status === 404 ? "見つからない" : "取得に失敗"));
    }
    getWorkItems = () => Promise.reject(new Error("Synthetic English network failure"));
    const networkJapanese = await analyzeJapanese();
    assert.ok(networkJapanese.warnings[0].includes("接続状況"));
    assert.ok(networkJapanese.warnings[0].includes("取得エラーの原文：Synthetic English"), "retain the original lookup error after the localized guidance");
    getWorkItems = () => Promise.resolve([]);
    assert.ok((await analyzeJapanese()).warnings[0].includes("取得できません"));
    getWorkItems = () => Promise.resolve([{ id: 30, fields: {}, relations: [
        { rel: "System.LinkTypes.Hierarchy-Reverse", url: "https://example.test/40" },
        { rel: "System.LinkTypes.Hierarchy-Reverse", url: "https://example.test/50" }
    ] }]);
    assert.ok((await analyzeJapanese()).warnings[0].includes("一意に読み取れません"));
    getWorkItems = (id) => Promise.resolve([serverItem({ id, type: "Unknown", parentId: id + 1 })]);
    const limitJapanese = await analyzeJapanese({ maxItems: 3 });
    assert.ok(limitJapanese.warnings.some((warning) => warning.includes("件数上限")));
    assert.ok(limitJapanese.warnings.some((warning) => warning.includes("バックログ階層が不明")));
    getWorkItems = (id) => Promise.resolve([serverItem({ id, type: "User Story", parentId: 0, project: "Other project" })]);
    assert.ok((await analyzeJapanese()).warnings.some((warning) => warning.includes("別のプロジェクト")));
    getWorkItems = () => new Promise(() => {});
    const timedJapanese = timed.analyze({ ids: [30], client: trackingClient, index: makeIndex(), projectName: "Project", culture: "ja-JP" });
    await Promise.resolve();
    timeoutCallback();
    assert.ok((await timedJapanese).warnings.some((warning) => warning.includes("制限時間")));
    getWorkItems = (id) => id === 50 ? Promise.reject({ status: 403 }) : defaultRead(id);
    const partialJapanese = await analyzeJapanese({ ids: [50, 30] });
    assert.ok(partialJapanese.findings.length && partialJapanese.summary.includes("見つかりました"));
    assert.ok(partialJapanese.warnings.some((warning) => warning.includes("#50") && warning.includes("閲覧権限")));
    getWorkItems = defaultRead;
    const japaneseModel = makeModel("ja-JP");
    await japaneseModel.reorderWit(move);
    assert.ok(japaneseModel.message().startsWith("Work Item #50 の並べ替えができませんでした。"));
    assert.ok(japaneseModel.message().includes(rejection), "retain Azure's original rejection without machine-translating it");
    await japaneseModel.messageAction()();
    assert.ok(japaneseModel.messageAnalysis().summary.includes("見つかりました"), "the model must pass its host culture into analysis");
    const analyze = analysisService.analyze;
    analysisService.analyze = () => Promise.reject(new Error("Synthetic failure"));
    await japaneseModel.messageAction()();
    assert.ok(japaneseModel.messageAnalysis().summary.includes("解析を完了できません"));
    analysisService.analyze = analyze;
    japaneseModel._showBacklogFailure("作業項目 #88 の親を確認してください。", {}, { dragged: { id: 50 } });
    assert.ok(japaneseModel._backlogAnalysisContext.ids.includes(88), "localized server errors must retain named analysis anchors");

    rejection = null;
    trackingCalls = [];
    const success = makeModel();
    success._applyBacklogMove = () => {};
    assert.strictEqual(await success.reorderWit(move), true);
    assert.deepStrictEqual(trackingCalls, []);
    assert.strictEqual(success.messageAction(), null);
    repeated._applyBacklogMove = () => {};
    assert.strictEqual(await repeated.reorderWit(move), true);
    assert.strictEqual(repeated.messageAnalysis(), null, "a successful retry must clear the earlier diagnosis");
    assert.strictEqual(repeated.messageAction(), null);
    assert.strictEqual(repeated.message(), "");

    for (const item of [model, dismissed, repeated, success, japaneseModel]) item.dispose();
    console.log("backlog hierarchy diagnostic tests passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
