"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const less = require("less");
const { chromium } = require("playwright");
const root = path.resolve(__dirname, "..");

// Use the source LESS and actual pinned vis-timeline/Knockout components. A
// mocked DOM cannot measure the flex/height feedback that causes overlapping
// rows after a hidden tab becomes visible or out-of-range children redraw.
const renderStyles = async function () {
    const filename = path.join(root, "less/querygantt-tab.less");
    const result = await less.render(fs.readFileSync(filename, "utf8"), {
        filename,
        plugins: [{
            install: function (compiler) {
                compiler.functions.functionRegistry.add("rem", function (size) {
                    return new compiler.tree.Dimension(size.value / 16, "rem");
                });
            }
        }]
    });
    return result.css;
};

const assertLoadingNotice = async function (browser, styles) {
    const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
    try {
        const shell = fs.readFileSync(path.join(root, "html/querygantt-tab.html"), "utf8")
            .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
            .replace(/<link\b[^>]*>/gi, "");
        await page.setContent(shell);
        await page.addStyleTag({ path: path.join(root, "node_modules/azure-devops-ui/Core/core.css") });
        await page.addStyleTag({ content: styles });
        await page.clock.install();
        await page.evaluate(() => {
            window.define = (names, factory) => {
                window.startup = factory({ init: () => Promise.resolve(), register: () => {} });
            };
        });
        await page.addScriptTag({ path: path.join(root, "js/services/tab-startup.js") });
        await page.evaluate(() => {
            window.started = window.startup.start("test-tab", () => ({
                start: () => new Promise((resolve) => { window.finishLoad = resolve; })
            }));
        });
        const notice = page.locator("#querygantt-load-notice");
        const dismiss = page.getByRole("button", { name: "Dismiss loading notice" });
        assert.strictEqual(await notice.isVisible(), false);
        await page.clock.fastForward(5000);
        assert.strictEqual(await notice.isVisible(), true);
        const bounds = await notice.boundingBox();
        const button = await dismiss.boundingBox();
        assert.ok(bounds.x + bounds.width - button.x - button.width < 16, "the dismiss button must appear at the right edge");
        await dismiss.focus();
        await page.keyboard.press("Enter");
        assert.strictEqual(await notice.isVisible(), false);
        await page.evaluate(async () => {
            window.finishLoad({});
            await window.started;
        });
        assert.strictEqual(await notice.isVisible(), false, "finishing the load must leave the closed banner hidden");
    }
    finally {
        await page.close();
    }
};

const mountTimeline = async function (page, styles, backlogOrder) {
    await page.setContent('<style>html,body{margin:0;font-size:16px;width:100%;height:100%}:root{--background-color:white;--text-primary-color:#222;--text-secondary-color:#666}</style><div class="v-scroll-auto" style="width:100%;height:760px;overflow:auto"><div id="component" style="display:none"></div></div>');
    await page.addStyleTag({ path: path.join(root, "node_modules/azure-devops-ui/Core/core.css") });
    await page.addStyleTag({ path: path.join(root, "node_modules/azure-devops-ui/Core/override.css") });
    await page.addStyleTag({ path: path.join(root, "node_modules/vis-timeline/styles/vis-timeline-graph2d.css") });
    await page.addStyleTag({ content: styles });
    await page.addScriptTag({ path: path.join(root, "node_modules/knockout/build/output/knockout-latest.debug.js") });
    await page.addScriptTag({ path: path.join(root, "node_modules/vis-timeline/standalone/umd/vis-timeline-graph2d.js") });
    await page.evaluate(() => {
        window.services = {};
        window.define = (dependencies, factory) => { window.loadedService = factory(); };
    });
    for (const name of ["date-granularity", "field-columns", "timeline-zoom", "timeline-split"]) {
        const filename = path.join(root, `js/services/${name}.js`);
        if (fs.existsSync(filename)) {
            await page.addScriptTag({ path: filename });
            await page.evaluate(name => { window.services[name] = window.loadedService; }, name);
        }
    }
    await page.evaluate(() => {
        window.ko.components.register = (name, registration) => { window.registration = registration; };
        window.define = (dependencies, factory) => factory(...dependencies.map(name => {
            if (name === "knockout") { return window.ko; }
            if (name === "vis-timeline") { return window.vis; }
            return window.services[name.replace("services/", "")];
        }));
    });
    await page.addScriptTag({ path: path.join(root, "js/polyfills/string.truncate.js") });
    await page.addScriptTag({ path: path.join(root, "js/components/timeline.js") });
    await page.evaluate(backlogOrder => {
        const element = document.getElementById("component");
        element.innerHTML = window.registration.template;
        const items = [];
        for (let story = 1; story <= 16; story++) {
            const id = story * 10;
            const base = {
                project: "Project", state: "New", tags: [], dependencies: [], assignedTo: "Example user",
                isCompleted: false, childCount: 0, childCompletedCount: 0, priority: 2,
                backlogOrder: { eligible: true, targetEligible: true }
            };
            items.push(Object.assign({}, base, {
                id, originalId: id, title: `Story ${story}`, type: "User Story", level: 1, parent: "", path: `${id}`,
                url: `https://example.test/_apis/wit/workItems/${id}`, childCount: 4,
                startDate: new Date(2026, 8, 1), targetDate: new Date(2026, 8, 7)
            }));
            for (let child = 1; child <= 4; child++) {
                const childId = id + child;
                items.push(Object.assign({}, base, {
                    id: childId, originalId: childId, title: `Task ${story}-${child}`, type: "Task", level: 2,
                    parent: `${id}`, path: `${id}/${childId}`, parentId: id,
                    url: `https://example.test/_apis/wit/workItems/${childId}`,
                    startDate: child === 4 ? null : new Date(2026, 7, 1),
                    targetDate: child === 4 ? null : new Date(2026, 7, 2)
                }));
            }
        }
        const params = {
            items, backlogOrder,
            types: ["User Story", "Task"].map(name => ({ name, color: "0099BB", icon: { url: "icon" }, states: [{ name: "New", color: "111111" }] })),
            typesOther: [], states: [], priorities: [], icons: { icon: "<svg class='my-timeline-group__icon'></svg>" },
            showFields: ["id", "assignedTo", "dates"], dateGranularity: "day", listWidth: 800,
            callbacks: {}, actions: {}
        };
        window.view = window.registration.viewModel.createViewModel(params, { element });
    }, backlogOrder);
    await page.waitForTimeout(200);
    await page.evaluate(() => { document.getElementById("component").style.display = ""; });
    // Wait through the actual one-second vis-timeline autoResize timer, then
    // pan past all dated bars so their group labels must provide the height.
    await page.waitForTimeout(1100);
    await page.evaluate(() => {
        window.view.timeline.setWindow(new Date(2026, 8, 20), new Date(2026, 9, 4), { animation: false });
    });
};

const readLayout = async function (page) {
    return page.evaluate(() => {
        const labelSet = document.querySelector(".vis-labelset");
        const rows = Array.from(labelSet.querySelectorAll(".vis-label"))
            .filter(label => label.querySelector(".my-timeline-group"))
            .map(label => {
                const content = label.querySelector(".my-timeline-group");
                const bounds = label.getBoundingClientRect();
                const inner = label.querySelector(".vis-inner").getBoundingClientRect();
                const row = content.getBoundingClientRect();
                const title = content.querySelector(".my-timeline-group__title").getBoundingClientRect();
                const assigned = content.querySelector(".my-timeline-group__content--assignedto");
                const id = content.getAttribute("data-work-item-id") || content.querySelector(".my-timeline-group__title").getAttribute("data-id");
                const group = window.view.timeline.itemSet.groups[id];
                return {
                    id, top: bounds.top, bottom: bounds.bottom, height: bounds.height,
                    innerHeight: inner.height, rowHeight: row.height, titleLeft: title.left,
                    assignedLeft: assigned && assigned.getBoundingClientRect().left,
                    foregroundHeight: group.dom.foreground.getBoundingClientRect().height
                };
            });
        return { rows, width: document.querySelector(".v-scroll-auto").clientWidth };
    });
};

const assertLayout = function (layout, mode, expectedCount) {
    assert.ok(layout.width > 600, "the test must use a real full-width host, not a collapsed flex container");
    assert.strictEqual(layout.rows.length, expectedCount, `${mode}: the requested hierarchy rows should remain visible`);
    for (let i = 0; i < layout.rows.length; i++) {
        const row = layout.rows[i];
        assert.ok(row.height >= row.rowHeight - 0.5, `${mode}: row #${row.id} collapsed to ${row.height}px around ${row.rowHeight}px of content`);
        assert.ok(row.innerHeight >= row.rowHeight - 0.5, `${mode}: inner row #${row.id} must keep its intrinsic height`);
        assert.ok(row.foregroundHeight >= row.rowHeight - 0.5, `${mode}: timeline row #${row.id} must stay aligned with its label`);
        if (i) {
            assert.ok(row.top >= layout.rows[i - 1].bottom - 0.5, `${mode}: adjacent work item labels must not overlap`);
        }
    }
};

const assertStable = async function (page, mode, expectedCount) {
    // Sample across multiple one-second resize polls, not just the final
    // settled frame, so a layout alternating between good and bad fails.
    for (let frame = 0; frame < 24; frame++) {
        await page.waitForTimeout(100);
        assertLayout(await readLayout(page), mode, expectedCount);
    }
};

(async function () {
    const styles = await renderStyles();
    const browser = await chromium.launch({ channel: process.env.QUERYGANTT_BROWSER_CHANNEL || "chrome", headless: true });
    try {
        await assertLoadingNotice(browser, styles);
        let supportsBacklog = false;
        const modes = [];
        for (const backlogOrder of [false, true]) {
            if (backlogOrder && !supportsBacklog) { break; }
            const page = await browser.newPage({ viewport: { width: 1600, height: 800 } });
            const errors = [];
            page.on("pageerror", error => errors.push(error.message));
            const mode = backlogOrder ? "Backlog order" : "Query order";
            await mountTimeline(page, styles, backlogOrder);
            supportsBacklog = await page.evaluate(() => typeof window.view.backlogOrder === "function");
            await assertStable(page, `${mode}, revealed/out-of-range`, 80);
            await page.evaluate(() => { document.querySelector(".v-scroll-auto").scrollTop = 1200; });
            await assertStable(page, `${mode}, scrolled`, 80);
            await page.evaluate(() => { window.view.collapse(); });
            await assertStable(page, `${mode}, collapsed`, 16);
            await page.evaluate(() => { window.view.expand(); });
            await assertStable(page, `${mode}, expanded`, 80);
            await page.setViewportSize({ width: 1100, height: 800 });
            await assertStable(page, `${mode}, narrowed`, 80);
            const layout = await readLayout(page);
            const metadataStarts = layout.rows.map(row => row.assignedLeft).filter(value => value !== null);
            if (styles.includes("text-overflow: clip")) {
                assert.ok(Math.max(...metadataStarts) - Math.min(...metadataStarts) < 1, "fixed metadata columns should stay aligned while hierarchy indentation is retained");
            }
            assert.ok(layout.rows[1].titleLeft > layout.rows[0].titleLeft, "Task indentation should remain visible");
            assert.deepStrictEqual(errors, [], `${mode}: layout changes should not produce browser errors`);
            if (process.env.QUERYGANTT_LAYOUT_SCREENSHOT) {
                await page.screenshot({ path: process.env.QUERYGANTT_LAYOUT_SCREENSHOT });
            }
            await page.evaluate(() => { window.view.dispose(); });
            await page.close();
            modes.push(mode);
        }
        console.log(`timeline browser layout tests passed (${modes.join(" and ")}; hidden/revealed, out-of-range, scroll, collapse/expand, resize)`);
    }
    finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
