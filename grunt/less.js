module.exports = function (grunt) {
    //#region [ Configuration ]

    grunt.config("less", {
        options: {
            paths: ["less"],
            strictMath: false,            
            customFunctions: {
                rem: function (less, fontsize) {
                    if (less.functions.functionRegistry.get("ispixel")) {
                        return fontsize.value / 16 + "rem";
                    }
                },
                shadow: function (less, color, bgcolor, len) {
                    var length = len.value;
                    var total = length;
                    var amount = null;
                    var mixed = null;
                    var mix = less.functions.functionRegistry.get("mix");
                    var result = [(color.value || color.toCSS()) + " 0px 0px"];

                    while (length > 0) {
                        amount = 100 - ((length / total) * 100);
                        mixed = mix(color, bgcolor, { value: amount });
                        result.unshift(mixed.toCSS() + " " + length + "px " + length + "px");
                        length--;
                    }

                    return result.join(",");
                }
            }
        },
        src: {
            files: {
                "wwwroot/css/querygantt-tab.css": "less/querygantt-tab.less"
            }
        }
    });

    //#endregion


    //#region [ Tasks ]

    grunt.loadNpmTasks("grunt-contrib-less");

    //#endregion
};