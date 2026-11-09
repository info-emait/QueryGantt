"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

module.exports = function (name) {
    let result;
    const filename = path.join(__dirname, "../../js/services/", name + ".js");
    vm.runInNewContext(fs.readFileSync(filename, "utf8"), {
        define: (dependencies, factory) => {
            assert.strictEqual(dependencies.length, 0, "this loader is for dependency-free services");
            result = factory();
        }
    }, { filename });
    return result;
};
