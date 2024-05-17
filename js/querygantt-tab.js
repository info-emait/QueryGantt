require({
    urlArgs: "v=#{Project.AssemblyInfo.Version}#",
    packages: [{
        name: "my",
        location: "./"
    }, {
        name: "polyfills",
        location: "./polyfills"
    }],
    paths: {
        "knockout": "./libs/knockout",
        "text": "./libs/text",
        "vis-timeline": "./libs/vis-timeline",
        "whatwg-fetch": "./libs/whatwg-fetch",
        "sdk": "./libs/sdk",
        "api": "./libs/api",
        "xlsx": "./libs/xlsx-populate"
    },
    map: {
        "*": {
            "azure-devops-extension-sdk": "sdk"
        }
    },
    config: {
        "my/#{Extension.Id}#-tab-app": {
            version: "#{Project.AssemblyInfo.Version}#",
            priorities: [{
                name: "Must have", value: 1, color: "e60017"
            }, {
                name: "Should have", value: 2, color: "fbe74b"
            }, {
                name: "Could have", value: 3, color: "8dc54b"
            }, {
                name: "Won't have", value: 4, color: "666666"
            }]
        }
    }
}, ["my/#{Extension.Id}#-tab-app"]);