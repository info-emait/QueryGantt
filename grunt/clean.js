module.exports = function (grunt) {
    //#region [ Configuration ]

    grunt.config("clean", {
        wwwroot: [
            "wwwroot/**/*"
        ],
        vsix: [
            "wwwroot/**/*",
            "!wwwroot/*.vsix"
        ],
        dependencies: [
            "js/libs/*",
            "css/vis-timeline.css"
        ],
        cssmin: [
            "wwwroot/css/*",
            "!wwwroot/css/*.min.css"
        ],
        "azure-devops-ui": [
            "js/libs/ui/Core/core.css",
            "js/libs/ui/Core/override.css",
            "js/libs/ui/Components/Icon/FabricIcons.css",
            "js/libs/ui/Components/Icon/FluentIcons.css",
            "js/libs/ui/Components/Header/Header.css",
            "js/libs/ui/Components/Button/Button.css",
            "js/libs/ui/Components/Spinner/Spinner.css",
            "js/libs/ui/Components/TextField/TextField.css"
        ]
    });

    //#endregion


    //#region [ Tasks ]

    grunt.loadNpmTasks("grunt-contrib-clean");

    //#endregion
};