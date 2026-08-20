define([], () => {
    //#region [ Fields ]

    const queryOrder = "query";
    const backlogOrder = "backlog";

    //#endregion


    //#region [ Methods : Public ]

    /**
     * Creates an empty backlog index.
     */
    const empty = function () {
        return {
            entries: {},
            levels: {},
            allEntries: [],
            size: 0
        };
    };


    /**
     * Creates a lookup index from Azure Boards backlog responses.
     *
     * @param {array} backlogs Backlog level configurations.
     * @param {array} responses Work item responses aligned with the backlog levels.
     */
    const createIndex = function (backlogs, responses) {
        const index = empty();

        (backlogs || []).forEach((backlog, backlogPosition) => {
            const level = {
                id: backlog.id,
                rank: backlog.rank,
                position: backlogPosition,
                workItemTypes: (backlog.workItemTypes || []).map((type) => type.name || type)
            };
            index.levels[level.id] = level;

            const response = (responses || [])[backlogPosition] || {};
            (response.workItems || []).forEach((link, position) => {
                if (!link.target || !Number.isInteger(Number(link.target.id))) {
                    return;
                }

                const entry = {
                    id: Number(link.target.id),
                    parentId: link.source && Number.isInteger(Number(link.source.id)) ? Number(link.source.id) : 0,
                    backlogId: level.id,
                    backlogRank: level.rank,
                    levelPosition: level.position,
                    position: position
                };

                index.entries[entry.id] = index.entries[entry.id] || [];
                index.entries[entry.id].push(entry);
                index.allEntries.push(entry);
                index.size += 1;
            });
        });

        return index;
    };


    /**
     * Gets backlog metadata for a work item.
     *
     * @param {object} index Backlog index.
     * @param {number|string} id Work item id.
     * @param {string} type Work item type.
     */
    const getEntry = function (index, id, type) {
        const entries = ((index || {}).entries || {})[toId(id)] || [];
        if (!entries.length) {
            return null;
        }

        if (type) {
            const match = entries.find((entry) => {
                const level = index.levels[entry.backlogId] || {};
                return (level.workItemTypes || []).includes(type);
            });
            if (match) {
                return match;
            }
        }

        return entries[0];
    };


    /**
     * Sorts query work items according to their current team backlog order.
     * Query hierarchy is preserved and only siblings are reordered.
     *
     * @param {array} items Query work items.
     * @param {object} index Backlog index.
     */
    const sortItems = function (items, index) {
        const source = (items || []).slice();
        const originalPosition = new Map();
        const itemByPath = new Map();
        const childrenByPath = new Map();

        source.forEach((item, position) => {
            originalPosition.set(item, position);
            if (item.path !== undefined && item.path !== null) {
                itemByPath.set(item.path + "", item);
            }
        });

        const roots = [];
        source.forEach((item) => {
            const parentPath = item.parent !== undefined && item.parent !== null ? item.parent + "" : "";
            if (parentPath && itemByPath.has(parentPath)) {
                childrenByPath.set(parentPath, childrenByPath.get(parentPath) || []);
                childrenByPath.get(parentPath).push(item);
                return;
            }
            roots.push(item);
        });

        const compare = function (left, right) {
            const leftEntry = getEntry(index, getOriginalId(left), left.type);
            const rightEntry = getEntry(index, getOriginalId(right), right.type);

            if (leftEntry && !rightEntry) {
                return -1;
            }
            if (!leftEntry && rightEntry) {
                return 1;
            }
            if (leftEntry && rightEntry) {
                if (leftEntry.backlogRank !== rightEntry.backlogRank) {
                    return rightEntry.backlogRank - leftEntry.backlogRank;
                }
                if (leftEntry.backlogId === rightEntry.backlogId && leftEntry.position !== rightEntry.position) {
                    return leftEntry.position - rightEntry.position;
                }
            }

            return originalPosition.get(left) - originalPosition.get(right);
        };

        const result = [];
        const visited = new Set();
        const append = function (siblings) {
            siblings.slice().sort(compare).forEach((item) => {
                if (visited.has(item)) {
                    return;
                }
                visited.add(item);
                result.push(item);
                append(childrenByPath.get(item.path + "") || []);
            });
        };

        append(roots);
        append(source.filter((item) => !visited.has(item)));
        return result;
    };


    /**
     * Creates a safe Azure Boards reorder operation for a drag/drop action.
     *
     * @param {object} index Backlog index.
     * @param {object} dragged Dragged query work item.
     * @param {object|null} target Drop target work item.
     * @param {string} position Drop position: before, after, inside, or root.
     */
    const planMove = function (index, dragged, target, position) {
        const draggedId = getOriginalId(dragged);
        const draggedEntry = getEntry(index, draggedId, dragged && dragged.type);
        const targetId = getOriginalId(target);
        const targetEntry = target ? getEntry(index, targetId, target.type) : null;

        if (!draggedEntry || !dragged || !dragged.backlogOrder || !dragged.backlogOrder.eligible) {
            return invalid("The work item is not eligible for backlog reordering.");
        }
        if (target && (!targetEntry || !target.backlogOrder || !target.backlogOrder.eligible)) {
            return invalid("The drop target is not eligible for backlog reordering.");
        }
        if (target && draggedId === targetId) {
            return invalid("A work item cannot be dropped onto itself.");
        }
        if (target && isDescendant(index, targetId, draggedId)) {
            return invalid("A work item cannot be moved below its own descendant.");
        }

        let parentId = 0;
        let previousId = 0;
        let nextId = 0;

        if ((position === "before") || (position === "after")) {
            if (!targetEntry || (targetEntry.backlogId !== draggedEntry.backlogId)) {
                return invalid("Items can only be placed before or after another item from the same backlog level.");
            }

            parentId = targetEntry.parentId;
            const siblings = getSiblings(index, draggedEntry.backlogId, parentId, draggedId);
            const targetPosition = siblings.findIndex((entry) => entry.id === targetId);
            if (targetPosition < 0) {
                return invalid("The drop target is not present in the selected backlog.");
            }

            if (position === "before") {
                previousId = targetPosition > 0 ? siblings[targetPosition - 1].id : 0;
                nextId = targetId;
            }
            else {
                previousId = targetId;
                nextId = targetPosition < siblings.length - 1 ? siblings[targetPosition + 1].id : 0;
            }
        }
        else if (position === "inside") {
            if (!targetEntry || (targetEntry.backlogRank !== draggedEntry.backlogRank + 1)) {
                return invalid("The target must be in the next parent backlog level.");
            }

            parentId = targetId;
            const children = getSiblings(index, draggedEntry.backlogId, parentId, draggedId);
            previousId = children.length ? children[children.length - 1].id : 0;
        }
        else if (position === "root") {
            const roots = getSiblings(index, draggedEntry.backlogId, 0, draggedId);
            previousId = roots.length ? roots[roots.length - 1].id : 0;
        }
        else {
            return invalid("Unknown backlog drop position.");
        }

        return {
            valid: true,
            position: position,
            operation: {
                ids: [draggedId],
                parentId: parentId,
                previousId: previousId,
                nextId: nextId
            }
        };
    };

    //#endregion


    //#region [ Methods : Private ]

    const toId = function (value) {
        const id = Number(value);
        return Number.isInteger(id) ? id : null;
    };


    const getOriginalId = function (item) {
        if (!item) {
            return null;
        }
        return toId(item.originalId !== undefined ? item.originalId : item.id);
    };


    const getSiblings = function (index, backlogId, parentId, excludedId) {
        return ((index || {}).allEntries || [])
            .filter((entry) => (entry.backlogId === backlogId) && (entry.parentId === parentId) && (entry.id !== excludedId))
            .sort((left, right) => left.position - right.position);
    };


    const isDescendant = function (index, possibleDescendantId, ancestorId) {
        const visited = new Set();
        let currentId = possibleDescendantId;

        while (currentId && !visited.has(currentId)) {
            if (currentId === ancestorId) {
                return true;
            }
            visited.add(currentId);
            const current = getEntry(index, currentId);
            currentId = current ? current.parentId : 0;
        }

        return false;
    };


    const invalid = function (reason) {
        return {
            valid: false,
            reason: reason
        };
    };

    //#endregion


    return {
        queryOrder: queryOrder,
        backlogOrder: backlogOrder,
        empty: empty,
        createIndex: createIndex,
        getEntry: getEntry,
        sortItems: sortItems,
        planMove: planMove
    };
});
