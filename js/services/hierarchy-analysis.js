define(["services/hierarchy-localization"], function (localization) {
    // This module is independent of backlog reordering and can be reviewed
    // and installed as a separate, read-only diagnostic feature.
    const createIndex = (backlogs) => ({ levels: Object.fromEntries((backlogs || []).map((level) => [level.id, {
        rank: level.rank, workItemTypes: (level.workItemTypes || []).map((type) => type.name || type)
    }])) });
    const findParentIssue = function (index, chain) {
        const levels = Object.values((index || {}).levels || {});
        const levelFor = (type) => levels.find((level) => level.workItemTypes.includes(type));
        const seen = new Set();
        for (let i = 0; i < chain.length; i++) {
            const parent = chain[i];
            if (seen.has(parent.id)) {
                return { child: chain[i - 1], parent, reasonCode: "parentCycle" };
            }
            seen.add(parent.id);
        }
        for (let i = 0; i < chain.length - 1; i++) {
            const child = chain[i], parent = chain[i + 1];
            const childLevel = levelFor(child.type), parentLevel = levelFor(parent.type);
            if (child.parentId === parent.id && childLevel && parentLevel && parentLevel.rank <= childLevel.rank) {
                return { child, parent, reasonCode: parentLevel.rank === childLevel.rank ? "sameCategory" : "reversedParent" };
            }
        }
        return null;
    };
    const errorDetail = function (culture, error) {
        const status = Number(error && (error.status || error.statusCode));
        const detail = error && ((error.serverError || {}).message || error.message);
        return [Number.isFinite(status) && status > 0 ? "HTTP " + status + "." : "",
            typeof(detail) === "string" && detail ? localization.text(culture, "lookupDetail", { detail }) : ""].filter(Boolean).join(" ");
    };
    const getSeeds = function (message, contextIds = []) {
        if (!message || (!contextIds.length && !/(?:reorder|backlog|parent|category|並[べび]替|親|階層)/i.test(message || ""))) {
            return [];
        }
        const matches = (message || "").match(/(?:work item\s*#?|作業項目\s*#?|作業アイテム\s*#?|#)\s*\d+/gi) || [];
        return [...new Set(contextIds.concat(matches.map((value) => value.match(/\d+/)[0])).map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))].slice(0, 20);
    };
    const itemUrl = function (item) {
        const link = item && item._links && item._links.html && item._links.html.href;
        if (typeof(link) === "string" && /^https?:\/\//i.test(link)) return link;
        return item && typeof(item.url) === "string" && /^https?:\/\//i.test(item.url)
            ? item.url.replace(/\/_apis\/wit\/workitems\/\d+\/?$/i, "/_workitems/edit/" + item.id) : "";
    };
    const analyze = function (args) {
        const text = (key, values) => localization.text(args.culture, key, values);
        const failure = (code) => {
            const error = new Error(text(code));
            error.analysisCode = code;
            return error;
        };
        const seeds = [...new Set((args.ids || []).map(Number).filter((id) => Number.isInteger(id) && id > 0))];
        const cache = new Map();
        const traces = seeds.map((id) => ({ id, items: [] }));
        const warnings = new Set();
        let stopped = false;
        let timer;
        const cancelled = () => stopped || (args.isCancelled && args.isCancelled());
        const label = (item) => `#${item.id}${item.type ? " (" + item.type + ")" : ""}`;
        const read = (id) => {
            if (!cache.has(id)) {
                if (cache.size >= (args.maxItems || 128)) {
                    return Promise.reject(failure("itemLimit"));
                }
                const request = Promise.resolve().then(() => args.client.getWorkItems(
                    [id], undefined, undefined, undefined, "all"
                )).then((items) => {
                    const item = (items || []).find((candidate) => Number(candidate.id) === id);
                    if (!item) {
                        throw failure("missingItem");
                    }
                    const fields = item.fields || {};
                    const parents = (item.relations || []).filter((link) => link.rel === "System.LinkTypes.Hierarchy-Reverse");
                    const parentId = parents.length ? Number((parents[0].url || "").split("/").pop()) : Number(fields["System.Parent"] || 0);
                    if (!Number.isInteger(parentId) || parentId < 0 || parents.length > 1) {
                        throw failure("ambiguousParent");
                    }
                    return { id, type: fields["System.WorkItemType"] || "", project: fields["System.TeamProject"] || "", parentId, url: itemUrl(item) };
                });
                cache.set(id, request);
            }
            return cache.get(id);
        };
        const walk = (trace, id, seen) => {
            if (!id || cancelled()) {
                return Promise.resolve();
            }
            return read(id).then((node) => {
                if (cancelled()) {
                    return;
                }
                trace.items.push(node);
                if (seen.has(id)) {
                    return;
                }
                seen.add(id);
                return walk(trace, node.parentId, seen);
            }).catch((error) => {
                if (!cancelled()) {
                    const status = Number(error && (error.status || error.statusCode));
                    const code = error && error.analysisCode;
                    const detail = ["itemLimit", "missingItem", "ambiguousParent"].includes(code) ? code : "lookupRetry";
                    let reason = status === 401 || status === 403
                        ? text("accessDenied")
                        : status === 404 ? text("notFound")
                        : text("lookupFailed", { reason: text(detail) });
                    if (!code) {
                        reason += " " + errorDetail(args.culture, error);
                    }
                    warnings.add(text("warning", { id, reason }));
                }
            });
        };
        const finish = () => {
            const findings = new Map();
            const sameProject = (node) => !node.project || node.project === args.projectName;
            const knownTypes = new Set(Object.keys((args.index || {}).levels || {}).reduce((names, id) => names.concat(args.index.levels[id].workItemTypes || []), []));
            traces.forEach((trace) => {
                const crossProject = trace.items.some((node) => node.project && node.project !== args.projectName);
                if (crossProject) {
                    warnings.add(text("crossProject"));
                }
                if (trace.items.some((node) => !knownTypes.has(node.type))) {
                    warnings.add(text("unknownCategory"));
                }
                const issues = [];
                for (let i = 0; i < trace.items.length - 1; i++) {
                    const pair = trace.items.slice(i, i + 2);
                    if (pair.every(sameProject)) {
                        const issue = findParentIssue(args.index, pair);
                        if (issue) {
                            issues.push(issue);
                        }
                    }
                }
                const cycle = findParentIssue({}, trace.items);
                if (cycle) {
                    issues.push(cycle);
                }
                issues.forEach((issue) => {
                    findings.set(issue.child.id + "/" + issue.parent.id, {
                        child: issue.child.id, parent: issue.parent.id,
                        childUrl: issue.child.url, parentUrl: issue.parent.url,
                        text: text("finding", {
                            child: label(issue.child), parent: label(issue.parent),
                            childId: issue.child.id, parentId: issue.parent.id, reason: text(issue.reasonCode)
                        })
                    });
                });
            });
            return {
                summary: findings.size
                    ? text("found")
                    : warnings.size ? text("incomplete") : text("none"),
                findings: [...findings.values()],
                traces: traces.filter((trace) => trace.items.length).map((trace) => ({
                    text: text("chainFrom", { id: trace.id }),
                    items: trace.items.map((node) => ({ id: node.id, text: label(node), url: node.url }))
                })),
                warnings: [...warnings]
            };
        };
        const timeout = new Promise((resolve) => {
            timer = setTimeout(() => {
                stopped = true;
                warnings.add(text("timeLimit"));
                resolve(finish());
            }, args.timeoutMs || 15000);
        });
        const work = Promise.all(traces.map((trace) => walk(trace, trace.id, new Set()))).then(finish);
        return Promise.race([work, timeout]).then((result) => {
            stopped = true;
            clearTimeout(timer);
            return result;
        });
    };
    return { analyze, createIndex, findParentIssue, getSeeds, errorDetail };
});
