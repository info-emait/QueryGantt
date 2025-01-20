module.exports = function (grunt) {
    //#region [ Configuration ]

    grunt.config("rename", {
        dependencies: {
            files: [
                { src: ["js/libs/SDK.min.js"], dest: "js/libs/sdk.js" },
                { src: ["js/libs/knockout-latest.debug.js"], dest: "js/libs/knockout.js" },
                { src: ["js/libs/fetch.umd.js"], dest: "js/libs/whatwg-fetch.js" },
                { src: ["js/libs/vis-timeline-graph2d.js"], dest: "js/libs/vis-timeline.js" },
                { src: ["js/libs/arrow.js"], dest: "js/libs/vis-timeline-arrow.js" }
            ]
        },
        cssmin: {
            files: [
                { src: ["wwwroot/css/querygantt-tab.min.css"], dest: "wwwroot/css/querygantt-tab.css" },
                { src: ["wwwroot/css/vis-timeline.min.css"], dest: "wwwroot/css/vis-timeline.css" },
                { src: ["wwwroot/css/azure-devops-ui.min.css"], dest: "wwwroot/css/azure-devops-ui.css" }
            ]
        }
    });

    //#endregion


    //#region [ Tasks ]

    grunt.loadNpmTasks("grunt-rename-util");

    //#endregion
};