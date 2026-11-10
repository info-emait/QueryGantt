"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const less = require("less");
const { chromium } = require("playwright");
const root = path.resolve(__dirname, "..");
const moduleRoot = path.join(root, process.env.QUERYGANTT_TEST_BUILT ? "wwwroot/js" : "js");
const run = async (browser) => {
    const filename = path.join(root, "less/querygantt-tab.less");
    const styles = await less.render(fs.readFileSync(filename, "utf8"), { filename, plugins: [{
        install: (compiler) => compiler.functions.functionRegistry.add("rem", (size) => new compiler.tree.Dimension(size.value / 16, "rem"))
    }] });
    for (const culture of ["ja-JP", "en-US"]) {
        const japanese = culture === "ja-JP";
        const page = await browser.newPage({ viewport: { width: 1000, height: 800 }, locale: japanese ? "en-US" : "ja-JP" });
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        try {
            const markup = fs.readFileSync(path.join(root, "html/querygantt-tab.html"), "utf8").match(/<my-message\b[\s\S]*?<\/my-message>/)[0];
            await page.setContent(markup);
            for (const name of ["Core/core.css", "Components/Button/Button.css", "Components/Card/Card.css", "Components/MessageBar/MessageBar.css", "Components/MessageCard/MessageCard.css"]) {
                await page.addStyleTag({ path: path.join(root, "node_modules/azure-devops-ui", name) });
            }
            await page.addStyleTag({ content: process.env.QUERYGANTT_TEST_BUILT ? fs.readFileSync(path.join(root, "wwwroot/css/querygantt-tab.css"), "utf8") : styles.css });
            await page.addScriptTag({ path: path.join(root, "node_modules/knockout/build/output/knockout-latest.debug.js") });
            await page.evaluate((culture) => {
                window.calls = [];
                window.releaseReads = null;
                window.gate = new Promise((resolve) => { window.releaseReads = resolve; });
                window.lookupFailure = false;
                const nodes = [{ id: 30, type: "User Story", parent: 20 }, { id: 20, type: "Feature", parent: 10 },
                    { id: 10, type: "Epic", parent: 40 }, { id: 40, type: "User Story", parent: 0 }];
                const work = { WorkRestClient: function () {} }, wit = { WorkItemTrackingRestClient: function () {} };
                const workClient = { getBacklogs: () => Promise.resolve([
                    { id: "epics", rank: 3, workItemTypes: ["Epic"] }, { id: "features", rank: 2, workItemTypes: ["Feature"] },
                    { id: "stories", rank: 1, workItemTypes: ["User Story"] }
                ]) };
                const tracking = { getWorkItems: (ids, project, fields, asOf, expand) => {
                    if (fields !== undefined || asOf !== undefined || expand !== "all") throw new Error("Invalid REST projection");
                    window.calls.push(ids[0]);
                    return window.gate.then(() => {
                        if (window.lookupFailure) throw { status: 400, message: "Synthetic server detail <img src=x>" };
                        const item = nodes.find((node) => node.id === ids[0]);
                        return [{ id: item.id, url: "https://example.test/Synthetic/_apis/wit/workItems/" + item.id,
                            fields: { "System.WorkItemType": item.type, "System.TeamProject": "Synthetic" },
                            relations: item.parent ? [{ rel: "System.LinkTypes.Hierarchy-Reverse", url: "https://example.test/_apis/wit/workItems/" + item.parent }] : [] }];
                    });
                } };
                window.analysisServices = { knockout: window.ko, "api/Work/index": work, "api/WorkItemTracking/index": wit,
                    sdk: { ready: () => Promise.resolve(), getPageContext: () => ({ globalization: { culture } }),
                        getWebContext: () => ({ project: { id: "project", name: "Synthetic" } }), getTeamContext: () => null },
                    "api/index": { getClient: (type) => type === work.WorkRestClient ? workClient : tracking } };
                window.define = (names, factory) => { window.latestAnalysisService = factory(...names.map((name) => window.analysisServices[name])); };
            }, culture);
            for (const name of ["hierarchy-localization", "hierarchy-analysis", "hierarchy-diagnostics"]) {
                await page.addScriptTag({ path: path.join(moduleRoot, "services/" + name + ".js") });
                await page.evaluate((name) => { window.analysisServices["services/" + name] = window.latestAnalysisService; }, name);
            }
            await page.addScriptTag({ path: path.join(moduleRoot, "components/message.js") });
            await page.evaluate(() => {
                window.message = window.ko.observable('Unable to reorder work item #30. <img src=x onerror="window.injected=true">');
                window.ko.applyBindings({ message: window.message, messageContext: window.ko.observable(null) }, document.body);
            });
            const analyze = page.getByRole("button", { name: japanese ? "親子関係を解析" : "Analyze Parent links", exact: true });
            await analyze.waitFor({ state: "visible" });
            assert.deepStrictEqual(await page.evaluate(() => window.calls), [], "rendering an error must not request analysis automatically");
            await analyze.click();
            assert.strictEqual(await page.getByRole("button", { name: japanese ? "解析中…" : "Analyzing…", exact: true }).isDisabled(), true);
            await page.evaluate(() => window.releaseReads());
            const open = page.getByRole("link", { name: japanese ? "#10 を開く" : "Open #10", exact: true });
            await open.waitFor({ state: "visible" });
            assert.strictEqual(await open.getAttribute("target"), "_blank");
            assert.strictEqual(await open.getAttribute("href"), "https://example.test/Synthetic/_workitems/edit/10");
            const body = await page.locator(".querygantt-tab__analysis").innerText();
            assert.strictEqual(await page.evaluate(() => navigator.language), japanese ? "en-US" : "ja-JP");
            assert.ok(body.includes(japanese ? "並べ替えを妨げる可能性" : "Found a Parent link"));
            assert.ok(body.includes(japanese ? "親のバックログ階層が子より下位" : "the parent is in a lower backlog category"));
            const chains = page.locator("summary");
            assert.strictEqual(await chains.innerText(), japanese ? "確認した親階層" : "Checked Parent chains");
            await chains.click();
            await page.getByRole("link", { name: "#30 (User Story)", exact: true }).waitFor({ state: "visible" });
            assert.strictEqual(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
            assert.strictEqual(await page.locator("img").count(), 0, "server text is plain text");
            if (process.env.QUERYGANTT_TEST_SCREENSHOTS) await page.screenshot({ path: path.join(process.env.QUERYGANTT_TEST_SCREENSHOTS, "analysis-result-" + culture + ".png"), fullPage: true });
            await page.evaluate(() => { window.lookupFailure = true; });
            await analyze.click();
            await page.waitForFunction(() => document.querySelector(".querygantt-tab__analysis").textContent.includes("HTTP 400"));
            assert.ok((await page.locator(".querygantt-tab__analysis").innerText()).includes("Synthetic server detail"));
            assert.strictEqual(await chains.isVisible(), false, "empty chains must not look like an unexplained successful analysis");
            assert.strictEqual(await page.locator("img").count(), 0);
            if (process.env.QUERYGANTT_TEST_SCREENSHOTS) await page.screenshot({ path: path.join(process.env.QUERYGANTT_TEST_SCREENSHOTS, "analysis-" + culture + ".png"), fullPage: true });
            await page.getByRole("button", { name: japanese ? "エラーを閉じる" : "Dismiss error" }).click();
            assert.strictEqual(await analyze.isVisible(), false);
            assert.deepStrictEqual(errors, []);
        }
        finally { await page.close(); }
    }
};
module.exports = run;
if (require.main === module) {
    (async () => {
        const browser = await chromium.launch({ channel: process.env.QUERYGANTT_BROWSER_CHANNEL || "chrome", headless: true });
        try { await run(browser); console.log("hierarchy analysis browser tests passed (ja-JP and en-US)"); }
        finally { await browser.close(); }
    })().catch((error) => { console.error(error); process.exitCode = 1; });
}
