"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ko = require("knockout");

const loadAmd = function (filename, dependencies, exposeModel) {
    let result = null;
    let source = fs.readFileSync(filename, "utf8");
    if (exposeModel) {
        source = source.replace(/\n\}\);\s*$/, "\n    return { Model: Model };\n});\n");
    }
    const document = {
        readyState: "loading", addEventListener: function () {}, querySelector: function () { return null; },
        head: { querySelectorAll: function () { return []; }, appendChild: function () {} },
        createElement: function () { return { classList: { add: function () {} }, setAttribute: function () {}, innerHTML: "", style: {} }; }
    };
    vm.runInNewContext(source, {
        Array: Array, Date: Date, Map: Map, Number: Number, Promise: Promise, Set: Set,
        console: { debug: function () {}, log: function () {}, warn: function () {} },
        define: function (names, factory) { result = factory.apply(null, names.map(function (name) { return dependencies[name] || {}; })); },
        document: document, fetch: function () { throw new Error("Unexpected fetch"); }, isNaN: isNaN
    }, { filename: path.basename(filename) });
    return result;
};

const loadService = function (name, context) {
    let result = null;
    const filename = path.join(__dirname, "../js/services/" + name + ".js");
    vm.runInNewContext(fs.readFileSync(filename, "utf8"), Object.assign({
        Date: Date, Map: Map, Number: Number, Set: Set, encodeURIComponent: encodeURIComponent,
        console: { warn: function () {} },
        define: function (dependencies, factory) { result = factory(); }, isNaN: isNaN
    }, context || {}), { filename: path.basename(filename) });
    return result;
};

const app = loadAmd(path.join(__dirname, "../js/querygantt-tab-app.js"), {
    module: { config: function () { return {}; } }, knockout: ko, sdk: {},
    "services/browser-settings": loadService("browser-settings"),
    "services/date-granularity": loadService("date-granularity")
}, true);

const initCalls = [];
app.Model.prototype.init = function (asOf) { initCalls.push(asOf || null); return Promise.resolve(); };
const model = new app.Model({
    version: "test", priorities: [], fields: [], user: "User",
    project: { id: "project-id", name: "Project" }, query: { id: "query-id", name: "Query" }, showFields: []
});

assert.strictEqual(initCalls.length, 0, "constructing the model must not start a duplicate Query API load");
const asOf = new Date(2026, 7, 21);
model.filterPrimary({ asOf: [asOf] });
assert.deepStrictEqual(initCalls, ["2026-08-21T00:00:00.0000000"], "a real As of change should still reload once");
model.dispose();

let filterRegistration = null;
const filterKnockout = Object.create(ko);
filterKnockout.components = { register: function (name, registration) { if (name === "my-filter") { filterRegistration = registration; } } };
loadAmd(path.join(__dirname, "../js/components/filter.js"), { knockout: filterKnockout }, false);

const primaryFilter = ko.observable({});
let primaryWrites = 0;
primaryFilter.subscribe(function () { primaryWrites += 1; });
const filter = filterRegistration.viewModel.createViewModel({
    value: ko.observable({}), valuePrimary: primaryFilter, queryType: ko.observable("flat"),
    assignees: [], states: [], priorities: [], tags: [], areas: [], parents: []
}, { element: { firstElementChild: {}, querySelector: function () { return null; } } });

assert.strictEqual(primaryWrites, 0, "creating the filter must not publish an unchanged empty As of filter");
filter.asOfValue([asOf]);
assert.strictEqual(primaryWrites, 1);
filter.asOfValue([]);
assert.strictEqual(primaryWrites, 2);
filter.dispose();

(async function () {
    let queryState = { showFields: "duration", retained: "value" };
    const queryStringWrites = [];
    const hostNavigationService = {
        getQueryParams: function () { return Promise.resolve(Object.assign({}, queryState)); },
        setQueryParams: function (state) {
            queryStringWrites.push(state);
            queryState = Object.assign({}, state);
            return Promise.resolve();
        }
    };
    const navigationApi = { CommonServiceIds: { HostNavigationService: "host-navigation" } };
    const navigationApp = loadAmd(path.join(__dirname, "../js/querygantt-tab-app.js"), {
        module: { config: function () { return {}; } },
        knockout: ko,
        sdk: { getService: function () { return Promise.resolve(hostNavigationService); } },
        "api/index": navigationApi
    }, true);
    const queryStringModel = {
        showFields: function () { return ["duration"]; },
        _queryStringUpdatePromise: Promise.resolve()
    };

    const noOpResult = await navigationApp.Model.prototype._updateQueryString.call(queryStringModel);
    assert.strictEqual(noOpResult, false);
    assert.strictEqual(queryStringWrites.length, 0, "an unchanged showFields query parameter must not reload the extension iframe");

    queryStringModel.showFields = function () { return ["duration", "id"]; };
    await Promise.all([
        navigationApp.Model.prototype._updateQueryString.call(queryStringModel),
        navigationApp.Model.prototype._updateQueryString.call(queryStringModel)
    ]);
    assert.strictEqual(queryStringWrites.length, 1, "concurrent notifications for one value should serialize into one URL update");
    assert.strictEqual(queryStringWrites[0].showFields, "duration,id");
    assert.strictEqual(queryStringWrites[0].retained, "value", "unrelated host query parameters must be retained");

    console.log("querygantt startup integration tests passed");
})().catch(function (error) {
    console.error(error);
    process.exitCode = 1;
});
