"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const path = require("path");
const source = fs.readFileSync(path.join(__dirname, "../js/services/tab-startup.js"), "utf8");

const fixture = function () {
    let now = 0;
    let timer = null;
    let closeNotice;
    let resolveLoad;
    let rejectLoad;
    let registered;
    let startup;
    const calls = [];
    const status = { textContent: "" };
    const notice = {
        hidden: true,
        querySelector: (selector) => selector === "button"
            ? { addEventListener: (event, listener) => { assert.strictEqual(event, "click"); closeNotice = listener; } }
            : status,
        classList: { add: (name) => calls.push(name) }
    };
    const spinner = { hidden: false };
    const sdk = {
        init: (options) => {
            assert.strictEqual(options.loaded, true);
            assert.strictEqual(options.applyTheme, true);
            calls.push("handshake");
            return Promise.resolve();
        },
        register: (id, factory) => {
            assert.strictEqual(id, "test-tab");
            registered = factory();
        }
    };
    vm.runInNewContext(source, {
        define: (names, factory) => { startup = factory(sdk); },
        document: { getElementById: (id) => id === "querygantt-load-notice" ? notice : spinner },
        Date: { now: () => now },
        console: { warn: () => calls.push("error logged") },
        setTimeout: (callback, delay) => { timer = { callback, delay }; return 1; },
        clearTimeout: () => { timer = null; }
    });
    const loading = new Promise((resolve, reject) => { resolveLoad = resolve; rejectLoad = reject; });
    const model = {};
    const result = startup.start("test-tab", () => {
        calls.push("app module requested");
        return { start: () => loading };
    });
    return {
        notice, status, spinner, result, model, calls, registered,
        finish: () => resolveLoad(model),
        fail: () => rejectLoad(new Error("Could not get query")),
        dismiss: () => closeNotice(),
        advance: (elapsed) => {
            now = elapsed;
            if (timer && now >= timer.delay) { timer.callback(); }
        }
    };
};

(async function () {
    const fast = fixture();
    await Promise.resolve();
    assert.deepStrictEqual(fast.calls, ["handshake", "app module requested"], "the host must make the lightweight shell visible before query initialization");
    assert.strictEqual(typeof fast.registered.then, "function", "the host should be able to request the model during startup");
    fast.finish();
    assert.strictEqual(await fast.result, fast.model);
    assert.strictEqual(await fast.registered, fast.model);
    fast.advance(6000);
    assert.strictEqual(fast.notice.hidden, true, "fast startup should not leave a notice");

    const slow = fixture();
    slow.advance(5000);
    assert.strictEqual(slow.notice.hidden, false);
    assert.match(slow.status.textContent, /is taking longer/);
    slow.finish();
    await slow.result;
    assert.match(slow.status.textContent, /took longer/);
    slow.dismiss();
    assert.strictEqual(slow.notice.hidden, true, "the notice can be closed after startup");

    const dismissed = fixture();
    dismissed.advance(5000);
    dismissed.dismiss();
    dismissed.finish();
    await dismissed.result;
    assert.strictEqual(dismissed.notice.hidden, true, "completion must not reopen a dismissed notice");

    const failed = fixture();
    failed.fail();
    assert.strictEqual(await failed.result, null);
    await assert.rejects(failed.registered, /Could not get query/);
    assert.strictEqual(failed.spinner.hidden, true, "a failed query must not leave a loading spinner");
    assert.match(failed.status.textContent, /couldn't load/);
    assert.strictEqual(failed.notice.hidden, false);
    failed.dismiss();
    assert.strictEqual(failed.notice.hidden, true);

    console.log("tab startup tests passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
