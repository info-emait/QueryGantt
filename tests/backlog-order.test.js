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

const taskIndex = service.createIndex(backlogs.concat([
    { id: "tasks", rank: 0, workItemTypes: [{ name: "Task" }] }
]), responses.concat([{ workItems: [
    { source: { id: 1 }, target: { id: 31 } },
    { source: { id: 3 }, target: { id: 32 } }
] }]));
const task31 = item(31, "Task", "100/11/1/31", "100/11/1");
const task32 = item(32, "Task", "100/12/3/32", "100/12/3");
assert.deepStrictEqual(
    JSON.parse(JSON.stringify(service.planMove(taskIndex, task31, task32, "after").operation)),
    { ids: [31], parentId: 3, previousId: 32, nextId: 0 },
    "a Task should be reparented when it is placed beside a Task under another User Story"
);
assert.deepStrictEqual(
    JSON.parse(JSON.stringify(service.planMove(taskIndex, task31, story3, "inside").operation)),
    { ids: [31], parentId: 3, previousId: 32, nextId: 0 },
    "a Task should be appendable directly inside a different User Story"
);

const locallyMoved = service.applyMove(index, service.planMove(index, story2, story1, "before").operation);
assert.deepStrictEqual(
    JSON.parse(JSON.stringify([service.getEntry(locallyMoved, 2).position, service.getEntry(locallyMoved, 1).position])),
    [0, 1],
    "a successful same-parent move should update local sibling positions"
);
assert.strictEqual(service.getEntry(index, 2).position, 1, "the local move should not mutate the prior server index");
const locallyReparented = service.applyMove(index, service.planMove(index, story1, story3, "after").operation);
assert.strictEqual(service.getEntry(locallyReparented, 1).parentId, 12, "a successful cross-parent move should update the local parent");
assert.deepStrictEqual(
    JSON.parse(JSON.stringify(service.sortItems([story3, story1], locallyReparented).map((workItem) => workItem.id))),
    [3, 1],
    "the local index should expose the successful order without another API read"
);

assert.strictEqual(service.planMove(index, feature11, story1, "inside").valid, false, "a parent cannot move below a descendant");
assert.strictEqual(service.planMove(index, story1, story2, "inside").valid, false, "a work item cannot be nested under the same backlog category");
assert.strictEqual(service.planMove(index, story1, feature11, "before").valid, false, "before/after requires the same backlog level");
assert.strictEqual(service.planMove(index, item(999, "User Story", "999", "", false), story1, "before").valid, false, "unsupported items cannot move");
assert.strictEqual(service.isValidParent(index, service.getEntry(index, 1, "User Story"), 11), true, "a Feature is a valid parent for a User Story");
assert.strictEqual(service.isValidParent(index, service.getEntry(index, 1, "User Story"), 100), false, "an Epic cannot directly parent a User Story when the Feature level exists");

const invalidHierarchyResponses = [
    { workItems: [{ source: null, target: { id: 100 } }] },
    { workItems: [{ source: { id: 100 }, target: { id: 11 } }] },
    { workItems: [{ source: { id: 100 }, target: { id: 1 } }, { source: { id: 100 }, target: { id: 2 } }] }
];
const invalidHierarchyIndex = service.createIndex(backlogs, invalidHierarchyResponses);
const invalidStory1 = item(1, "User Story", "100/1", "100");
const invalidStory2 = item(2, "User Story", "100/2", "100");
const invalidMove = service.planMove(invalidHierarchyIndex, invalidStory1, invalidStory2, "before");
assert.strictEqual(invalidMove.valid, false);
assert.ok(invalidMove.reason.includes("#100") && invalidMove.reason.includes("#2"), "the invalid destination should identify the actionable parent-child link");
assert.strictEqual(service.planMove(invalidHierarchyIndex, invalidStory1, null, "root").valid, true, "an item with an invalid current parent can still be moved to root to repair the hierarchy");

const ambiguousHierarchyIndex = service.createIndex(backlogs, [
    { workItems: [{ source: null, target: { id: 100 } }] },
    { workItems: [{ source: null, target: { id: 100 } }] },
    { workItems: [{ source: { id: 100 }, target: { id: 1 } }, { source: { id: 100 }, target: { id: 2 } }] }
]);
const ambiguousStory1 = Object.assign(item(1, "User Story", "100/1", "100"), { parentId: 100, parentType: "Epic" });
const ambiguousStory2 = Object.assign(item(2, "User Story", "100/2", "100"), { parentId: 100, parentType: "Epic" });
service.includeQueryItems(ambiguousHierarchyIndex, [ambiguousStory1, ambiguousStory2]);
ambiguousStory1.backlogOrder = Object.assign({ eligible: true, targetEligible: true }, service.getEntry(ambiguousHierarchyIndex, 1, "User Story"));
ambiguousStory2.backlogOrder = Object.assign({ eligible: true, targetEligible: true }, service.getEntry(ambiguousHierarchyIndex, 2, "User Story"));
assert.strictEqual(service.getEntry(ambiguousHierarchyIndex, 100).backlogRank, 3, "untyped lookups should still use the known concrete work-item type");
assert.strictEqual(
    service.isValidParent(ambiguousHierarchyIndex, service.getEntry(ambiguousHierarchyIndex, 1, "User Story"), 100),
    false,
    "the concrete parent type must win when the same id appears in more than one backlog response"
);
assert.strictEqual(
    service.planMove(ambiguousHierarchyIndex, ambiguousStory1, ambiguousStory2, "before").valid,
    false,
    "an Epic-to-User Story category skip must be rejected before Azure receives the reorder request"
);

const sameCategoryChild = Object.assign(item(1, "User Story", "2/1", "2"), { parentId: 2, parentType: "User Story" });
service.includeQueryItems(index, [sameCategoryChild, Object.assign(item(2, "User Story", "2", ""), { parentId: null })]);
assert.strictEqual(
    service.isValidParent(index, service.getEntry(index, 1, "User Story"), 2),
    false,
    "same-category parent/child links must not be offered as valid backlog destinations"
);

const teamFieldValues = {
    field: { referenceName: "System.AreaPath" },
    defaultValue: "Project\\Team",
    values: [
        { value: "Project\\Team", includeChildren: true },
        { value: "Project\\Shared", includeChildren: false }
    ]
};
const teamIndex = service.createIndex(backlogs, responses, null, teamFieldValues);
const teamOwned = Object.assign(item(1, "User Story", "100/11/1", "100/11"), { areaPath: "Project\\Team\\Component" });
const exactShared = Object.assign(item(2, "User Story", "100/11/2", "100/11"), { areaPath: "Project\\Shared" });
const otherTeam = Object.assign(item(3, "User Story", "100/12/3", "100/12"), { areaPath: "Project\\Other" });
const outsideFeature = Object.assign(item(12, "Feature", "100/12", "100"), { areaPath: "Project\\Other" });
const ownedClosed = Object.assign(item(9, "User Story", "100/11/9", "100/11"), {
    areaPath: "Project\\Team",
    parentId: 11,
    backlogOrderValue: 150
});
const outsideSibling = Object.assign(item(8, "User Story", "100/11/8", "100/11"), {
    areaPath: "Project\\Other",
    parentId: 11,
    backlogOrderValue: 175
});
service.includeQueryItems(teamIndex, [teamOwned, exactShared, otherTeam, outsideFeature, ownedClosed, outsideSibling]);
assert.strictEqual(service.getEntry(teamIndex, 1, "User Story").teamOwned, true, "included child Area Paths should be reorderable");
assert.strictEqual(service.getEntry(teamIndex, 2, "User Story").teamOwned, true, "an exact non-recursive Area Path should be reorderable");
assert.strictEqual(service.getEntry(teamIndex, 3, "User Story").teamOwned, false, "items outside the team's Area Paths should not be sent to the reorder API");
otherTeam.backlogOrder = Object.assign({ eligible: true }, service.getEntry(teamIndex, 3, "User Story"));
teamOwned.backlogOrder = Object.assign({ eligible: true }, service.getEntry(teamIndex, 1, "User Story"));
exactShared.backlogOrder = Object.assign({ eligible: true, targetEligible: true }, service.getEntry(teamIndex, 2, "User Story"));
outsideFeature.backlogOrder = Object.assign({ eligible: false, targetEligible: true }, service.getEntry(teamIndex, 12, "Feature"));
ownedClosed.backlogOrder = Object.assign({ eligible: true }, service.getEntry(teamIndex, 9, "User Story"));
const otherTeamMove = service.planMove(teamIndex, otherTeam, teamOwned, "before");
assert.strictEqual(otherTeamMove.valid, false);
assert.ok(otherTeamMove.reason.includes("Area Paths"));
assert.strictEqual(service.planMove(teamIndex, teamOwned, outsideFeature, "inside").valid, false, "an item cannot be reparented below a work item outside the team's Area Paths");
assert.deepStrictEqual(
    JSON.parse(JSON.stringify(service.planMove(teamIndex, ownedClosed, exactShared, "after").operation)),
    { ids: [9], parentId: 11, previousId: 2, nextId: 0 },
    "an out-of-team sibling must not be sent as the next reorder anchor"
);

const defaultOnlyIndex = service.createIndex(backlogs, responses, null, {
    field: { referenceName: "System.AreaPath" },
    defaultValue: "Project\\Default",
    values: []
});
assert.strictEqual(service.isTeamOwned(defaultOnlyIndex, "Project\\Default"), true, "the default Area Path remains owned if the API omits it from values");
assert.strictEqual(service.isTeamOwned(defaultOnlyIndex, "Project\\Other"), false, "an empty values array must not make every Area Path reorderable when a default exists");

const active1 = Object.assign(item(1, "User Story", "100/11/1", "100/11"), { parentId: 11, backlogOrderValue: 100 });
const active2 = Object.assign(item(2, "User Story", "100/11/2", "100/11"), { parentId: 11, backlogOrderValue: 300 });
const closed = Object.assign(item(9, "User Story", "100/11/9", "100/11"), {
    parentId: 11,
    backlogOrderValue: 200,
    state: "Closed"
});
const closedLater = Object.assign(item(10, "User Story", "100/11/10", "100/11"), {
    parentId: 11,
    backlogOrderValue: 250,
    state: "Closed"
});
service.includeQueryItems(index, [active1, active2, closed, closedLater]);
const closedEntry = service.getEntry(index, 9, "User Story");
const closedLaterEntry = service.getEntry(index, 10, "User Story");
assert.ok(closedEntry && closedEntry.synthetic, "completed items omitted from the Backlog response should still participate in their configured backlog level");
assert.ok(closedEntry.position < closedLaterEntry.position, "multiple hidden items should retain their relative Order values between visible anchors");
closed.backlogOrder = Object.assign({ eligible: true }, closedEntry);
closedLater.backlogOrder = Object.assign({ eligible: true }, closedLaterEntry);
active1.backlogOrder = Object.assign({ eligible: true }, service.getEntry(index, 1, "User Story"));
active2.backlogOrder = Object.assign({ eligible: true }, service.getEntry(index, 2, "User Story"));
assert.deepStrictEqual(JSON.parse(JSON.stringify(service.sortItems([active2, closedLater, closed, active1], index).map((workItem) => workItem.id))), [1, 9, 10, 2], "the process Order field should place hidden completed items between visible anchors");
assert.deepStrictEqual(
    JSON.parse(JSON.stringify(service.planMove(index, closedLater, closed, "after").operation)),
    { ids: [10], parentId: 11, previousId: 9, nextId: 2 },
    "completed items should generate the same reorder request as active items"
);

const mixedOrderIndex = service.createIndex([
    { id: "tasks", rank: 0, workItemTypes: [{ name: "Task" }] }
], [{ workItems: [
    { source: { id: 50 }, target: { id: 101 } },
    { source: { id: 50 }, target: { id: 102 } },
    { source: { id: 50 }, target: { id: 103 } },
    { source: { id: 50 }, target: { id: 104 } }
] }], "Microsoft.VSTS.Common.StackRank");
const mixedItems = [
    Object.assign(item(101, "Task", "50/101", "50"), { parentId: 50, backlogOrderValue: 300 }),
    Object.assign(item(102, "Task", "50/102", "50"), { parentId: 50, backlogOrderValue: null }),
    Object.assign(item(103, "Task", "50/103", "50"), { parentId: 50, backlogOrderValue: 100 }),
    Object.assign(item(104, "Task", "50/104", "50"), { parentId: 50, backlogOrderValue: null })
];
service.includeQueryItems(mixedOrderIndex, mixedItems);
mixedItems.forEach((workItem) => {
    workItem.backlogOrder = Object.assign({ eligible: true, targetEligible: true }, service.getEntry(mixedOrderIndex, workItem.id, workItem.type));
});
assert.deepStrictEqual(
    JSON.parse(JSON.stringify(service.sortItems(mixedItems, mixedOrderIndex).map((workItem) => workItem.id))),
    [103, 101, 102, 104],
    "ranked siblings should be ordered by the process Order field before API-position fallbacks"
);
assert.deepStrictEqual(
    JSON.parse(JSON.stringify(service.planMove(mixedOrderIndex, mixedItems[3], mixedItems[2], "after").operation)),
    { ids: [104], parentId: 50, previousId: 103, nextId: 101 },
    "reorder anchors should follow the same total sibling order shown in the Gantt"
);

console.log("backlog-order tests passed");
