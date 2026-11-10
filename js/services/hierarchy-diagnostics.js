define([
    "knockout", "sdk", "api/index", "api/Work/index", "api/WorkItemTracking/index",
    "services/hierarchy-analysis", "services/hierarchy-localization"
], function (ko, sdk, api, workApi, witApi, analysisService, localization) {
    // Own diagnostic state in the message component, independently of the
    // reorder model. Only the user's Analyze action starts REST requests.
    const create = function (text, context) {
        const culture = ko.observable("en");
        const busy = ko.observable(false);
        const analysis = ko.observable(null);
        let current = null;
        let disposed = false;
        const label = (key, values) => localization.text(culture(), key, values);
        const reset = () => {
            if (current) current.cancelled = true;
            current = null;
            busy(false);
            analysis(null);
        };
        const subscription = text.subscribe(reset);
        const contextSubscription = ko.isObservable(context) ? context.subscribe(reset) : null;
        const seeds = () => analysisService.getSeeds(text(), (ko.unwrap(context) || {}).workItemIds || []);
        const ready = () => sdk.ready().then(() => {
            if (!disposed) culture(localization.getLanguage(sdk));
        });
        ready().catch(() => {});
        const run = function () {
            const ids = seeds();
            if (disposed || busy() || !ids.length) return Promise.resolve(false);
            const request = { cancelled: false };
            current = request;
            busy(true);
            analysis(null);
            let timer;
            const started = Date.now();
            const cancelled = () => disposed || request.cancelled || current !== request;
            const failure = (error) => ({ summary: label("failed"), findings: [], traces: [],
                warnings: [analysisService.errorDetail(culture(), error)].filter(Boolean) });
            const work = ready().then(() => {
                if (cancelled()) return null;
                const web = sdk.getWebContext();
                return web && web.project ? web.project
                    : sdk.getService(api.CommonServiceIds.ProjectPageService).then((service) => service.getProject());
            }).then((project) => {
                if (cancelled()) return null;
                if (!project || !project.id) throw new Error(label("missingProject"));
                const team = sdk.getTeamContext();
                return Promise.resolve().then(() => api.getClient(workApi.WorkRestClient).getBacklogs({ projectId: project.id, teamId: team && team.id }))
                    .then((levels) => ({ project, index: analysisService.createIndex(levels), warnings: [] }),
                        (error) => ({ project, index: analysisService.createIndex([]),
                            warnings: [label("categoryFailed") + " " + analysisService.errorDetail(culture(), error)] }));
            }).then((context) => {
                if (!context || cancelled()) return null;
                clearTimeout(timer); // the ancestor walk keeps its own remaining-time budget
                return analysisService.analyze({ ids, client: api.getClient(witApi.WorkItemTrackingRestClient),
                    projectName: context.project.name, index: context.index, culture: culture(), isCancelled: cancelled,
                    timeoutMs: Math.max(1, 15000 - (Date.now() - started))
                }).then((result) => {
                    result.warnings = context.warnings.concat(result.warnings);
                    if (result.warnings.length && !result.findings.length) result.summary = label("incomplete");
                    return result;
                });
            }).catch(failure);
            const timeout = new Promise((resolve) => {
                timer = setTimeout(() => {
                    request.cancelled = true;
                    resolve({ summary: label("incomplete"), findings: [], traces: [], warnings: [label("timeLimit")] });
                }, 15000);
            });
            return Promise.race([work, timeout]).then((result) => {
                clearTimeout(timer);
                if (current !== request || disposed) return false;
                analysis(result);
                busy(false);
                current = null;
                return true;
            });
        };
        const action = ko.pureComputed(() => seeds().length ? run : null);
        return { culture, busy, analysis, action, label, run,
            dispose: () => { disposed = true; reset(); subscription.dispose(); if (contextSubscription) contextSubscription.dispose(); action.dispose(); } };
    };
    return { create };
});
