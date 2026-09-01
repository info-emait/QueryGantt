define([], () => {
    //#region [ Fields ]

    const fieldPrefix = "field:";
    const workItemUsage = 1;
    const htmlFieldType = 4;

    const isWorkItemUsage = function (usage) {
        return usage === undefined || usage === null || usage === workItemUsage
            || String(usage).toLowerCase() === "workitem";
    };

    const isHtmlFieldType = function (type) {
        return type === htmlFieldType || String(type).toLowerCase() === "html";
    };

    // These Azure fields already have backwards-compatible Query Gantt
    // columns. Do not show a second, indistinguishable option for them.
    const legacyReferenceNames = {
        "System.Id": "id",
        "System.AreaPath": "areaPath",
        "System.AssignedTo": "assignedTo",
        "System.IterationPath": "iterationPath",
        "Microsoft.VSTS.Scheduling.CompletedWork": "completedWork",
        "Microsoft.VSTS.Scheduling.Effort": "effort",
        "System.NodeName": "nodeName",
        "System.Parent": "parentTitle",
        "Microsoft.VSTS.Scheduling.RemainingWork": "remainingWork",
        "System.Tags": "tags",
        "System.TeamProject": "project"
    };

    //#endregion


    //#region [ Methods : Public ]

    /**
     * Creates the persisted value used for an Azure work-item field.
     */
    const getValue = function (referenceName) {
        return referenceName ? fieldPrefix + referenceName : "";
    };


    /**
     * Returns the Azure reference name represented by a persisted value.
     */
    const getReferenceName = function (value) {
        return typeof(value) === "string" && value.indexOf(fieldPrefix) === 0
            ? value.substring(fieldPrefix.length)
            : null;
    };


    /**
     * Combines the legacy Query Gantt columns with fields returned by Azure
     * DevOps. Previously saved fields remain visible even if field discovery
     * temporarily fails, so users can remove or reorder them safely.
     */
    const mergeDefinitions = function (legacy, azureFields, selected) {
        const result = [];
        const values = new Set();

        (legacy || []).forEach((definition) => {
            if (!definition || !definition.value || values.has(definition.value)) {
                return;
            }
            values.add(definition.value);
            result.push(Object.assign({}, definition, { kind: "legacy" }));
        });

        (azureFields || [])
            .filter((field) => field && field.referenceName && !field.isDeleted
                && isWorkItemUsage(field.usage)
                && field.referenceName !== "System.Title"
                && !legacyReferenceNames[field.referenceName])
            .slice()
            .sort((left, right) => {
                const name = (left.name || left.referenceName).localeCompare(right.name || right.referenceName);
                return name || left.referenceName.localeCompare(right.referenceName);
            })
            .forEach((field) => {
                const value = getValue(field.referenceName);
                if (values.has(value)) {
                    return;
                }
                values.add(value);
                result.push({
                    name: field.name || field.referenceName,
                    value: value,
                    referenceName: field.referenceName,
                    type: field.type,
                    isIdentity: Boolean(field.isIdentity),
                    kind: "field"
                });
            });

        normalizeSelection(selected).forEach((value) => {
            if (values.has(value)) {
                return;
            }
            values.add(value);
            const referenceName = getReferenceName(value);
            result.push({
                name: referenceName ? `${referenceName} (Unavailable)` : `${value} (Unavailable)`,
                value: value,
                referenceName: referenceName,
                kind: referenceName ? "field" : "unknown",
                unavailable: true
            });
        });

        return result;
    };


    /**
     * Removes blank and duplicate selection values without changing order.
     */
    const normalizeSelection = function (values) {
        const seen = new Set();
        return (Array.isArray(values) ? values : [])
            .filter((value) => typeof(value) === "string" && value.length && !seen.has(value) && seen.add(value));
    };


    /**
     * Converts Azure's heterogeneous field values to one-line column text.
     */
    const formatValue = function (value, definition) {
        if (value === null || value === undefined) {
            return "";
        }
        if (Array.isArray(value)) {
            return value.map((entry) => formatValue(entry, definition)).filter((entry) => entry.length).join(", ");
        }
        if (typeof(value) === "object") {
            if (value.displayName !== undefined) {
                return String(value.displayName || value.uniqueName || "");
            }
            if (value.name !== undefined) {
                return String(value.name || "");
            }
            if (value.value !== undefined) {
                return formatValue(value.value, definition);
            }
            try {
                return JSON.stringify(value);
            }
            catch (error) {
                return String(value);
            }
        }
        if (typeof(value) === "boolean") {
            return value ? "True" : "False";
        }

        let text = String(value);
        if (definition && isHtmlFieldType(definition.type)) {
            text = text
                .replace(/<\s*br\s*\/?>/gi, " ")
                .replace(/<\s*\/p\s*>/gi, " ")
                .replace(/<[^>]*>/g, "")
                .replace(/&nbsp;/gi, " ")
                .replace(/&amp;/gi, "&")
                .replace(/&lt;/gi, "<")
                .replace(/&gt;/gi, ">")
                .replace(/&quot;/gi, "\"")
                .replace(/&#39;/gi, "'");
        }
        return text.replace(/\s+/g, " ").trim();
    };


    /**
     * Escapes field data before inserting it into vis-timeline's HTML
     * template. vis-timeline XSS processing is disabled by the legacy app.
     */
    const escapeHtml = function (value) {
        return String(value === null || value === undefined ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#39;");
    };

    //#endregion

    return {
        fieldPrefix,
        getValue,
        getReferenceName,
        mergeDefinitions,
        normalizeSelection,
        formatValue,
        escapeHtml
    };
});
