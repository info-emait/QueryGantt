"use strict";

const assert = require("assert");
const service = require("./helpers/load-pure-service")("hierarchy-localization");

for (const culture of ["ja", "ja-JP", "JA-jp", " ja_JP "]) {
    assert.strictEqual(service.normalize(culture), "ja");
}
for (const culture of ["en", "en-US", "en-GB", "fr-FR", "japanese", "", null, undefined, {}, 1041]) {
    assert.strictEqual(service.normalize(culture), "en");
}
assert.strictEqual(service.getLanguage({ getPageContext: () => ({ globalization: { culture: "ja-JP" } }) }), "ja");
assert.strictEqual(service.getLanguage({ getPageContext: () => ({ globalization: { culture: "en-US" } }) }), "en");
for (const sdk of [null, {}, { getPageContext: () => null }, { getPageContext: () => ({}) }, {
    getPageContext: () => { throw new Error("SDK is not ready"); }
}]) {
    assert.strictEqual(service.getLanguage(sdk), "en", "an unavailable host culture must not break startup");
}
const keys = [
    "analyze", "analyzing", "dismiss", "checkedChains", "openItem", "found", "incomplete", "none", "failed",
    "sameCategory", "reversedParent", "parentCycle", "finding", "chainFrom", "itemLimit", "missingItem",
    "ambiguousParent", "accessDenied", "notFound", "lookupFailed", "lookupRetry", "lookupDetail", "warning", "crossProject",
    "unknownCategory", "timeLimit", "categoryFailed", "missingProject"
];
const values = { id: 10, child: "#10 (Epic)", parent: "#40 (User Story)", childId: 10, parentId: 40, reason: "example", detail: "example" };
for (const key of keys) {
    const english = service.text("en-US", key, values);
    const japanese = service.text("ja-JP", key, values);
    assert.ok(english && english !== key && !/[{}]/.test(english), "complete English text: " + key);
    assert.notStrictEqual(japanese, english, "Japanese must not silently fall back to English: " + key);
    assert.ok((key === "warning" || /[\u3040-\u30ff\u4e00-\u9fff]/.test(japanese)) && !/[{}]/.test(japanese), "complete Japanese text: " + key);
    assert.strictEqual(service.text("fr-FR", key, values), english, "unsupported languages fall back to English");
}
assert.strictEqual(service.text("ja", "analyze"), "親子関係を解析");
assert.strictEqual(service.text("ja", "openItem", { id: 40 }), "#40 を開く");
assert.strictEqual(service.text("en", "openItem", { id: 40 }), "Open #40");
assert.strictEqual(service.text("ja", "openItem", { id: "<img src=x>" }), "#<img src=x> を開く", "values remain plain text for Knockout's text binding");
assert.strictEqual(service.text("en", "not-a-key"), "not-a-key");
assert.strictEqual(service.text("en", "toString"), "toString", "prototype properties are not message entries");
console.log("hierarchy localization tests passed");
