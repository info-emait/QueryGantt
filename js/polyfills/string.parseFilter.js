define([], function () {
    //#region [ Fields ]

    var global = (function () { return this; })();

    //#endregion


    //#region [ Methods ]

    /**
     * Creates the filter rule object.
     * 
     * @param {object} rule Object which represents the filter rule. 
     * @param {string} current Current rule value.
     *  
     * @returns Object which represents the filter rule or logical operation.
     */
    var createRule = function (rule, current) {
        if (!rule) {
            if ((current === "OR") || (current === "AND")) {
                return {
                    operator: current
                };
            }
        }
    
        rule = rule || {};
    
        rule.value = current;
        rule.key = rule.key || "match";
    
        return rule;
    };


    /**
     * Formats the list of filter rules.
     * 
     * @param {Array} filter List of filter rules.
     *  
     * @returns Array of filter rules.
     */
    var formatValues = function(filter) {
        const result = [];
    
        filter.forEach((rule) => {
            if (/^(before|after)$/.test(rule.key)) {
                let date = result.find((rule) => rule.key === "date");
                
                if (!date) {
                    date = {
                        key: "date",
                        value: {}
                    };
                    result.push(date);
                }
                
                date.value[rule.key] = rule.value;
                return;
            }
            
            if (/^(smaller|greater)$/.test(rule.key)) {
                let { key, value } = rule;
                let size = {
                    key: "size", 
                    value, 
                    predicate: key
                };
                result.push(size);
                return;
            }
            
            if (rule.key == "match") {
                let match = result.find((rule) => rule.key === "match");
                let { value } = rule;
                
                if (!match) {
                    match = {
                        key: "match"
                    };
                    result.push(match);
                }
                
                if (value.charAt(0) != "-") {
                    match.accept = `${match.accept || ""} ${value}`.trim();
                } 
                else {
                    match.reject = `${match.reject || ""} ${value.slice(1)}`.trim(); 
                } 
    
                return;
            }
            
            if (rule.key == "has") {
                let has = result.find((rule) => rule.key === "has");
                let { key, value } = rule;
                
                if (!has) {
                    has = has || {key};
                    result.push(has);
                }
                
                has[value] = true;
                return;
            }
            
            result.push(rule);
        });
        
        return result;
    };

    //#endregion

    (function (prototype) {
        if (!prototype.parseFilter) {
            Object.defineProperty(prototype, "parseFilter", {
                value: function () {
                    if (!this.length) { 
                        return [];
                    }

                    const filter = [];
                    let current = "";
                    let isGroup = false;
                    let rule;

                    this.split("").forEach((char) => {
                        switch(char) {
                            case ":":
                                rule = { 
                                    key: current 
                                };
                                current = "";
                                break;
                            case " ":
                                if (!isGroup) {
                                    filter.push(createRule(rule, current));
                                    rule = null;
                                    current = "";
                                    break;
                                }
                                current += char;
                                break;
                            case "(":
                            case "{":
                                isGroup = true;
                                break;
                            case ")":
                            case "}":
                                isGroup = false;
                                break;
                            default:
                                current += char;
                        }
                    });
                    
                    if (rule || current) {
                        filter.push(createRule(rule, current));
                    }

                    return formatValues(filter);
                },
                configurable: true,
                writable: true
            });
        }
    })(global.String.prototype);
});