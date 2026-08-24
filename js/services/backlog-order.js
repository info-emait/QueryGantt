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
            size: 0,
            orderField: null,
            teamFieldValues: null
        };
    };


    /**
     * Creates a lookup index from Azure Boards backlog responses.
     *
     * @param {array} backlogs Backlog level configurations.
     * @param {array} responses Work item responses aligned with the backlog levels.
     * @param {string} orderField Process-specific Order field reference name.
     * @param {object} teamFieldValues Area paths owned by the current team.
     */
    const createIndex = function (backlogs, responses, orderField, teamFieldValues) {
        const index = empty();
        index.orderField = orderField || null;
        index.teamFieldValues = cloneTeamFieldValues(teamFieldValues);

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
     * Adds query work items that participate in a backlog level but are not in
     * the backlog response (notably completed items hidden by Azure Boards).
     * Azure's process-specific Order value is used when available.
     *
     * @param {object} index Backlog index.
     * @param {array} items Normalized query work items.
     */
    const includeQueryItems = function (index, items) {
        index = index || empty();
        const source = items || [];

        // First attach Order values to entries returned by the Backlog API so
        // synthetic entries can be placed near reliable visible anchors.
        source.forEach((item) => {
            const entry = getEntry(index, getOriginalId(item), item && item.type);
            const orderValue = toNumber(item && item.backlogOrderValue);
            if (entry) {
                entry.teamOwned = isTeamOwned(index, item && item.areaPath);
                if (orderValue !== null) {
                    entry.orderValue = orderValue;
                }
            }
        });

        const synthetic = [];
        source.forEach((item) => {
            const id = getOriginalId(item);
            const level = getLevelForType(index, item && item.type);
            if (id === null || !level || getEntry(index, id, item && item.type)) {
                return;
            }

            const entry = {
                id,
                parentId: toId(item && item.parentId) || 0,
                backlogId: level.id,
                backlogRank: level.rank,
                levelPosition: level.position,
                position: Number.MAX_SAFE_INTEGER,
                synthetic: true,
                teamOwned: isTeamOwned(index, item && item.areaPath)
            };
            const orderValue = toNumber(item && item.backlogOrderValue);
            if (orderValue !== null) {
                entry.orderValue = orderValue;
            }

            index.entries[id] = index.entries[id] || [];
            index.entries[id].push(entry);
            index.allEntries.push(entry);
            index.size += 1;
            synthetic.push(entry);
        });

        // Estimate a hidden item's existing position from visible query
        // anchors. Azure assigns the authoritative Order value after a move.
        const groups = {};
        synthetic.forEach((entry) => {
            const key = `${entry.backlogId}|${entry.parentId}`;
            groups[key] = groups[key] || [];
            groups[key].push(entry);
        });
        Object.keys(groups).forEach((key) => {
            const hiddenEntries = groups[key].sort((left, right) => {
                const leftOrder = toNumber(left.orderValue);
                const rightOrder = toNumber(right.orderValue);
                if (leftOrder !== null && rightOrder !== null && leftOrder !== rightOrder) {
                    return leftOrder - rightOrder;
                }
                if (leftOrder !== null) {
                    return -1;
                }
                if (rightOrder !== null) {
                    return 1;
                }
                return left.id - right.id;
            });
            const sample = hiddenEntries[0];
            const siblings = index.allEntries.filter((candidate) => !candidate.synthetic
                && candidate.backlogId === sample.backlogId
                && candidate.parentId === sample.parentId);
            const anchors = siblings
                .filter((candidate) => toNumber(candidate.orderValue) !== null)
                .sort((left, right) => left.orderValue - right.orderValue);
            const buckets = {};

            hiddenEntries.forEach((entry) => {
                const orderValue = toNumber(entry.orderValue);
                const next = orderValue === null ? null : anchors.find((candidate) => candidate.orderValue > orderValue);
                const previous = orderValue === null ? null : anchors.slice().reverse().find((candidate) => candidate.orderValue <= orderValue);
                const bucketKey = `${previous ? previous.id : "start"}|${next ? next.id : "end"}`;
                buckets[bucketKey] = buckets[bucketKey] || { previous, next, entries: [] };
                buckets[bucketKey].entries.push(entry);
            });

            Object.keys(buckets).forEach((bucketKey) => {
                const bucket = buckets[bucketKey];
                const count = bucket.entries.length;
                const lastPosition = siblings.reduce((maximum, candidate) => Math.max(maximum, candidate.position), -1);
                bucket.entries.forEach((entry, position) => {
                    if (bucket.previous && bucket.next) {
                        entry.position = bucket.previous.position
                            + ((bucket.next.position - bucket.previous.position) * (position + 1) / (count + 1));
                    }
                    else if (bucket.next) {
                        entry.position = bucket.next.position - ((count - position) * 0.5);
                    }
                    else if (bucket.previous) {
                        entry.position = bucket.previous.position + ((position + 1) * 0.5);
                    }
                    else {
                        entry.position = lastPosition + position + 1;
                    }
                });
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
                if (leftEntry.backlogId === rightEntry.backlogId
                    && toNumber(leftEntry.orderValue) !== null
                    && toNumber(rightEntry.orderValue) !== null
                    && leftEntry.orderValue !== rightEntry.orderValue) {
                    return leftEntry.orderValue - rightEntry.orderValue;
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
        if (draggedEntry.teamOwned === false) {
            return invalid(`Work item #${draggedId} is outside the current team's Area Paths and cannot be reordered here.`);
        }
        if (target && (!targetEntry || !target.backlogOrder || target.backlogOrder.targetEligible === false)) {
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
            if (!target.backlogOrder.eligible || targetEntry.teamOwned === false) {
                return invalid("Items can only be reordered relative to another item in the current team's Area Paths.");
            }
            if (!isValidParent(index, draggedEntry, targetEntry.parentId)) {
                return invalid(`Work item #${targetId} has parent #${targetEntry.parentId}, which is not in the next backlog category.`);
            }

            parentId = targetEntry.parentId;
            const siblings = getReorderSiblings(index, draggedEntry.backlogId, parentId, draggedId);
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
            if (!targetEntry || !target.backlogOrder.eligible || targetEntry.teamOwned === false
                || (targetEntry.backlogRank !== draggedEntry.backlogRank + 1)) {
                return invalid("The target must be in the next parent backlog level.");
            }

            parentId = targetId;
            const children = getReorderSiblings(index, draggedEntry.backlogId, parentId, draggedId);
            previousId = children.length ? children[children.length - 1].id : 0;
        }
        else if (position === "root") {
            const roots = getReorderSiblings(index, draggedEntry.backlogId, 0, draggedId);
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


    /**
     * Applies a successful Azure Boards reorder operation to a cloned backlog
     * index. This lets the UI update immediately without refetching the query.
     *
     * @param {object} index Current backlog index.
     * @param {object} operation Successful Azure Boards reorder operation.
     */
    const applyMove = function (index, operation) {
        const result = cloneIndex(index);
        const ids = ((operation || {}).ids || []).map(toId).filter((id) => id !== null);
        if (ids.length !== 1) {
            return result;
        }

        const moved = getEntry(result, ids[0]);
        if (!moved) {
            return result;
        }

        const oldParentId = moved.parentId;
        const newParentId = toId(operation.parentId) || 0;
        const siblings = getSiblings(result, moved.backlogId, newParentId, moved.id);
        let insertAt = siblings.length;
        const nextId = toId(operation.nextId);
        const previousId = toId(operation.previousId);
        if (nextId) {
            const nextPosition = siblings.findIndex((entry) => entry.id === nextId);
            if (nextPosition >= 0) {
                insertAt = nextPosition;
            }
        }
        else if (previousId) {
            const previousPosition = siblings.findIndex((entry) => entry.id === previousId);
            if (previousPosition >= 0) {
                insertAt = previousPosition + 1;
            }
        }

        moved.parentId = newParentId;
        siblings.splice(insertAt, 0, moved);
        reindexSiblings(siblings);

        if (oldParentId !== newParentId) {
            reindexSiblings(getSiblings(result, moved.backlogId, oldParentId, moved.id));
        }

        return result;
    };

    //#endregion


    //#region [ Methods : Private ]

    const toId = function (value) {
        const id = Number(value);
        return Number.isInteger(id) ? id : null;
    };


    const toNumber = function (value) {
        if (value === null || typeof(value) === "undefined" || value === "") {
            return null;
        }
        const result = Number(value);
        return Number.isFinite(result) ? result : null;
    };


    const getOriginalId = function (item) {
        if (!item) {
            return null;
        }
        return toId(item.originalId !== undefined ? item.originalId : item.id);
    };


    const getLevelForType = function (index, type) {
        return Object.keys((index || {}).levels || {})
            .map((id) => index.levels[id])
            .find((level) => (level.workItemTypes || []).includes(type)) || null;
    };


    const getSiblings = function (index, backlogId, parentId, excludedId) {
        return ((index || {}).allEntries || [])
            .filter((entry) => (entry.backlogId === backlogId) && (entry.parentId === parentId) && (entry.id !== excludedId))
            .sort((left, right) => left.position - right.position);
    };


    const getReorderSiblings = function (index, backlogId, parentId, excludedId) {
        return getSiblings(index, backlogId, parentId, excludedId)
            .filter((entry) => entry.teamOwned !== false);
    };


    const reindexSiblings = function (siblings) {
        (siblings || []).forEach((entry, position) => {
            entry.position = position;
            // sortItems prefers the process Order value when present. A local
            // sequential value therefore makes the successful move visible
            // immediately while Azure keeps the authoritative persisted rank.
            entry.orderValue = position;
        });
    };


    const cloneIndex = function (index) {
        index = index || empty();
        const result = empty();
        result.orderField = index.orderField || null;
        result.teamFieldValues = cloneTeamFieldValues(index.teamFieldValues);
        Object.keys(index.levels || {}).forEach((id) => {
            result.levels[id] = Object.assign({}, index.levels[id], {
                workItemTypes: ((index.levels[id] || {}).workItemTypes || []).slice()
            });
        });
        (index.allEntries || []).forEach((entry) => {
            const copy = Object.assign({}, entry);
            result.entries[copy.id] = result.entries[copy.id] || [];
            result.entries[copy.id].push(copy);
            result.allEntries.push(copy);
            result.size += 1;
        });
        return result;
    };


    /**
     * Returns whether a parent belongs to the immediately higher backlog
     * category. Unknown external parents are left to Azure DevOps to validate.
     */
    const isValidParent = function (index, childEntry, parentId) {
        parentId = toId(parentId);
        if (!parentId) {
            return true;
        }
        if (!childEntry) {
            return false;
        }

        const parents = (((index || {}).entries || {})[parentId] || []);
        if (!parents.length) {
            return true;
        }
        return parents.some((parent) => parent.backlogRank === childEntry.backlogRank + 1);
    };


    /**
     * Returns whether an Area Path is owned by the current team.
     */
    const isTeamOwned = function (index, areaPath) {
        const settings = (index || {}).teamFieldValues;
        if (!settings) {
            return true;
        }
        if (settings.referenceName && settings.referenceName !== "System.AreaPath") {
            return true;
        }
        if (!areaPath) {
            return false;
        }

        const itemPath = normalizePath(areaPath);
        const values = (settings.values || []).slice();
        if (settings.defaultValue && !values.some((value) => normalizePath(value.value) === normalizePath(settings.defaultValue))) {
            values.push({ value: settings.defaultValue, includeChildren: false });
        }
        if (!values.length) {
            return true;
        }
        return values.some((fieldValue) => {
            const teamPath = normalizePath(fieldValue.value);
            return itemPath === teamPath || (fieldValue.includeChildren && itemPath.indexOf(teamPath + "\\") === 0);
        });
    };


    const normalizePath = function (value) {
        return (value || "").replace(/\\+$/g, "").toLowerCase();
    };


    const cloneTeamFieldValues = function (settings) {
        if (!settings) {
            return null;
        }
        return {
            referenceName: ((settings.field || {}).referenceName || settings.referenceName || null),
            defaultValue: settings.defaultValue || null,
            values: (settings.values || []).map((value) => ({
                value: value.value,
                includeChildren: Boolean(value.includeChildren)
            }))
        };
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
        includeQueryItems: includeQueryItems,
        getEntry: getEntry,
        sortItems: sortItems,
        planMove: planMove,
        applyMove: applyMove,
        isValidParent: isValidParent,
        isTeamOwned: isTeamOwned
    };
});
