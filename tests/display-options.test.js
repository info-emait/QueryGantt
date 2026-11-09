"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ko = require("knockout");
const root = path.resolve(__dirname, "..");
let stored = { showFields: ["id"], orderMode: "query", otherSetting: "keep" };
let closed;
let panel;
let live;
let writes = 0;
const manager = {
    getValue: () => Promise.resolve(JSON.stringify(stored)),
    setValue: (key, value) => {
        assert.strictEqual(key, "gantt_project-id");
        writes++;
        stored = JSON.parse(value);
        return Promise.resolve();
    }
};
const sdk = {
    init: () => {},
    ready: () => Promise.resolve(),
    getConfiguration: () => ({ query: { id: "query", name: "Synthetic" } }),
    getUser: () => ({ displayName: "Test" }),
    getExtensionContext: () => ({ id: "test.querygantt" }),
    getTeamContext: () => null,
    getService: (id) => {
        if (id === "project") return Promise.resolve({ getProject: () => Promise.resolve({ id: "project-id", name: "Project" }) });
        if (id === "navigation") return Promise.resolve({ getQueryParams: () => Promise.resolve({}) });
        if (id === "layout") return Promise.resolve({ openPanel: (id, options) => { panel = options; } });
        throw new Error("Unexpected service " + id);
    }
};
const dependencies = {
    module: { config: () => ({ fields: [], priorities: [] }) },
    knockout: Object.assign({}, ko, { applyBindings: (model) => { live = model; } }),
    sdk,
    "api/index": { CommonServiceIds: { ProjectPageService: "project", HostNavigationService: "navigation", HostPageLayoutService: "layout" } },
    "services/data": { getManager: () => Promise.resolve(manager) }
};
const load = (file, expose) => {
    let result;
    let source = fs.readFileSync(path.join(root, file), "utf8");
    if (expose) {
        source = source.replace(/(?:\n    return \{ start \};\r?)?\n\}\);\s*$/, "\n    return { Model: Model, start: typeof start === 'function' ? start : null };\n});\n");
    }
    vm.runInNewContext(source, {
        Promise, Map, Set, Date, Number, encodeURIComponent, setTimeout, clearTimeout,
        console: { debug: () => {}, log: () => {}, warn: () => {} },
        document: { readyState: "loading", addEventListener: () => {} },
        define: (names, factory) => { result = factory(...names.map((name) => dependencies[name] || {})); }
    });
    return result;
};
for (const name of ["backlog-order", "browser-settings", "date-granularity", "field-columns", "timeline-zoom", "timeline-split"]) {
    if (fs.existsSync(path.join(root, "js/services/" + name + ".js"))) {
        dependencies["services/" + name] = load("js/services/" + name + ".js");
    }
}
if (fs.existsSync(path.join(root, "js/services/hierarchy-analysis.js"))) {
    dependencies["services/hierarchy-analysis"] = load("js/services/hierarchy-analysis.js");
}
const App = load("js/querygantt-tab-app.js", true);
const Configuration = load("js/querygantt-configuration-app.js", true);
App.Model.prototype.init = () => Promise.resolve();

(async () => {
    await App.start();
    assert.strictEqual(live.showItemActions(), false, "older preferences must default to hidden controls");
    assert.strictEqual(live.showFooter(), false, "older preferences must default to hidden summaries");
    live.openSettings();
    await Promise.resolve();
    assert.strictEqual(panel.configuration.showItemActions, false);
    assert.strictEqual(panel.configuration.showFooter, false);
    const options = new Configuration.Model(Object.assign({}, panel.configuration, {
        project: { id: "project-id" }, panel: { close: (result) => { closed = result; } }
    }));
    options.showItemActions(true);
    options.showFooter(true);
    await options.save();
    assert.strictEqual(stored.showItemActions, true);
    assert.strictEqual(stored.showFooter, true);
    assert.strictEqual(stored.otherSetting, "keep", "visibility saves must preserve unrelated settings");
    const currentFields = live.showFields();
    panel.onClose(closed);
    assert.strictEqual(live.showFields(), currentFields, "saving visibility alone must not rebuild the timeline through unchanged column settings");
    assert.strictEqual(live.showItemActions(), true);
    assert.strictEqual(live.showFooter(), true);
    const getService = sdk.getService;
    let releaseLayout;
    let detailPanels = 0;
    sdk.getService = () => new Promise((resolve) => { releaseLayout = resolve; });
    live.current({ id: 1, title: "Example" });
    live.currentId(1);
    assert.strictEqual(typeof releaseLayout, "function");
    live.showItemActions(false);
    releaseLayout({ openPanel: () => { detailPanels++; } });
    await Promise.resolve();
    assert.strictEqual(detailPanels, 0, "an in-flight detail request must not open after controls are disabled");
    live.currentId(null);
    sdk.getService = getService;
    await App.start();
    assert.strictEqual(live.showItemActions(), true, "saved settings must restore through the normal startup path");
    assert.strictEqual(live.showFooter(), true);
    live.openSettings();
    await Promise.resolve();
    panel.onClose();
    assert.strictEqual(live.showItemActions(), true, "Close without Save must retain the last values");
    const writeCount = writes;
    options.showItemActions(false);
    options.showFooter(false);
    options.close();
    assert.strictEqual(writes, writeCount, "closing unsaved preferences must not write");
    await options.save();
    await App.start();
    assert.strictEqual(live.showItemActions(), false);
    assert.strictEqual(live.showFooter(), false);
    console.log("display options tests passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
