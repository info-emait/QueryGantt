module.exports = function (grunt) {
    //#region [ Configuration ]

    grunt.config("uglify", {
        release: {
            options: {
                sourceMap: false
            },
            files: [{
                expand: true,
                cwd: "wwwroot/js",
                src: "**/*.js",
                dest: "wwwroot/js"
            }]
        }
    });

    //#endregion


    //#region [ Tasks ]

    grunt.loadNpmTasks("grunt-contrib-uglify");

    //#endregion
};