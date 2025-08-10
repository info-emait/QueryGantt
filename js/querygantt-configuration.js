require({
    urlArgs: "v=#{Project.AssemblyInfo.Version}#",
    packages: [{
        name: "my",
        location: "./"
    }, {
        name: "services",
        location: "./services"
    }],
    paths: {
        "knockout": "./libs/knockout",
        "text": "./libs/text",
        "whatwg-fetch": "./libs/whatwg-fetch",
        "sdk": "./libs/sdk",
        "api": "./libs/api"
    },
    map: {
        "*": {
            "azure-devops-extension-sdk": "sdk"
        }
    },
    config: {
        "my/#{Extension.Id}#-configuration-app": {
            version: "#{Project.AssemblyInfo.Version}#"
        }
    }
}, ["my/#{Extension.Id}#-configuration-app"]);