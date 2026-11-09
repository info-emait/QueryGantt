define(["services/backlog-order", "services/hierarchy-localization"], function (backlogOrder, localization) {
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
                    [id], undefined, ["System.Id", "System.WorkItemType", "System.TeamProject"], null, 1
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
                    return { id, type: fields["System.WorkItemType"] || "", project: fields["System.TeamProject"] || "", parentId };
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
                    if (!status && !code && error && typeof(error.message) === "string" && error.message) {
                        reason += " " + text("lookupDetail", { detail: error.message });
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
                        const issue = backlogOrder.findParentIssue(args.index, pair);
                        if (issue) {
                            issues.push(issue);
                        }
                    }
                }
                const cycle = backlogOrder.findParentIssue(backlogOrder.empty(), trace.items);
                if (cycle) {
                    issues.push(cycle);
                }
                issues.forEach((issue) => {
                    findings.set(issue.child.id + "/" + issue.parent.id, {
                        child: issue.child.id, parent: issue.parent.id,
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
                    items: trace.items.map((node) => ({ id: node.id, text: label(node) }))
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
    return { analyze };
});
