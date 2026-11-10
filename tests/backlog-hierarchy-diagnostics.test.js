"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ko = require("knockout");
const load = (name, dependencies = {}, timers = {}) => {
    let result;
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/services/", name + ".js"), "utf8"), Object.assign({
        console, Map, Set, Number, Date, Promise, setTimeout, clearTimeout,
        define: (names, factory) => { result = factory(...names.map((name) => dependencies[name])); }
    }, timers), { filename: name });
    return result;
};
const localization = load("hierarchy-localization");
const dependencies = { "services/hierarchy-localization": localization };
const service = load("hierarchy-analysis", dependencies);
const backlogs = [
    { id: "epics", rank: 3, workItemTypes: [{ name: "Epic" }] },
    { id: "features", rank: 2, workItemTypes: [{ name: "Feature" }] },
    { id: "stories", rank: 1, workItemTypes: [{ name: "User Story" }] },
    { id: "tasks", rank: 0, workItemTypes: [{ name: "Task" }] }
];
const index = service.createIndex(backlogs);
const chain = [
    { id: 30, type: "User Story", parentId: 20 },
    { id: 20, type: "Feature", parentId: 10 },
    { id: 10, type: "Epic", parentId: 40 },
    { id: 40, type: "User Story", parentId: 0 },
    { id: 50, type: "Task", parentId: 60 },
    { id: 60, type: "User Story", parentId: 0 }
];
const serverItem = (node) => ({
    id: node.id, url: "https://example.test/" + encodeURIComponent(node.project || "Project") + "/_apis/wit/workItems/" + node.id,
    fields: { "System.Id": node.id, "System.WorkItemType": node.type, "System.TeamProject": node.project || "Project" },
    relations: node.parentId ? [{ rel: "System.LinkTypes.Hierarchy-Reverse", url: "https://example.test/_apis/wit/workItems/" + node.parentId }] : []
});
let calls = [];
const defaultRead = (id) => Promise.resolve([serverItem(chain.find((node) => node.id === id))]);
let read = defaultRead;
const client = { getWorkItems: (ids, project, fields, asOf, expand) => {
    assert.strictEqual(project, undefined, "cross-project ancestors must remain readable");
    assert.strictEqual(fields, undefined, "do not combine a field projection with link expansion");
    assert.strictEqual(asOf, undefined);
    assert.strictEqual(expand, "all", "serialize the documented REST enum name, as used by normal query loading");
    calls.push(ids[0]);
    return read(ids[0]);
} };
const analyze = (options) => service.analyze(Object.assign({ ids: [30], client, index, projectName: "Project" }, options));
const tick = async () => { for (let i = 0; i < 24; i++) await Promise.resolve(); };

(async () => {
    const requests = [];
    const Client = require("./sdk-contract-helper")((url) => {
        const request = new URL(url);
        requests.push(request);
        if (request.searchParams.has("fields") || request.searchParams.get("$expand") !== "all") {
            return Promise.reject({ status: 400, message: "Synthetic unsupported projection" });
        }
        return Promise.resolve({ text: () => defaultRead(Number(request.searchParams.get("ids"))).then(JSON.stringify) });
    });
    const wire = await analyze({ client: new Client({ rootPath: "https://example.test/" }) });
    assert.ok(wire.findings.some((finding) => finding.child === 10 && finding.parent === 40), "the pinned SDK must read through to a reversed grandparent instead of failing every seed");
    assert.ok(requests.every((url) => !url.searchParams.has("asOf")), "read current Parent links");
    assert.deepStrictEqual(requests.map((url) => Number(url.searchParams.get("ids"))), [30, 20, 10, 40]);
    const snapshot = JSON.stringify(index);
    const result = await analyze({ ids: [30, 50, 20] });
    assert.ok(result.findings[0].text.includes("Links > Parent") && result.findings[0].text.includes("Related"));
    assert.ok(result.findings[0].childUrl.endsWith("/Project/_workitems/edit/10"));
    assert.strictEqual(JSON.stringify(index), snapshot, "analysis never changes process metadata");
    calls = [];
    await analyze({ ids: [30, 20] });
    assert.strictEqual(new Set(calls).size, calls.length, "shared ancestors are read once per analysis");

    for (const culture of ["en-US", "ja-JP"]) {
        const ja = culture === "ja-JP";
        read = defaultRead;
        const reversed = await analyze({ culture });
        assert.ok(reversed.findings[0].text.includes(ja ? "親のバックログ階層が子より下位" : "lower backlog category"));
        assert.strictEqual(reversed.traces[0].text, ja ? "#30 からたどった親階層" : "Parent chain from #30");
        read = (id) => Promise.resolve([serverItem({ id, type: "User Story", parentId: id === 30 ? 40 : 0 })]);
        assert.ok((await analyze({ culture })).findings[0].text.includes(ja ? "同じバックログ階層" : "same backlog category"));
        read = (id) => Promise.resolve([serverItem({ id, type: "User Story", parentId: id === 30 ? 40 : 30 })]);
        assert.ok((await analyze({ culture })).findings.some((finding) => finding.text.includes(ja ? "循環" : "cycle")));
        // Skipping a higher level is not proof that Azure's rejection is caused by this link.
        read = (id) => Promise.resolve([serverItem({ id, type: id === 30 ? "User Story" : "Epic", parentId: id === 30 ? 10 : 0 })]);
        const valid = await analyze({ culture });
        assert.strictEqual(valid.findings.length, 0);
        assert.strictEqual(valid.warnings.length, 0);
        for (const status of [400, 401, 403, 404, 500]) {
            read = () => Promise.reject({ status, serverError: { message: "Synthetic server detail" } });
            const failed = await analyze({ culture });
            assert.ok(failed.summary.includes(ja ? "一部未完了" : "incomplete"));
            assert.ok(failed.warnings[0].includes("HTTP " + status) && failed.warnings[0].includes("Synthetic server detail"), "HTTP errors must retain status and original details");
            assert.ok(failed.warnings[0].includes(status === 401 || status === 403 ? (ja ? "閲覧権限" : "denied") : status === 404 ? (ja ? "見つからない" : "not found") : (ja ? "取得に失敗" : "lookup failed")));
            assert.strictEqual(failed.traces.length, 0);
        }
        read = () => Promise.reject(new Error("Synthetic network failure"));
        assert.ok((await analyze({ culture })).warnings[0].includes("Synthetic network failure"));
        read = () => Promise.resolve([]);
        assert.ok((await analyze({ culture })).warnings[0].includes(ja ? "取得できません" : "not returned"));
        read = () => Promise.resolve([{ id: 30, fields: {}, relations: [
            { rel: "System.LinkTypes.Hierarchy-Reverse", url: "https://example.test/40" },
            { rel: "System.LinkTypes.Hierarchy-Reverse", url: "https://example.test/50" }
        ] }]);
        assert.ok((await analyze({ culture })).warnings[0].includes(ja ? "一意" : "unambiguously"));
        calls = [];
        read = (id) => Promise.resolve([serverItem({ id, type: "Unknown", parentId: id + 1 })]);
        const bounded = await analyze({ culture, maxItems: 8 });
        assert.strictEqual(calls.length, 8);
        assert.ok(bounded.warnings.some((warning) => warning.includes(ja ? "件数上限" : "item limit")));
        assert.ok(bounded.warnings.some((warning) => warning.includes(ja ? "階層が不明" : "no known backlog")));
        assert.strictEqual(bounded.findings.length, 0);
        read = (id) => Promise.resolve([serverItem({ id, type: "User Story", parentId: id === 30 ? 40 : 0, project: id === 40 ? "Other project" : "Project" })]);
        const cross = await analyze({ culture });
        assert.strictEqual(cross.findings.length, 0, "do not apply one project's categories to another project");
        assert.ok(cross.warnings.some((warning) => warning.includes(ja ? "別のプロジェクト" : "another project")));
        assert.ok(cross.traces[0].items[1].url.includes("Other%20project"), "cross-project links must open the actual item project");
        read = (id) => id === 50 ? Promise.reject({ status: 403 }) : defaultRead(id);
        const partial = await analyze({ culture, ids: [50, 30] });
        assert.ok(partial.findings.length && partial.warnings.length, "a denied seed must not stop readable chains");
    }

    // The entire context lookup is also bounded, not just the ancestor walk.
    let timerCallback;
    const timers = { setTimeout: (callback) => { timerCallback = callback; return 1; }, clearTimeout: () => {} };
    const timed = load("hierarchy-analysis", dependencies, timers);
    read = () => new Promise(() => {});
    const pendingTimeout = timed.analyze({ ids: [30], client, index, projectName: "Project" });
    await tick(); timerCallback();
    assert.ok((await pendingTimeout).warnings[0].includes("time limit"));

    let ready = false, hostCulture = "ja-JP", categoryFailure = false, contextHangs = false;
    const sdk = {
        ready: () => { ready = true; return Promise.resolve(); },
        getPageContext: () => { assert.ok(ready); return { globalization: { culture: hostCulture } }; },
        getWebContext: () => ({ project: { id: "project-id", name: "Project" } }),
        getTeamContext: () => ({ id: "team-id" })
    };
    const work = { WorkRestClient: function () {} }, wit = { WorkItemTrackingRestClient: function () {} };
    const workClient = { getBacklogs: (team) => {
        assert.deepStrictEqual(JSON.parse(JSON.stringify(team)), { projectId: "project-id", teamId: "team-id" });
        return contextHangs ? new Promise(() => {}) : categoryFailure ? Promise.reject({ status: 403 }) : Promise.resolve(backlogs);
    } };
    const controllerDependencies = { knockout: ko, sdk, "api/Work/index": work, "api/WorkItemTracking/index": wit,
        "services/hierarchy-analysis": service, "services/hierarchy-localization": localization,
        "api/index": { getClient: (type) => type === work.WorkRestClient ? workClient : client } };
    const controller = load("hierarchy-diagnostics", controllerDependencies);
    const text = ko.observable("Unable to reorder work item #50.");
    const context = ko.observable({ workItemIds: [50, 30] });
    calls = []; read = defaultRead;
    const model = controller.create(text, context);
    await tick();
    assert.deepStrictEqual(calls, [], "opening an error must not read ancestors automatically");
    assert.strictEqual(model.culture(), "ja");
    const before = text();
    assert.strictEqual(await model.run(), true);
    assert.ok(model.analysis().findings.some((finding) => finding.child === 10 && finding.parent === 40),
        "use the structured drop target even when the server message names only the source");
    assert.ok(model.analysis().summary.includes("見つかりました"));
    assert.strictEqual(text(), before, "keep the original Azure rejection");
    const releases = [];
    read = () => new Promise((resolve) => releases.push(resolve));
    const inFlight = model.run();
    await tick();
    assert.strictEqual(model.busy(), true);
    assert.strictEqual(await model.run(), false, "double clicks must not start a second analysis");
    text("");
    assert.strictEqual(model.action(), null);
    assert.strictEqual(model.busy(), false);
    releases.forEach((release) => release([]));
    assert.strictEqual(await inFlight, false);
    assert.strictEqual(model.analysis(), null, "late responses cannot resurrect a closed alert");
    read = defaultRead;
    text(before);
    assert.strictEqual(await model.run(), true, "an identical new rejection is analyzable after invalidation");
    categoryFailure = true;
    assert.strictEqual(await model.run(), true);
    assert.ok(model.analysis().warnings.some((warning) => warning.includes("階層を取得できません")));
    assert.ok(model.analysis().traces.length, "category discovery failure must not stop Parent reads");
    categoryFailure = false;
    const originalAnalyze = service.analyze;
    service.analyze = () => Promise.reject(new Error("Synthetic analysis failure"));
    await model.run();
    assert.ok(model.analysis().summary.includes("解析を完了できません"));
    assert.ok(model.analysis().warnings[0].includes("Synthetic analysis failure"));
    service.analyze = originalAnalyze;
    model.dispose();
    assert.strictEqual(await model.run(), false);
    hostCulture = "en-US";
    contextHangs = true;
    const timedController = load("hierarchy-diagnostics", controllerDependencies, timers).create(text);
    const contextTimeout = timedController.run();
    await tick(); timerCallback();
    assert.strictEqual(await contextTimeout, true);
    assert.ok(timedController.analysis().warnings[0].includes("time limit"));
    assert.strictEqual(timedController.busy(), false);
    timedController.dispose();

    for (const input of ["Unable to reorder work item #12. Work item 34's parent is on the same category.", "作業項目 #12 の親を確認してください。 #34", "Unable to reorder work item\r\n#12 under work item\r\n34"]) {
        assert.deepStrictEqual(Array.from(service.getSeeds(input)), [12, 34]);
    }
    assert.deepStrictEqual(Array.from(service.getSeeds("Unable to update work item #12")), [], "unrelated errors have no Analyze button");
    assert.strictEqual(service.getSeeds("Parent " + Array.from({ length: 30 }, (_, i) => "#" + (i + 1)).join(" ")).length, 20);
    console.log("backlog hierarchy diagnostic tests passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
