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
        this._fieldPointerId = null;
        this._fieldPointerHandle = null;
        this._fieldDropRow = null;
        this._fieldDropElement = null;
        this._fieldDropAfter = false;
        this._fieldPointerMoveHandler = this._onFieldPointerMove.bind(this);
        this._fieldPointerUpHandler = this._onFieldPointerUp.bind(this);
        this._fieldPointerCancelHandler = this._onFieldPointerCancel.bind(this);
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
     * Starts pointer-based row reordering. Native HTML drag/drop is not used
     * because Azure DevOps hosts this pane inside an extension iframe, where
     * the browser drag lifecycle is not reliably delivered.
     */
    Model.prototype.startFieldPointerDrag = function (row, event) {
        if (!event || event.isPrimary === false || (event.button !== undefined && event.button !== 0)) {
            return true;
        }

        this._clearFieldPointerDrag();
        if (this._keyboardFieldRow) {
            this._keyboardFieldRow.grabbed(false);
            this._keyboardFieldRow = null;
        }

        event.preventDefault();
        event.stopPropagation();
        this._draggedFieldRow = row;
        this._fieldPointerId = event.pointerId;
        this._fieldPointerHandle = event.currentTarget || null;
        row.grabbed(true);

        if (this._fieldPointerHandle) {
            if (typeof(this._fieldPointerHandle.focus) === "function") {
                this._fieldPointerHandle.focus();
            }
            if (typeof(this._fieldPointerHandle.setPointerCapture) === "function") {
                try {
                    this._fieldPointerHandle.setPointerCapture(event.pointerId);
                }
                catch (error) {
                }
            }
        }

        if (typeof(doc.addEventListener) === "function") {
            doc.addEventListener("pointermove", this._fieldPointerMoveHandler, true);
            doc.addEventListener("pointerup", this._fieldPointerUpHandler, true);
            doc.addEventListener("pointercancel", this._fieldPointerCancelHandler, true);
        }
        return false;
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
        this._clearFieldPointerDrag();
        if (this._keyboardFieldRow) {
            this._keyboardFieldRow.grabbed(false);
            this._keyboardFieldRow = null;
        }
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
     * Tracks a pointer over the field rows even after it leaves the handle.
     */
    Model.prototype._onFieldPointerMove = function (event) {
        if (!this._draggedFieldRow || event.pointerId !== this._fieldPointerId) {
            return true;
        }
        event.preventDefault();
        this._updateFieldDropTarget(event);
        return false;
    };


    /**
     * Commits the current pointer drop target.
     */
    Model.prototype._onFieldPointerUp = function (event) {
        if (!this._draggedFieldRow || event.pointerId !== this._fieldPointerId) {
            return true;
        }
        event.preventDefault();
        event.stopPropagation();
        this._updateFieldDropTarget(event);

        const dragged = this._draggedFieldRow;
        const target = this._fieldDropRow;
        const after = this._fieldDropAfter;
        this._clearFieldPointerDrag();
        if (target) {
            this._moveFieldTo(dragged, target, after);
        }
        return false;
    };


    /**
     * Cancels a pointer gesture without changing the saved order.
     */
    Model.prototype._onFieldPointerCancel = function (event) {
        if (!this._draggedFieldRow || event.pointerId !== this._fieldPointerId) {
            return true;
        }
        event.preventDefault();
        event.stopPropagation();
        this._clearFieldPointerDrag();
        return false;
    };


    /**
     * Finds the field row under the pointer and marks its insertion edge.
     */
    Model.prototype._updateFieldDropTarget = function (event) {
        this._clearFieldDropTarget();
        if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY) || typeof(doc.elementFromPoint) !== "function") {
            return false;
        }

        const element = doc.elementFromPoint(event.clientX, event.clientY);
        const rowElement = element && typeof(element.closest) === "function"
            ? element.closest(".querygantt-configuration__field-row")
            : null;
        const rowId = rowElement && typeof(rowElement.getAttribute) === "function"
            ? rowElement.getAttribute("data-field-row-id")
            : null;
        const row = this.fieldRows().find((candidate) => candidate.id + "" === rowId);
        if (!row || row === this._draggedFieldRow) {
            return false;
        }

        const bounds = typeof(rowElement.getBoundingClientRect) === "function"
            ? rowElement.getBoundingClientRect()
            : null;
        const after = !!(bounds && event.clientY > bounds.top + (bounds.height / 2));
        this._fieldDropRow = row;
        this._fieldDropElement = rowElement;
        this._fieldDropAfter = after;
        if (rowElement.classList) {
            rowElement.classList.add("querygantt-configuration__field-row--drop-" + (after ? "after" : "before"));
        }
        return true;
    };


    /**
     * Moves a field row to one side of another row.
     */
    Model.prototype._moveFieldTo = function (dragged, target, after) {
        const original = this.fieldRows().slice();
        const rows = original.slice();
        const from = rows.indexOf(dragged);
        if (from < 0 || rows.indexOf(target) < 0 || dragged === target) {
            return false;
        }

        rows.splice(from, 1);
        const to = rows.indexOf(target) + (after ? 1 : 0);
        rows.splice(to, 0, dragged);
        if (rows.every((row, index) => row === original[index])) {
            return false;
        }

        this.fieldRows(rows);
        this._syncFieldsValue();
        return true;
    };


    /**
     * Clears the visible insertion marker.
     */
    Model.prototype._clearFieldDropTarget = function () {
        if (this._fieldDropElement && this._fieldDropElement.classList) {
            this._fieldDropElement.classList.remove("querygantt-configuration__field-row--drop-before");
            this._fieldDropElement.classList.remove("querygantt-configuration__field-row--drop-after");
        }
        this._fieldDropRow = null;
        this._fieldDropElement = null;
        this._fieldDropAfter = false;
    };


    /**
     * Releases capture and all document listeners for a pointer gesture.
     */
    Model.prototype._clearFieldPointerDrag = function () {
        if (typeof(doc.removeEventListener) === "function") {
            doc.removeEventListener("pointermove", this._fieldPointerMoveHandler, true);
            doc.removeEventListener("pointerup", this._fieldPointerUpHandler, true);
            doc.removeEventListener("pointercancel", this._fieldPointerCancelHandler, true);
        }
        this._clearFieldDropTarget();

        if (this._draggedFieldRow) {
            this._draggedFieldRow.grabbed(false);
        }
        if (this._fieldPointerHandle && typeof(this._fieldPointerHandle.releasePointerCapture) === "function" && this._fieldPointerId !== null) {
            try {
                this._fieldPointerHandle.releasePointerCapture(this._fieldPointerId);
            }
            catch (error) {
            }
        }

        this._draggedFieldRow = null;
        this._fieldPointerId = null;
        this._fieldPointerHandle = null;
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
