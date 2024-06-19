module.exports = function (grunt) {
    //#region [ Configuration ]

    grunt.config("concat", {
        "azure-devops-ui": {
            src: [
                "js/libs/ui/Core/core.css",
                "js/libs/ui/Core/override.css",
                "js/libs/ui/Components/Icon/FabricIcons.css",
                "js/libs/ui/Components/Icon/FluentIcons.css",
                "js/libs/ui/Components/Header/Header.css",
                "js/libs/ui/Components/Button/Button.css",
                "js/libs/ui/Components/Spinner/Spinner.css",
                "js/libs/ui/Components/TextField/TextField.css"
            ],
            dest: "css/azure-devops-ui.css"
        }
    });

    //#endregion


    //#region [ Tasks ]

    grunt.loadNpmTasks("grunt-contrib-concat");

    //#endregion
};