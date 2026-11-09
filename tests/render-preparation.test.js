"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const path = require("path");
const source = fs.readFileSync(path.join(__dirname, "../js/querygantt-tab-app.js"), "utf8")
    .replace("return { start };", "return { Model: Model };");

let app;
const requestedModules = [];
const attachmentUploads = [];
const navigations = [];
const cells = new Map();
const workbook = {
    sheet: (name) => {
        assert.strictEqual(name, "GANTT");
        return { cell: (cell) => ({ value: (value) => cells.set(cell, value) }) };
    },
    outputAsync: () => Promise.resolve("example workbook")
};
const context = {
    document: {},
    console: { warn: () => {} },
    define: (names, factory) => {
        assert.ok(!names.includes("xlsx") && !names.includes("dom-to-image"), "export libraries must not be loaded by the application module");
        const dependencies = {
            module: { config: () => ({}) },
            require: (modules, resolve) => {
                requestedModules.push(Array.from(modules));
                resolve({ fromDataAsync: () => Promise.resolve(workbook) }, {
                    fetch: () => Promise.resolve({ ok: true, arrayBuffer: () => new ArrayBuffer(0) })
                });
            },
            sdk: { getService: () => Promise.resolve({ navigate: (url) => navigations.push(url) }) },
            "api/index": {
                CommonServiceIds: { HostNavigationService: "navigation" },
                getClient: () => ({
                    createAttachment: (blob, project, name) => {
                        attachmentUploads.push({ blob, project, name });
                        return Promise.resolve({ url: "https://example.test/export.xlsx" });
                    }
                })
            },
            "api/WorkItemTracking/index": {},
            "services/hierarchy-analysis": {},
            "services/hierarchy-localization": require("./helpers/load-pure-service")("hierarchy-localization")
        };
        app = factory(...names.map((name) => dependencies[name] || {}));
    }
};
vm.runInNewContext(source, context);
const model = Object.create(app.Model.prototype);
model.types = () => [{ name: "Task", states: [{ name: "New", category: "Proposed" }, { name: "Done", category: "Completed" }] }];
model.typesOther = () => [];

const rows = [];
const links = [];
let targetReads = 0;
let parentReads = 0;
for (let i = 0; i < 100; i++) {
    const root = i * 10 + 100;
    for (let j = 0; j < 5; j++) {
        const id = root + j;
        const parent = j ? String(root) : "";
        links.push({ source: j ? { id: root } : null, get target() { targetReads++; return { id }; } });
        rows.push({
            id, type: "Task", state: j % 2 ? "Done" : "New",
            path: j ? `${root}/${id}` : String(root),
            get parent() { parentReads++; return parent; }
        });
    }
}
const paths = model._createPathLookup(links);
for (const row of rows) {
    assert.deepStrictEqual(Array.from(paths(row.id)), [row.path]);
}
model._markCompletedWits(rows);
assert.ok(targetReads <= links.length * 2, "resolving the paths must not rescan the complete link list per item");
assert.ok(parentReads <= rows.length * 2, "counting completed children must not rescan all rows per item");
for (const row of rows) {
    assert.strictEqual(row.childCount, row.id % 10 ? 0 : 4);
    assert.strictEqual(row.childCompletedCount, row.id % 10 ? 0 : 2);
}

const directLinks = [
    { source: { id: 101 }, target: { id: 10 } },
    { source: { id: 101 }, target: { id: 10 } },
    { source: { id: 102 }, target: { id: 10 } },
    { source: { id: 10 }, target: { id: 20 } },
    { source: { id: 30 }, target: { id: 30 } }
];
const directPaths = model._createPathLookup(directLinks);
assert.deepStrictEqual(Array.from(directPaths(10)), ["101/10", "102/10"]);
assert.deepStrictEqual(Array.from(directPaths(20)), ["101/10/20"], "one-hop results should retain a stable path through the first source");
assert.deepStrictEqual(Array.from(directPaths(30)), ["30"], "a cyclic link should not prevent query rendering");

(async function () {
    const item = { id: 10, level: 1, title: "Example task", tags: ["test"] };
    const errors = [];
    Object.assign(model, {
        project: { id: "project-id" }, query: { name: "Example query" },
        wits: () => [item], isBacklogOrder: () => false,
        message: (message) => errors.push(message)
    });
    assert.deepStrictEqual(requestedModules, []);
    await model.download();
    assert.deepStrictEqual(requestedModules, [["xlsx", "my/templates/gantt"]]);
    assert.strictEqual(cells.get("B8"), 10);
    assert.strictEqual(cells.get("E8"), "Example task");
    assert.strictEqual(cells.get("I8"), "test");
    assert.strictEqual(attachmentUploads.length, 1);
    assert.strictEqual(attachmentUploads[0].blob, "example workbook");
    assert.strictEqual(attachmentUploads[0].project, "project-id");
    assert.match(attachmentUploads[0].name, /\.xlsx$/);
    assert.deepStrictEqual(navigations, ["https://example.test/export.xlsx"]);
    assert.deepStrictEqual(errors, []);

    console.log("render preparation tests passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
