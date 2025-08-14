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
    }, {
        name: "img",
        location: "../img"
    }, {
        name: "services",
        location: "./services"
    }],
    paths: {
        "knockout": "./libs/knockout",
        "text": "./libs/text",
        "vis-timeline": "./libs/vis-timeline",
        "vis-timeline-arrow": "./libs/vis-timeline-arrow",
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
            previewImageUrl: "https://martinsutka.github.io/icongenerator/#dGl0bGU9R2FudHRDaGFydCZqc29uPXsic2hvd0d1aWRlcyI6ZmFsc2UsImfFD1NpemUiOjEwMMgRWCI6yQxZxQxpY29uxycxNMYPxiXECsojQ29sb3IiOiIjZmZjMzE0Isc5aGFkb3fJHDDFAc0cxls1yGnFFEludGVuc2l0eSI6M8gZdmciOiI8c3ZnIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiB3aWR0aD1cIjI0XCIgaGVpZ2h0yA52aWV3Qm94PVwiMCAwIDI0IMQWPjxwYXRoIGZpbGw9XCJjdXJyZW505QC4XCIgZD1cIk0yIDcuMjVBMy4yNSDFBcQ+MSA1xAs0aDN2M0g2YTIgMsUVxBs0aDIuMjV2OWgtM9E1MiAxNi43NXpNOcQUMjB2LTlIMTB2McdBxAIyIDJoMc0SMS43NSAxLjk4NVYyMHpNMTIgMTBoMi43NVY0aC01LjV2M0gxMMkwxGUyem02IDdoLeUAiTNo8ACIMCAy5wCJdi05LvAA2zAgMTjEcjRoLTN2Nkgx6ADex1vpAJsx5QDwNE02IDhhxgzHXGg0xxDFFC0yem01IMgTxTctMcsjxAYyaC3LIS0xLTFtNCAyzEYgMmgzz1ZcIi8+POQB9j7kAlhzQmFja2dyb3VuZFRyYW5zcGHkAcnpAvZiyR5X5AIhIjoxNjDMFkjlAirRF+kCwTI0xAIizBxMxDLJITdkxALSIesC0zU1zB74AyLQIuYDKDTMGUJvcmRlclJhZGl1cyI6N+QDKnNCYWRnZfYA+mRnZclnZsUBxWdkZ2XqATTJIWEwYzU5OMghVGV4dCI6IsgPRm/EWSI3MDAgMTZweCBBcmlhbMgd5gCpMjR9",
            logoImageUrl: "https://martinsutka.github.io/icongenerator/#dGl0bGU9R2FudHRDaGFydCZqc29uPXsic2hvd0d1aWRlcyI6dHJ1ZSwiZ8UOU2l6ZSI6NjTIEFgiOjDIDFnFDGljb27GJjc0xg7GJMQKWSI6MsYKQ29sb3IiOiIjZmZjMzE0Isc4aGFkb3fJHDDFAc0cxlo1yGjFFEludGVuc2l0eSI6M8gZdmciOiI8c3ZnIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiB3aWR0aD1cIjI0XCIgaGVpZ2h0yA52aWV3Qm94PVwiMCAwIDI0IMQWPjxwYXRoIGZpbGw9XCJjdXJyZW505QC4XCIgZD1cIk0yIDcuMjVBMy4yNSDFBcQ+MSA1xAs0aDN2M0g2YTIgMsUVxBs0aDIuMjV2OWgtM9E1MiAxNi43NXpNOcQUMjB2LTlIMTB2McdBxAIyIDJoMc0SMS43NSAxLjk4NVYyMHpNMTIgMTBoMi43NVY0aC01LjV2M0gxMMkwxGUyem02IDdoLeUAiTNo8ACIMCAy5wCJdi05LvAA2zAgMTjEcjRoLTN2Nkgx6ADex1vpAJsx5QDwNE02IDhhxgzHXGg0xxDFFC0yem01IMgTxTctMcsjxAYyaC3LIS0xLTFtNCAyzEYgMmgzz1ZcIi8+POQB9j7kAlhzQmFja2dyb3VuZFRyYW5zcGHkAckiOmZhbHNlLCJiyR5X5AIhIjoxMjjMFkjlAirRF+kCwTI0xAIizBxMxDLJITdkxALSIesC0zU1zB74AyLQIuYDKDTMGUJvcmRlclJhZGl1cyI6NuQDKnNCYWRnZfYA+mRnZclnZsUBxWdkZ2XqATTJIWEwYzU5OMghVGV4dCI6IsgPRm/EWSI3MDAgMTZweCBBcmlhbMgd5gCpMjR9",
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
                name: "Id", value: "id"
            }, {
                name: "Area Path", value: "areaPath"
            }, {
                name: "Assigned To", value: "assignedTo"
            }, {
                name: "Iteration Path", value: "iterationPath"
            }, {
                name: "Completed Work", value: "completedWork"
            }, {
                name: "Dates", value: "dates"
            }, {
                name: "Duration", value: "duration"
            }, {
                name: "Effort", value: "effort"
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