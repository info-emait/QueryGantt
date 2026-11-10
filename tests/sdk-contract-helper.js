"use strict";
const fs = require('fs');
const path = require('path');
const vm = require('vm');
// Load the pinned SDK, including its real URL serializer, without network I/O.
module.exports = function (issueRequest) {
    const sdkRoot = path.resolve(__dirname, '../node_modules/azure-devops-extension-api');
    const cache = new Map([['Common/Fetch', { issueRequest }]]);
    const load = (id) => {
        if (cache.has(id)) return cache.get(id);
        const exports = {};
        cache.set(id, exports);
        vm.runInNewContext(fs.readFileSync(path.join(sdkRoot, id + '.js'), 'utf8'), {
            URL, Date, Promise, console,
            define: (names, factory) => {
                const dependencies = names.map((name) => name === 'exports' ? exports : name === 'require' ? () => {} : load(path.posix.normalize(path.posix.join(path.posix.dirname(id), name))));
                const result = factory(...dependencies);
                if (result !== undefined) cache.set(id, result);
            }
        }, { filename: id });
        return cache.get(id);
    };
    return load('WorkItemTracking/WorkItemTrackingClient').WorkItemTrackingRestClient;
};
