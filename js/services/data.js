define([
    "sdk",
    "api/index"
], (sdk, api) => {
    //#region [ Methods : Public ]

    /**
     * Gets settings manager.
     */
    const getManager = function() {
        return Promise
            .all([
                sdk.getAccessToken(),
                sdk.getService(api.CommonServiceIds.ExtensionDataService)
            ])
            .then((response) => {
                const token = response[0];
                const service = response[1];

                return service.getExtensionDataManager(sdk.getExtensionContext().id, token);
            });
    };

    //#endregion

    return {
        getManager
    };
});