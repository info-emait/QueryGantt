define(["services/backlog-order"], function (backlogOrder) {
    const analyze = function (args) {
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
                    return Promise.reject(new Error("The analysis reached its work item limit. Start another analysis from the last item shown."));
                }
                const request = Promise.resolve().then(() => args.client.getWorkItems(
                    [id], undefined, ["System.Id", "System.WorkItemType", "System.TeamProject"], null, 1
                )).then((items) => {
                    const item = (items || []).find((candidate) => Number(candidate.id) === id);
                    if (!item) {
                        throw new Error("This work item was not returned. It may have been removed or access may be restricted.");
                    }
                    const fields = item.fields || {};
                    const parents = (item.relations || []).filter((link) => link.rel === "System.LinkTypes.Hierarchy-Reverse");
                    const parentId = parents.length ? Number((parents[0].url || "").split("/").pop()) : Number(fields["System.Parent"] || 0);
                    if (!Number.isInteger(parentId) || parentId < 0 || parents.length > 1) {
                        throw new Error("The Parent links could not be read unambiguously.");
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
                    const reason = status === 401 || status === 403
                        ? "Access was denied. Check your permission to read this work item."
                        : status === 404 ? "This work item was not found or is inaccessible."
                        : "The Parent lookup failed. " + (error && error.message && !error.status && !error.statusCode ? error.message : "Try the analysis again or check your connection and read permissions.");
                    warnings.add(`#${id}. ${reason}`);
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
                    warnings.add("An ancestor belongs to another project. Its backlog categories need to be checked in that project.");
                }
                if (trace.items.some((node) => !knownTypes.has(node.type))) {
                    warnings.add("Some work item types have no known backlog category. Their Parent links need to be checked in the project's process settings.");
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
                        text: `${label(issue.child)} -> ${label(issue.parent)}. ${issue.reason}. Open #${issue.child.id} and check Links > Parent (#${issue.parent.id}). Correct this Parent link, or use Related for a non-hierarchical association.`
                    });
                });
            });
            return {
                summary: findings.size
                    ? "Found a Parent link that can prevent backlog reordering."
                    : warnings.size ? "The analysis is incomplete. No invalid Parent link was confirmed in the items checked."
                    : "No invalid Parent link was confirmed in the items checked.",
                findings: [...findings.values()],
                traces: traces.filter((trace) => trace.items.length).map((trace) => ({
                    text: "Parent chain from #" + trace.id,
                    items: trace.items.map((node) => ({ id: node.id, text: label(node) }))
                })),
                warnings: [...warnings]
            };
        };
        const timeout = new Promise((resolve) => {
            timer = setTimeout(() => {
                stopped = true;
                warnings.add("The analysis reached its time limit. The chains shown may be incomplete. You can run the analysis again.");
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
