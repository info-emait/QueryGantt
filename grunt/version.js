module.exports = function (grunt) {
    //#region [ Configuration ]

    grunt.config("version", {
        project: {
            src: [
                "package.json"
            ]
        }
    });

    //#endregion


    //#region [ Tasks ]

    grunt.loadNpmTasks("grunt-version");

    //#endregion
};