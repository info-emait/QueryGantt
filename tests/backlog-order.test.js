"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const loadService = function () {
    let result = null;
    const source = fs.readFileSync(path.join(__dirname, "../js/services/backlog-order.js"), "utf8");
    const context = {
        define: function (dependencies, factory) {
            result = factory();
        },
        Map: Map,
        Number: Number,
        Set: Set
    };
    vm.runInNewContext(source, context, { filename: "backlog-order.js" });
    return result;
};

const service = loadService();
const backlogs = [
    { id: "epics", rank: 3, workItemTypes: [{ name: "Epic" }] },
    { id: "features", rank: 2, workItemTypes: [{ name: "Feature" }] },
    { id: "stories", rank: 1, workItemTypes: [{ name: "User Story" }] }
];
const responses = [
    { workItems: [
        { source: null, target: { id: 100 } },
        { source: null, target: { id: 200 } }
    ] },
    { workItems: [
        { source: { id: 100 }, target: { id: 11 } },
        { source: { id: 100 }, target: { id: 12 } },
        { source: { id: 200 }, target: { id: 21 } }
    ] },
    { workItems: [
        { source: { id: 11 }, target: { id: 1 } },
        { source: { id: 11 }, target: { id: 2 } },
        { source: { id: 12 }, target: { id: 3 } },
        { source: null, target: { id: 4 } }
    ] }
];
const index = service.createIndex(backlogs, responses);

const item = function (id, type, itemPath, parentPath, eligible = true) {
    return {
        id: id,
        originalId: id,
        type: type,
        path: itemPath,
        parent: parentPath,
        backlogOrder: { eligible: eligible }
    };
};

assert.strictEqual(index.size, 9, "all backlog links should be indexed");
assert.deepStrictEqual(
    JSON.parse(JSON.stringify(service.getEntry(index, 2, "User Story"))),
    { id: 2, parentId: 11, backlogId: "stories", backlogRank: 1, levelPosition: 2, position: 1 }
);

const scrambled = [
    item(200, "Epic", "200", ""),
    item(21, "Feature", "200/21", "200"),
    item(100, "Epic", "100", ""),
    item(12, "Feature", "100/12", "100"),
    item(3, "User Story", "100/12/3", "100/12"),
    item(11, "Feature", "100/11", "100"),
    item(2, "User Story", "100/11/2", "100/11"),
    item(1, "User Story", "100/11/1", "100/11"),
    item(999, "User Story", "999", "")
];
assert.deepStrictEqual(
    JSON.parse(JSON.stringify(service.sortItems(scrambled, index).map((workItem) => workItem.id))),
    [100, 11, 1, 2, 12, 3, 200, 21, 999],
    "backlog order should sort roots and siblings while preserving the query tree"
);

const story1 = item(1, "User Story", "100/11/1", "100/11");
const story2 = item(2, "User Story", "100/11/2", "100/11");
const story3 = item(3, "User Story", "100/12/3", "100/12");
const feature11 = item(11, "Feature", "100/11", "100");
const feature12 = item(12, "Feature", "100/12", "100");

assert.deepStrictEqual(
    JSON.parse(JSON.stringify(service.planMove(index, story2, story1, "before").operation)),
    { ids: [2], parentId: 11, previousId: 0, nextId: 1 },
    "moving before the first sibling should use nextId"
);
assert.deepStrictEqual(
    JSON.parse(JSON.stringify(service.planMove(index, story1, story3, "after").operation)),
    { ids: [1], parentId: 12, previousId: 3, nextId: 0 },
    "moving after an item under another parent should also reparent"
);
assert.deepStrictEqual(
    JSON.parse(JSON.stringify(service.planMove(index, story1, feature12, "inside").operation)),
    { ids: [1], parentId: 12, previousId: 3, nextId: 0 },
    "dropping on the next parent level should append the item as a child"
);
assert.deepStrictEqual(
    JSON.parse(JSON.stringify(service.planMove(index, story1, null, "root").operation)),
    { ids: [1], parentId: 0, previousId: 4, nextId: 0 },
    "dropping on the root target should append at the root of the same backlog"
);

assert.strictEqual(service.planMove(index, feature11, story1, "inside").valid, false, "a parent cannot move below a descendant");
assert.strictEqual(service.planMove(index, story1, feature11, "before").valid, false, "before/after requires the same backlog level");
assert.strictEqual(service.planMove(index, item(999, "User Story", "999", "", false), story1, "before").valid, false, "unsupported items cannot move");

console.log("backlog-order tests passed");
