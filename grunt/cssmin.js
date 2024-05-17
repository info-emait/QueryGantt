module.exports = function (grunt) {
    //#region [ Configuration ]

    grunt.config("cssmin", {
        options: {
            advanced: false
        },
        build: {
            files: [{
                expand: true,
                cwd: "wwwroot/css",
                src: ["*.css", "!*.min.css"],
                dest: "wwwroot/css",
                ext: ".min.css"
            }]
        } 
    });

    //#endregion


    //#region [ Tasks ]

    grunt.loadNpmTasks("grunt-contrib-cssmin");

    //#endregion
};