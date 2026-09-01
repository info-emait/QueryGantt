define([
    "module",
    "require",
    "knockout",
    "sdk",
    "api/index",
    "services/data",
    "services/field-columns"
], (module, require, ko, sdk, api, dataService, fieldColumnsService) => {
    //#region [ Fields ]

    const global = (function () { return this; })();
    const doc = global.document;
    const cnf = module.config();

    //#endregion


    //#region [ Constructors ]
    
    /**
     * Constructor.
     * 
     * @param {object} args Arguments.
     */
    const Model = function (args = {}) {
        console.debug("QueryGanttConfigurationApp()");

        this.version = args.version;
        this.project = args.project;
        const selected = fieldColumnsService.normalizeSelection(ko.isObservable(args.fieldsValue) ? args.fieldsValue() : args.fieldsValue);
        const definitions = ko.isObservable(args.fields) ? args.fields() : args.fields;
        this.fields = ko.observableArray(fieldColumnsService.mergeDefinitions(definitions || [], [], selected));
        this.fieldsValue = ko.observableArray(selected);
        this._nextFieldRowId = 1;
        this._draggedFieldRow = null;
        this._keyboardFieldRow = null;
        this.fieldRows = ko.observableArray(selected.map((value) => this._createFieldRow(value)));
        this.panel = args.panel;
    };

    //#endregion


    //#region [ Methods : Public ]

    /**
     * Initialize the application.
     */
    Model.prototype.init = function () {
        return Promise.resolve(true);
    };


    /**
     * Closes the panel.
     */
    Model.prototype.close = function() {
        this.panel.close();
    };


    /**
     * Adds the first field that is not already selected.
     */
    Model.prototype.addField = function () {
        const selected = new Set(this.fieldRows().map((row) => row.value()));
        const definition = this.fields().find((field) => !selected.has(field.value));
        if (!definition) {
            return false;
        }
        this.fieldRows.push(this._createFieldRow(definition.value));
        this._syncFieldsValue();
        return true;
    };


    /**
     * Removes one selected column.
     */
    Model.prototype.removeField = function (row) {
        this.fieldRows.remove(row);
        if (this._keyboardFieldRow === row) {
            this._keyboardFieldRow = null;
        }
        this._syncFieldsValue();
    };


    /**
     * Keeps a changed select unique. Selecting an existing value swaps the
     * two rows rather than silently dropping either configured column.
     */
    Model.prototype.changeField = function (row) {
        const value = row.value();
        const duplicate = this.fieldRows().find((candidate) => candidate !== row && candidate.value() === value);
        if (duplicate) {
            duplicate.value(row.previousValue);
            duplicate.previousValue = row.previousValue;
        }
        row.previousValue = value;
        this._syncFieldsValue();
    };


    /**
     * Moves one row by a relative offset.
     */
    Model.prototype.moveField = function (row, offset) {
        const rows = this.fieldRows().slice();
        const from = rows.indexOf(row);
        const to = Math.max(0, Math.min(rows.length - 1, from + offset));
        if (from < 0 || from === to) {
            return false;
        }
        rows.splice(from, 1);
        rows.splice(to, 0, row);
        this.fieldRows(rows);
        this._syncFieldsValue();
        return true;
    };


    /**
     * Starts pointer drag reorder.
     */
    Model.prototype.startFieldDrag = function (row, event) {
        this._draggedFieldRow = row;
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", row.id + "");
        }
        return true;
    };


    /**
     * Allows a field row to receive a drop.
     */
    Model.prototype.allowFieldDrop = function (row, event) {
        if (this._draggedFieldRow && this._draggedFieldRow !== row) {
            event.preventDefault();
            if (event.dataTransfer) {
                event.dataTransfer.dropEffect = "move";
            }
        }
        return true;
    };


    /**
     * Drops the dragged row before or after the target based on pointer half.
     */
    Model.prototype.dropField = function (row, event) {
        event.preventDefault();
        const dragged = this._draggedFieldRow;
        this._draggedFieldRow = null;
        if (!dragged || dragged === row) {
            return false;
        }

        const rows = this.fieldRows().slice();
        const from = rows.indexOf(dragged);
        let to = rows.indexOf(row);
        const bounds = event.currentTarget && typeof(event.currentTarget.getBoundingClientRect) === "function"
            ? event.currentTarget.getBoundingClientRect()
            : null;
        const after = bounds && Number.isFinite(event.clientY) && event.clientY > bounds.top + (bounds.height / 2);
        rows.splice(from, 1);
        to = rows.indexOf(row) + (after ? 1 : 0);
        rows.splice(to, 0, dragged);
        this.fieldRows(rows);
        this._syncFieldsValue();
        return true;
    };


    /**
     * Clears pointer drag state.
     */
    Model.prototype.endFieldDrag = function () {
        this._draggedFieldRow = null;
        return true;
    };


    /**
     * Accessible keyboard reorder: Space enters/exits reorder mode and the
     * Up/Down arrows move the grabbed row.
     */
    Model.prototype.onFieldKeyDown = function (row, event) {
        const key = event.key;
        if (key === " " || key === "Spacebar") {
            event.preventDefault();
            if (this._keyboardFieldRow === row) {
                this._keyboardFieldRow = null;
                row.grabbed(false);
            }
            else {
                if (this._keyboardFieldRow) {
                    this._keyboardFieldRow.grabbed(false);
                }
                this._keyboardFieldRow = row;
                row.grabbed(true);
            }
            return false;
        }
        if (key === "Escape" && this._keyboardFieldRow === row) {
            event.preventDefault();
            this._keyboardFieldRow = null;
            row.grabbed(false);
            return false;
        }
        if (this._keyboardFieldRow === row && (key === "ArrowUp" || key === "ArrowDown")) {
            event.preventDefault();
            this.moveField(row, key === "ArrowUp" ? -1 : 1);
            return false;
        }
        return true;
    };


    /**
     * Saves settings and closes the panel.
     */
    Model.prototype.save = function() {
        const fieldsValue = this._getFieldsValue();
        const settings = {
            showFields: fieldsValue
        };

        dataService.getManager().then((manager) => {
            manager.setValue(`gantt_${this.project.id}`, JSON.stringify(settings), { scopeType: "User" });
            this.panel.close({ fieldsValue });
        });
    };


    /**
     * Dispose.
     */
    Model.prototype.dispose = function () {
        console.log("~QueryGanttConfigurationApp()");
    };

    //#endregion


    //#region [ Methods ]

    /**
     * Creates one selectable/reorderable field row.
     */
    Model.prototype._createFieldRow = function (value) {
        return {
            id: this._nextFieldRowId++,
            value: ko.observable(value),
            previousValue: value,
            grabbed: ko.observable(false)
        };
    };


    /**
     * Returns the current ordered selection, including compatibility with
     * older tests/hosts that only provide fieldsValue.
     */
    Model.prototype._getFieldsValue = function () {
        if (this.fieldRows && typeof(this.fieldRows) === "function") {
            return fieldColumnsService.normalizeSelection(this.fieldRows().map((row) => row.value()));
        }
        return fieldColumnsService.normalizeSelection(this.fieldsValue && typeof(this.fieldsValue) === "function" ? this.fieldsValue() : []);
    };


    /**
     * Mirrors ordered rows to the legacy observable consumed by save tests.
     */
    Model.prototype._syncFieldsValue = function () {
        const value = this._getFieldsValue();
        if (this.fieldsValue && typeof(this.fieldsValue) === "function") {
            this.fieldsValue(value);
        }
        return value;
    };

    /**
     * Fires function when DOM is ready.
     *
     * @param {function} fn Function.
     */
    let ready = function (fn) {
        if (doc.attachEvent ? (doc.readyState === "complete") : (doc.readyState !== "loading")) {
            fn();
        }
        else {
            doc.addEventListener("DOMContentLoaded", fn);
        }
    };

    //#endregion


    //#region [ Start ]

    ready(function () {
        sdk.init({                        
            loaded: false,
            applyTheme: true
        });

        sdk.ready()
            .then(() => sdk.getService(api.CommonServiceIds.ProjectPageService).then((service) => service.getProject()))
            .then((project) => {
                //sdk.resize(300, undefined);
                const config = sdk.getConfiguration();

                // Create application model
                const model = new Model({
                    version: cnf.version,
                    project: project,
                    fields: config.fields,
                    fieldsValue: config.fieldsValue,
                    panel: config.panel
                });
                console.debug("QueryGanttConfigurationApp : ready() : %o", model);
                
                // Register dialog
                sdk.register("#{Extension.Id}#-configuration", () => model);

                // Start application and init application
                ko.applyBindings(model, doc.body);
                sdk.notifyLoadSucceeded();
                model.init().then(() => console.debug("Query Gantt configuration is running."));
            });
    });

    //#endregion
});
