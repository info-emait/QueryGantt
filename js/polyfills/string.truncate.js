define([], function () {
    //#region [ Fields ]

    var global = (function () { return this; })();

    //#endregion

    (function (prototype) {
        if (!prototype.truncate) {
            Object.defineProperty(prototype, "truncate", {
                value: function (n, useWordBoundary) {
                    if (this.length <= n) { 
                        return this;
                    }

                    var subString = this.substr(0, n-1);
                    return (useWordBoundary 
                      ? subString.substr(0, subString.lastIndexOf(" ")) 
                      : subString) + "&hellip;";
                },
                configurable: true,
                writable: true
            });
        }
    })(global.String.prototype);
});