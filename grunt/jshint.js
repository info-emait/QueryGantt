module.exports = function (grunt) {
    //#region [ Configuration ]

    grunt.config("jshint", {
        options: {
            esversion: 6,
            browser: true,
            devel: true,
            debug: true,
            multistr: true,
            sub: true,
            laxbreak: true,
            undef: true,
            evil: true,
            globals: {
                define: true,
                require: true,
                self: true,
                module: true,
                Promise: true
            }
        },
        src: [
            "gruntfile.js",
            "grunt/**/*.js",
            "js/**/*.js",
            "!js/libs/**/*.js"
        ]    
    });

    //#endregion


    //#region [ Tasks ]

    grunt.loadNpmTasks("grunt-contrib-jshint");

    //#endregion
};