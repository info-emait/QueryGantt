module.exports = function (grunt) {
    //#region [ Configuration ]

    grunt.config("concat", {
        "azure-devops-ui": {
            src: [
                "js/libs/ui/Components/Spinner/Spinner.css",
                "js/libs/ui/Components/Menu/Menu.css",
                "js/libs/ui/Components/Menu/MenuButton.css",
                "js/libs/ui/Components/Button/Button.css",
                "js/libs/ui/Components/Button/ExpandableButton.css",
                "js/libs/ui/Components/ButtonGroup/ButtonGroup.css",
                "js/libs/ui/Components/FormItem/FormItem.css",
                "js/libs/ui/Components/Header/Header.css",
                "js/libs/ui/Components/TextField/TextField.css",
                "js/libs/ui/Components/Page/Page.css",
                "js/libs/ui/Components/MessageBar/MessageBar.css",
                "js/libs/ui/Components/MessageCard/MessageCard.css",
                "js/libs/ui/Components/List/List.css",
                "js/libs/ui/Components/ListBox/ListBox.css",
                "js/libs/ui/Components/Table/Table.css",
                "js/libs/ui/Components/Card/Card.css",
                "js/libs/ui/Components/Surface/Surface.css",
                "js/libs/ui/Components/ZeroData/ZeroData.css",
                "js/libs/ui/Components/Status/Status.css",
                "js/libs/ui/Components/PillGroup/PillGroup.css",
                "js/libs/ui/Components/Pill/Pill.css",
                "js/libs/ui/Components/FilterBar/FilterBar.css",
                "js/libs/ui/Components/Filter/Filter.css",
                "js/libs/ui/Components/Dropdown/Dropdown.css",
                "js/libs/ui/Components/Callout/Callout.css",
                "js/libs/ui/Components/Icon/FabricIcons.css",
                "js/libs/ui/Components/Icon/FluentIcons.css",
                "js/libs/ui/Core/override.css",
                "js/libs/ui/Core/core.css"
            ],
            dest: "css/azure-devops-ui.css"
        }
    });

    //#endregion


    //#region [ Tasks ]

    grunt.loadNpmTasks("grunt-contrib-concat");

    //#endregion
};