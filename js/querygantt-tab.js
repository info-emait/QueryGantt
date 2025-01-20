require({
    urlArgs: "v=#{Project.AssemblyInfo.Version}#",
    packages: [{
        name: "my",
        location: "./"
    }, {
        name: "polyfills",
        location: "./polyfills"
    }, {
        name: "bindings",
        location: "./bindings"
    }],
    paths: {
        "knockout": "./libs/knockout",
        "text": "./libs/text",
        "vis-timeline": "./libs/vis-timeline",
        "dom-to-image": "./libs/dom-to-image",
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
            }],
            fields: [{
                name: "Area Path", value: "areaPath"
            }, {
                name: "Assigned To", value: "assignedTo"
            }, {
                name: "Iteration Path", value: "iterationPath"
            }, {
                name: "Dates", value: "dates"
            }, {
                name: "Duration", value: "duration"
            }, {
                name: "Node Name", value: "nodeName"
            }, {
                name: "Parent", value: "parentTitle"
            }, {
                name: "Remaining Work", value: "remainingWork"
            }, {
                name: "Tags", value: "tags"
            }, {
                name: "Team Project", value: "project"
            }]
        }
    }
}, ["my/#{Extension.Id}#-tab-app"]);