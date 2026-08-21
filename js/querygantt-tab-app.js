define([
    "module",
    "require",
    "polyfills",
    "knockout",
    "bindings",
    "sdk",
    "xlsx",
    "dom-to-image",
    "api/index",
    "api/WorkItemTracking/index",
    "api/Work/index",
    "services/data",
    "services/backlog-order",
    "services/icon",
    "my/templates/gantt",
    "my/components/legend",
    "my/components/timeline",
    "my/components/spinner",
    "my/components/message",
    "my/components/filter",
    "my/components/zerodata"
], function (module, require, polyfills, ko, bindings, sdk, xlsx, domtoimage, api, witApi, workApi, dataService, backlogOrderService, iconService, ganttTemplate) {
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
    const Model = function (args) {
        console.debug("QueryGanttTabApp()");

        this.version = args.version;
        this.user = args.user;
        this.project = args.project;
        this.team = args.team;
        this.query = args.query;
        this.manager = args.manager || null;
        this.settingsKey = args.settingsKey || null;
        this.settings = args.settings && (typeof(args.settings) === "object") && !Array.isArray(args.settings) ? args.settings : {};
        this._settingsSavePromise = Promise.resolve();

        this.token = null;
        this.path = null;
        this._backlogRequestId = 0;

        this.zero = ko.observable(null);

        this.showFields = ko.observableArray(Array.isArray(args.showFields) ? args.showFields : ["duration"]).extend({ rateLimit: { timeout: 1000, method: "notifyWhenChangesStop" } });

        this.isLoading = ko.observable(true);
        this.types = ko.observableArray([]);
        this.typesOther = ko.observableArray([]);
        this.icons = ko.observable({});
        this.sortColumns = ko.observableArray([]);
        this.witIds = ko.observableArray([]);
        this.relations = ko.observableArray([]);
        this.wits = ko.observableArray([]);
        this.backlogIndex = ko.observable(backlogOrderService.empty());
        this.backlogAvailable = ko.observable(false);
        this.backlogLoading = ko.observable(false);
        this.isHistorical = ko.observable(false);
        this.orderMode = ko.observable(args.orderMode === backlogOrderService.backlogOrder ? backlogOrderService.backlogOrder : backlogOrderService.queryOrder);
        this.current = ko.observable(null);
        this.currentId = ko.observable(null);
        
        this.states = ko.computed(this._getStates, this);
        this.priorities = ko.observableArray(args.priorities);
        this.fields = ko.observableArray(args.fields);

        this.assigneesFilter = ko.observableArray();
        this.statesFilter = ko.observableArray();
        this.tagsFilter = ko.observableArray();
        this.areasFilter = ko.observableArray();
        this.parentsFilter = ko.observableArray();
        this.prioritiesFilter = ko.observableArray(["1 - Must have", "2 - Should have", "3 - Could have", "4 - Won't have"]);

        this.filterPrimary = ko.observable({});
        this.filter = ko.observable({});
        this.filteredPrimaryWits = ko.computed(this._getFilteredPrimaryWits, this);
        this.filteredWits = ko.computed(this._getFilteredWits, this);
        this.isBacklogOrder = ko.computed(() => (this.orderMode() === backlogOrderService.backlogOrder) && this.backlogAvailable());
        this.orderedWits = ko.computed(this._getOrderedWits, this);
        this.backlogOrderTitle = ko.computed(this._getBacklogOrderTitle, this);

        this.isTotalEffortVisible = ko.computed(() => this.showFields().includes("effort"));  
        this.isTotalRemainingWorkVisible = ko.computed(() => this.showFields().includes("remainingWork"));
        this.isTotalCompletedWorkVisible = ko.computed(() => this.showFields().includes("completedWork"));

        this.queryType = ko.observable("");

        this.message = ko.observable("");

        this._timeline_expandAction = ko.observable();
        this._timeline_collapseAction = ko.observable();
        this._timeline_moveLeftAction = ko.observable();
        this._timeline_moveRightAction = ko.observable();
        this._timeline_zoomOutAction = ko.observable();
        this._timeline_zoomInAction = ko.observable();
        this._timeline_zoomResetAction = ko.observable();
        this._timeline_focusAction = ko.observable();
        this._timeline_closeAction = ko.observable();
        this._timeline_refreshAction = ko.observable();
        this._timeline_updateAction = ko.observable();

        this.updateQueryString = ko.computed(this._updateQueryString, this).extend({ deferred: true });

        this.getAssigneesFilter = ko.computed(this._getAssigneesFilter, this);
        this.getStatesFilter = ko.computed(this._getStatesFilter, this);
        this.getTagsFilter = ko.computed(this._getTagsFilter, this);
        this.getAreasFilter = ko.computed(this._getAreasFilter, this);
        this.getParentsFilter = ko.computed(this._getParentsFilter, this);
        this.showDetail = ko.computed(this._showDetail, this);
        this._orderModeSubscribe = this.orderMode.subscribe(this._saveOrderMode, this);
    };

    //#endregion


    //#region [ Methods : Public ]

    /**
     * Initialize the application.
     * 
     * @param {string} asOf Specifies a historical query by indicating a date for when the filter is to be applied.
     */
    Model.prototype.init = function (asOf = null) {
        const client = api.getClient(witApi.WorkItemTrackingRestClient);
        let queryAsOf = null;
        let queryBacklogIndex = backlogOrderService.empty();
        const historical = asOf !== null;
        this.isHistorical(historical);
        const backlogPromise = this._loadBacklogOrder(asOf);

        return client._options.rootPath.then((path) => {
                this.path = path;
                return sdk.getAccessToken();
            })
            .then((token) => {
                this.token = token;
                return fetch(this.path + this.project.name + "/_apis/wit/workItemTypes", this._getFetchParams())
                    .then((response) => response.ok ? response.json() : null);
            })
            .then((types) => {
                this.types(types.value);
                
                // https://learn.microsoft.com/en-us/azure/devops/boards/queries/wiql-syntax?view=azure-devops
                // MODE (Recursive): Use for Tree queries ([System.Links.LinkType] = 'System.LinkTypes.Hierarchy-Forward').
                // Link type must be Tree topology and forward direction. Returns WorkItemLinkInfo records for all work items
                // that satisfy the source, recursively for target. ORDER BY and ASOF aren't compatible with tree queries.
                return Promise.all([
                    client.queryByWiql({ query: (asOf !== null) && (this.query.wiql.toLowerCase().indexOf("mode (recursive)") === -1) ? `${this.query.wiql} ASOF '${asOf}'` : this.query.wiql }, this.project.id),
                    backlogPromise
                ]).then((response) => {
                    queryBacklogIndex = response[1];
                    return response[0];
                });
            })
            .then((data) => {
                this.sortColumns(data.sortColumns || []);
                this.queryType(data.queryType === 1 ? "flat" : data.queryType === 2 ? "tree" : "onehop");
                queryAsOf = data.asOf || null;

                // Query type "flat"
                if (data.queryType === 1) {
                    this.witIds(data.workItems.map((wit)  => wit.id));
                    return;
                }

                // Query type "tree", "oneHop"
                if((data.queryType === 2) || (data.queryType === 3)) {
                    this.relations(data.workItemRelations || []);
                    this.witIds(this.relations().map((wit) => wit.target.id));
                }
            })
            .then(() => {
                var ids = this.witIds();

                if (!ids.length) {
                    return Promise.resolve([]);
                }

                // Split request into chunks
                var xhrs = [];
                var i;
                var j;
                var chunk = 200;
                for (i = 0, j = ids.length; i < j; i += chunk) {
                    xhrs.push(client.getWorkItems(ids.slice(i, i + chunk), this.project.id, null, queryAsOf, "all"));
                }

                // Load work items
                return Promise.all(xhrs).then((chunks) => Array.prototype.concat.apply([], chunks));
            })
            .then((wits) => {
                var relations = this.relations();
                var results = [];
                
                // Normalize results
                wits.forEach((wit) => {
                    var w = {
                        id: wit.fields["System.Id"],
                        originalId: wit.fields["System.Id"],
                        parentId: wit.fields["System.Parent"] || null,
                        rev: wit.fields["System.Rev"],
                        project: wit.fields["System.TeamProject"],
                        url: wit.url,
                        type: wit.fields["System.WorkItemType"],
                        title: wit.fields["System.Title"],
                        description: wit.fields["System.Description"],
                        state: wit.fields["System.State"],
                        priority: wit.fields["Microsoft.VSTS.Common.Priority"],
                        areaPath: wit.fields["System.AreaPath"],
                        nodeName: wit.fields["System.NodeName"],
                        iterationPath: wit.fields["System.IterationPath"],
                        createdBy: wit.fields["System.CreatedBy"].displayName,
                        changedBy: wit.fields["System.ChangedBy"].displayName,
                        assignedTo: (wit.fields["System.AssignedTo"] || {}).displayName || wit.fields["System.AssignedTo"] || "",
                        createdDate: wit.fields["System.CreatedDate"],
                        changedDate: wit.fields["System.ChangedDate"],
                        startDate: wit.fields["Microsoft.VSTS.Scheduling.StartDate"],
                        targetDate: wit.fields["Microsoft.VSTS.Scheduling.TargetDate"],
                        completedWork: (wit.fields["Microsoft.VSTS.Scheduling.CompletedWork"] || 0),
                        remainingWork: (wit.fields["Microsoft.VSTS.Scheduling.RemainingWork"] || 0),
                        effort: (wit.fields["Microsoft.VSTS.Scheduling.Effort"] || 0),
                        backlogOrderValue: queryBacklogIndex.orderField ? wit.fields[queryBacklogIndex.orderField] : null,
                        tags: (wit.fields["System.Tags"] || "").split("; ").filter((t) => (t || "").length),
                        attachments: (wit.relations || []).filter((a) => a.rel === "AttachedFile"),
                        dependencies: (wit.relations || []).filter((a) => (a.rel === "System.LinkTypes.Dependency-Forward") && ((a.attributes || {}).name === "Successor")).map((r) => parseInt(r.url.split("/").pop()))
                    };

                    // If there is the same item more than once in the result tree
                    this._getPaths(relations, wit.id).forEach((p, idx) => {
                        var o = JSON.parse(JSON.stringify(w));

                        o.createdDate = new Date(o.createdDate);
                        o.changedDate = new Date(o.changedDate);
                        o.startDate = new Date(o.startDate);
                        o.targetDate = new Date(o.targetDate);
                        o.path = (p instanceof Array) ? p[0] : p;
                        o.level = o.path.split("/").length;
                        o.parent = o.path.replace(new RegExp("\/?" + o.id, "g"),"");
                        o.id = (idx > 0) ? o.id + "_" + idx : o.id;
                        o.startDate = ((o.startDate + "") === "Invalid Date") ? null : o.startDate;
                        o.targetDate = ((o.targetDate + "") === "Invalid Date") ? null : o.targetDate;

                        results.push(o);
                    });
                });

                backlogOrderService.includeQueryItems(queryBacklogIndex, results);
                if (!historical) {
                    this.backlogIndex(queryBacklogIndex);
                    this.backlogAvailable(Object.keys(queryBacklogIndex.levels || {}).length > 0);
                }

                const duplicateCount = {};
                results.forEach((wit) => duplicateCount[wit.originalId] = (duplicateCount[wit.originalId] || 0) + 1);
                results.forEach((wit) => {
                    const entry = backlogOrderService.getEntry(queryBacklogIndex, wit.originalId, wit.type);
                    wit.backlogOrder = entry ? {
                        eligible: !historical && (wit.project === this.project.name) && (duplicateCount[wit.originalId] === 1),
                        parentId: entry.parentId,
                        backlogId: entry.backlogId,
                        backlogRank: entry.backlogRank,
                        position: entry.position
                    } : {
                        eligible: false
                    };
                });

                return results;
            })
            .then((wits) => {
                // Get unique project names except the current one
                let projects = [...new Set(wits.map((w) => w.project).filter((p) => p !== this.project.name))];

                // If the query is done across multiple projects we need to download types for these projects as well
                if (projects.length) {
                    let xhrs = projects.map((p) => fetch(this.path + p + "/_apis/wit/workItemTypes", this._getFetchParams())
                        .then((response) => response.ok ? response.json() : null));
                    return Promise.all(xhrs).then((projectTypes) => {
                        this.typesOther(projectTypes.map((p,i) => ({ project: projects[i], types: p.value})));
                        return this._markCompletedWits(wits);
                    });
                }

                // If there are not any other projects in the query we can display the items
                return this._markCompletedWits(wits);
            })
            .then((wits) => {
                // Get unique parent ids
                let parentIds = [...new Set(wits.map((w) => w.parentId).filter((p) => p))];
                if (!parentIds.length) {
                    return wits;
                }

                // Split request into chunks
                var xhrs = [];
                var i;
                var j;
                var chunk = 200;
                for (i = 0, j = parentIds.length; i < j; i += chunk) {
                    xhrs.push(client.getWorkItems(parentIds.slice(i, i + chunk), this.project.id, null, queryAsOf, "all"));
                }

                // Load parent and map ids to titles
                return Promise.all(xhrs)
                    .then((chunks) => Array.prototype.concat.apply([], chunks))
                    .then((parents) => {
                        let parentIdTitleMap = {};
                        parents.forEach((p) => parentIdTitleMap[p.id] = p.fields["System.Title"]);
                        wits.forEach((w) => w.parentTitle = parentIdTitleMap[w.parentId] || "");
                        return wits;
                    });
            })
            .then((wits) => {
                let icons = this.types().map((t) => t.icon.url);
                let other = this.typesOther() || [];
                if (other.length) {
                    other.forEach((o) => icons = icons.concat(o.types.map((t) => t.icon.url)));
                }
                icons = [...new Set(icons)];

                let xhr = icons.map((url) => iconService.fetch(url));
                Promise.all(xhr).then((response) => {
                    let tmp = {};
                    response.forEach((svg, index) => tmp[icons[index]] = svg);
                    this.icons(tmp);
                    this.wits(wits);
                });
            });
    };


    /**
     * Opens URL in the new window.
     * 
     * @param {string} url Url address.
     */
    Model.prototype.openNewWindow = function (url) {
        sdk.getService(api.CommonServiceIds.HostNavigationService)
            .then((service) => service.openNewWindow(url));
    };


    /**
     * Updates the work item.
     * 
     * @param {object} record The item being manipulated.
     */
    Model.prototype.updateWit = function (record) {
        const patch = [];

        // Start date
        const obj1 = {
            "op": record.start ? "replace" : "remove",
            "path": "/fields/Microsoft.VSTS.Scheduling.StartDate"
        };
        if (record.start) {
            obj1["value"] = record.start.toISOString();
        }

        // Target date
        const obj2 = {
            "op": record.end ? "replace" : "remove",
            "path": "/fields/Microsoft.VSTS.Scheduling.TargetDate"
        };
        if (record.end) {
            let end = new Date(record.end.getTime());
            end.setDate(end.getDate() - 1);
            obj2["value"] = end.toISOString();
        }

        // Milestone
        if (record.start && record.end && (record.start.getTime() === record.end.getTime())) {
            delete obj1["value"];
            obj1["op"] = "remove";
            obj2["value"] = record.end.toISOString();
        }

        // State
        const obj3 = {
            "op": "replace",
            "path": "/fields/System.State",
            "value": record.state
        };

        patch.push(obj1);
        patch.push(obj2);

        if (record.state) {
            patch.push(obj3);
        }

        const client = api.getClient(witApi.WorkItemTrackingRestClient);
        const id = record.id;

        return client
            .updateWorkItem(patch, id, false, false)
            .then(() => record)
            .catch((error) => {
                this.message(`Unable to update wor item #${id}.`);
                console.warn(`App : updateWit() : Unable to update wor item #${id}.`);
                console.warn(error);
                return null;
            });
    };


    /**
     * Reorders a work item in the current team's backlog.
     *
     * @param {object} move Drag and drop description.
     */
    Model.prototype.reorderWit = function (move) {
        const dragged = this.wits().find((wit) => (wit.id + "") === (move.draggedId + ""));
        const target = move.targetId === null || move.targetId === undefined
            ? null
            : this.wits().find((wit) => (wit.id + "") === (move.targetId + ""));
        const plan = backlogOrderService.planMove(this.backlogIndex(), dragged, target, move.position);

        if (!plan.valid) {
            this.message(plan.reason);
            return Promise.resolve(false);
        }

        this.isLoading(true);
        const client = api.getClient(workApi.WorkRestClient);
        return client.reorderBacklogWorkItems(plan.operation, this._getTeamContext())
            .then(() => this.refresh())
            .then(() => true)
            .catch((error) => {
                this.isLoading(false);
                this.message(`Unable to reorder work item #${plan.operation.ids[0]}.`);
                console.warn(`App : reorderWit() : Unable to reorder work item #${plan.operation.ids[0]}.`);
                console.warn(error);
                return false;
            });
    };


    /**
     * Downloads the timeline as an png image.
     */
    Model.prototype.downloadImage = function () {
        global.domtoimage
            .toBlob(doc.querySelector(".my-timeline"), { 
                filter: (node) => {
                    if (typeof(node.hasAttribute) !== "function") {
                        return true;
                    }
                    return !node.hasAttribute("data-noexport");
                },
                bgcolor: global.getComputedStyle(doc.body).getPropertyValue("--background-color")
            })
            .then((blob) => api.getClient(witApi.WorkItemTrackingRestClient).createAttachment(blob, this.project.id, `${this.query.name}_${(new Date()).toISOString().split(".").shift().replace(/(-|:)/gi,"")}.png`))
            .then((response) => sdk.getService(api.CommonServiceIds.HostNavigationService).then((service) => service.openNewWindow(response.url)))
            .catch(error => {
                this.message("Unable to download the Gantt chart as an image.");
                console.warn(`App : downloadImage() : Unable to download the Gantt chart as an image.`);
                console.warn(error);
            });
    };


    /**
     * Downloads the timeline.
     */
    Model.prototype.download = function () {
        ganttTemplate.fetch()
            .then((response) => response.ok ? response.arrayBuffer() : null)
            .then((blob) => xlsx.fromDataAsync(blob))
            .then((workbook) => {
                // Get the right sheet
                let sheet = workbook.sheet("GANTT");
                const wits = this.isBacklogOrder()
                    ? backlogOrderService.sortItems(this.wits(), this.backlogIndex())
                    : this.wits();

                // Set output data
                wits.forEach((wit, i) => {
                    sheet.cell(`B${i + 8}`).value(wit.id);
                    sheet.cell(`C${i + 8}`).value(wit.level);
                    sheet.cell(`D${i + 8}`).value(wit.type);
                    sheet.cell(`E${i + 8}`).value(wit.title);
                    sheet.cell(`G${i + 8}`).value(wit.assignedTo);
                    sheet.cell(`H${i + 8}`).value(wit.state);
                    sheet.cell(`I${i + 8}`).value(wit.tags.join(";"));
                    sheet.cell(`J${i + 8}`).value(wit.startDate || wit.targetDate);
                    sheet.cell(`K${i + 8}`).value(wit.targetDate);
                    sheet.cell(`M${i + 8}`).value(wit.effort);
                    sheet.cell(`N${i + 8}`).value(wit.remainingWork);
                    sheet.cell(`O${i + 8}`).value(wit.completedWork);
                    sheet.cell(`P${i + 8}`).value(wit.nodeName);
                });
                
                return workbook.outputAsync();
            })
            .then((blob) => api.getClient(witApi.WorkItemTrackingRestClient).createAttachment(blob, this.project.id, `${this.query.name}_${(new Date()).toISOString().split(".").shift().replace(/(-|:)/gi,"")}.xlsx`))
            .then((response) => sdk.getService(api.CommonServiceIds.HostNavigationService).then((service) => service.navigate(response.url)));
    };


    /**
     * Performs an action.
     * 
     * @param {string} name Name of the observable which holds the action.
     */
    Model.prototype.action = function (name) {
        const action = ko.isObservable(this[name]) && this[name]();
        if (typeof (action) !== "function") {
            console.warn(`App : action() : Action ${name} is not defined.`);
            return;
        }

        action();
    };


    /**
     * Expand all.
     */
    Model.prototype.expand = function () {
        this.action("_timeline_expandAction");
    };


    /**
     * Collapse all.
     */
    Model.prototype.collapse = function () {
        this.action("_timeline_collapseAction");
    };


    /**
     * Moves the timeline to the left.
     */
    Model.prototype.moveLeft = function () {
        this.action("_timeline_moveLeftAction");
    };


    /**
     * Moves the timeline to the left.
     */
    Model.prototype.moveRight = function () {
        this.action("_timeline_moveRightAction");
    };


    /**
     * Zooms out the timeline.
     */
    Model.prototype.zoomOut = function () {
        this.action("_timeline_zoomOutAction");
    };


    /**
     * Zooms in the timeline.
     */
    Model.prototype.zoomIn = function () {
        this.action("_timeline_zoomInAction");
    };


    /**
     * Resets the timeline's zoom.
     */
    Model.prototype.zoomReset = function () {
        this.action("_timeline_zoomResetAction");
    };


    /**
     * Updates the timeline record.
     * 
     * @param {number} id Record id. 
     * @param {object} data Data to update.
     */
    Model.prototype.updateRecord = function(id, data) {
        const action = this._timeline_updateAction();
        if (typeof (action) !== "function") {
            return;
        }

        action(id, data);
    };


    /**
     * Zooms the current timeline's selection.
     */
    Model.prototype.focus = function () {
        this.action("_timeline_focusAction");
        
        let wit = this.current();
        if (!wit) {
            return;
        }

        let target = doc.querySelector(`[data-id='${wit.id}']`);
        if (!target || !target.scrollIntoView) {
            return;
        }
        
        target.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
    };
    
    
    /**
     * Closes the selection.
     */
    Model.prototype.close = function () {
        this.action("_timeline_closeAction");
    };
    
    
    /**
     * Reloads the data.
     */
    Model.prototype.refresh = function () {
        this.isLoading(true);
        this.action("_timeline_refreshAction");
        this.current(null);
        this.currentId(null);
        this.wits([]);
        this.relations([]);
        this.witIds([]);
        this.sortColumns([]);
        this.types([]);

        return this.init().then(() => this.isLoading(false));
    };


    /**
     * Opens settings panel.
     */
    Model.prototype.openSettings = function () {
        const fields = this.fields();
        const fieldsValue = this.showFields();

        sdk.getService(api.CommonServiceIds.HostPageLayoutService).then((host) => {
            host.openPanel(`${sdk.getExtensionContext().id}.#{Extension.Id}#-configuration`, {
                title: "Gantt Configuration",
                lightDismiss: false,
                configuration: {
                    fields,
                    fieldsValue
                },
                onClose: (result = {}) => {
                    if (Array.isArray(result.fieldsValue)) {
                        this.showFields(result.fieldsValue);
                        this.settings.showFields = result.fieldsValue;
                    }
                }
            });
        });
    };


    /**
     * Edits the selected work item.
     */
    Model.prototype.edit = function () {
        let wit = this.current();

        if (!wit) {
            return;
        }

        this.openNewWindow(wit.url.replace('/_apis/wit/workItems/', '/_workitems/edit/'));
    };


    /**
     * Dispose.
     */
    Model.prototype.dispose = function () {
        console.log("~QueryGanttTabApp()");

        this.states.dispose();
        this.filteredPrimaryWits.dispose();
        this.filteredWits.dispose();
        this.orderedWits.dispose();
        this.isBacklogOrder.dispose();
        this.backlogOrderTitle.dispose();
        this.updateQueryString.dispose();
        this.getAssigneesFilter.dispose();
        this.getStatesFilter.dispose();
        this.getTagsFilter.dispose();
        this.getAreasFilter.dispose();
        this.getParentsFilter.dispose();
        this.showDetail.dispose();
        this.isTotalEffortVisible.dispose();
        this.isTotalRemainingWorkVisible.dispose();
        this.isTotalCompletedWorkVisible.dispose();
        this._orderModeSubscribe.dispose();
    };

    //#endregion


    //#region [ Methods : Private ]

    /**
     * Returns params for fetch calls.
     */
    Model.prototype._getFetchParams = function () {
        return {
            method: "GET",
            headers: {
                "Authorization": "Bearer " + this.token
            }
        };
    };


    /**
     * Returns the current Azure DevOps team context in the format expected by the Work API.
     */
    Model.prototype._getTeamContext = function () {
        return {
            projectId: this.project.id,
            teamId: this.team && this.team.id
        };
    };


    /**
     * Loads all visible backlog levels for the current team.
     *
     * @param {string} asOf Historical query date, if any.
     */
    Model.prototype._loadBacklogOrder = function (asOf) {
        const requestId = ++this._backlogRequestId;
        const emptyIndex = backlogOrderService.empty();
        this.backlogAvailable(false);
        this.backlogIndex(emptyIndex);

        if (asOf !== null || !this.team || !this.team.id) {
            this.backlogLoading(false);
            return Promise.resolve(emptyIndex);
        }

        this.backlogLoading(true);
        const client = api.getClient(workApi.WorkRestClient);
        return Promise.all([
                client.getBacklogs(this._getTeamContext()),
                client.getBacklogConfigurations(this._getTeamContext()).catch(() => null)
            ])
            .then((response) => ({
                backlogs: (response[0] || []).filter((backlog) => !backlog.isHidden),
                configuration: response[1]
            }))
            .then(({ backlogs, configuration }) => Promise.all([
                backlogs,
                Promise.all(backlogs.map((backlog) => client.getBacklogLevelWorkItems(this._getTeamContext(), backlog.id))),
                (((configuration || {}).backlogFields || {}).typeFields || {}).Order || null
            ]))
            .then((response) => {
                const index = backlogOrderService.createIndex(response[0], response[1], response[2]);
                if (requestId !== this._backlogRequestId) {
                    return emptyIndex;
                }
                this.backlogIndex(index);
                this.backlogAvailable(Object.keys(index.levels).length > 0);
                this.backlogLoading(false);
                return index;
            })
            .catch((error) => {
                if (requestId !== this._backlogRequestId) {
                    return emptyIndex;
                }
                this.backlogLoading(false);
                if (this.orderMode() === backlogOrderService.backlogOrder) {
                    this.message("Backlog order is unavailable for the current team.");
                }
                console.warn("App : _loadBacklogOrder() : Unable to load backlog order.");
                console.warn(error);
                return emptyIndex;
            });
    };


    /**
     * Gets states for the legend.
     */
    Model.prototype._getStates = function () {
        var types = this.types();
        var typesOther = this.typesOther();
        
        if(!types.length) {
            return [];
        }
        
        let states = [];
        typesOther.reduce((a, b) => b.types.concat(a), types).forEach((t) => {
            if (!states.length) {
                states = JSON.parse(JSON.stringify(t.states));
                return;
            }

            t.states.forEach((s) => {
                let state = states.find((x) => x.color === s.color);

                if (!state) {
                    states.push(JSON.parse(JSON.stringify(s)));
                    return;
                }

                state.name = [...new Set(state.name.split(", ").concat([s.name]))].join(", ");
            });
        });

        return states;
    };


    /**
     * Gets list of assignees.
     */
    Model.prototype._getAssigneesFilter = function () {
        const wits = this.wits();

        if (!wits.length) {
            this.assigneesFilter([]);
            return;
        }
        
        this.assigneesFilter([...new Set(wits.filter((w) => (w.assignedTo || "").length).map((w) => w.assignedTo))].sort());
    };


    /**
     * Gets list of states.
     */
    Model.prototype._getStatesFilter = function () {
        const wits = this.wits();

        if (!wits.length) {
            this.statesFilter([]);
            return;
        }
        
        this.statesFilter([...new Set(wits.map((w) => w.state))].sort());
    };


    /**
     * Gets list of tags.
     */
    Model.prototype._getTagsFilter = function () {
        const wits = this.wits();

        if (!wits.length) {
            this.tagsFilter([]);
            return;
        }
        
        this.tagsFilter([...new Set(wits.map((w) => w.tags.filter((t) => t.length)).filter((a) => a.length).flat(1))].sort());
    };


    /**
     * Gets list of areas.
     */
    Model.prototype._getAreasFilter = function () {
        const wits = this.wits();

        if (!wits.length) {
            this.areasFilter([]);
            return;
        }
        
        this.areasFilter([...new Set(wits.map((w) => w.nodeName))].sort());
    };


    /**
     * Gets list of parents.
     */
    Model.prototype._getParentsFilter = function () {
        const wits = this.wits();

        if (!wits.length) {
            this.parentsFilter([]);
            return;
        }
        
        this.parentsFilter([...new Set(wits.map((w) => w.parentTitle))].sort());
    };


    /**
     * Shows detail of the currently selected work item.
     */
    Model.prototype._showDetail = function() {
        const current = this.current();
        const currentId = this.currentId();
        const types = this.types();
        const typesOther = this.typesOther();

        if (ko.computedContext.isInitial() || !current || !currentId) {
            return;
        }

        sdk.getService(api.CommonServiceIds.HostPageLayoutService).then((host) => {
            host.openPanel(`${sdk.getExtensionContext().id}.#{Extension.Id}#-detail`, {
                title: `#${current.id}: ${current.title}`,
                lightDismiss: false,
                configuration: {
                    item: current,
                    id: currentId,
                    updateWitCallback: this.updateWit.bind(this),
                    updateRecordCallback: this.updateRecord.bind(this),
                    types,
                    typesOther
                },
                onClose: (result = {}) => {
                    this.currentId(null);
                }
            });
        });
    };


    /**
     * Formats the input asOf date.
     * 
     * @param {date} d Date to be formatted. 
     * @returns Date as string in the ISO 8601 format.
     */
    Model.prototype._formatAsOf = function(d) {
        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const year = d.getFullYear();

        return `${year}-${month}-${day}T00:00:00.0000000`;
    };


    /**
     * Gets the work items filtered by the primary filter, which triggers the query api.
     */
    Model.prototype._getFilteredPrimaryWits = function() {
        const filter = this.filterPrimary();

        // The model is initialized explicitly after bindings are applied. Avoid
        // starting the same Query and Backlog requests during the computed's
        // eager first evaluation.
        if (ko.computedContext.isInitial()) {
            return;
        }
        
        if (Array.isArray(filter.asOf) && (filter.asOf.length === 1) && (filter.asOf[0] instanceof Date)) {
            this.isLoading(true);
            this.init(`${this._formatAsOf(filter.asOf[0])}`).then(() => this.isLoading(false));
            return;
        }

        this.isLoading(true);
        this.init().then(() => this.isLoading(false));
    };

    
    /**
     * Gets the work items filtered by the quick filter.
     */
    Model.prototype._getFilteredWits = function () {
        const wits = this.wits();
        const filter = this.filter();
        
        let items = wits;

        if (filter.keywords) {
            const id = Number(filter.keywords);
            if (Number.isInteger(id) && (filter.keywords !== "")) {
                items = items.filter((i) => i.id === id);
            }
            else {
                items = items.filter((i) => i.title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().includes(filter.keywords));
            }
        }

        if (Array.isArray(filter.assignees) && filter.assignees.length) {
            items = items.filter((i) => i.assignedTo && filter.assignees.includes(i.assignedTo));
        }

        if (Array.isArray(filter.states) && filter.states.length) {
            items = items.filter((i) => filter.states.includes(i.state));
        }

        if (Array.isArray(filter.tags) && filter.tags.length) {
            items = items.filter((i) => {
                const tags = i.tags.filter((a) => a.length);
                if (!tags.length) {
                    return false;
                }

                return tags.some((t) => filter.tags.includes(t));
            });
        }

        if (Array.isArray(filter.areas) && filter.areas.length) {
            items = items.filter((i) => filter.areas.includes(i.nodeName));
        }

        if (Array.isArray(filter.parents) && filter.parents.length) {
            items = items.filter((i) => filter.parents.includes(i.parentTitle));
        }

        if (Array.isArray(filter.priorities) && filter.priorities.length) {
            items = items.filter((i) => filter.priorities.includes(i.priority));
        }

        if (filter.period) {
            if (filter.period.from) {
                items = items.filter((i) => (i.startDate instanceof Date) && i.startDate.getTime() >= filter.period.from.getTime());
            }
            if (filter.period.to) {
                const endOfDay = new Date(filter.period.to);
                endOfDay.setHours(23, 59, 59, 999);

                items = items.filter((i) => (i.targetDate instanceof Date) && i.targetDate.getTime() <= endOfDay);
            }
        }
        
        this.zero((wits.length && !items.length) || !wits.length ? { title: "No results match the query", text: "Please change the filtering criteria." } : null);

        return items;
    };


    /**
     * Gets the filtered work items in the selected display order.
     */
    Model.prototype._getOrderedWits = function () {
        const items = this.filteredWits();
        if (!this.isBacklogOrder()) {
            return items;
        }

        return backlogOrderService.sortItems(items, this.backlogIndex());
    };


    /**
     * Gets a tooltip describing backlog-order availability and drag support.
     */
    Model.prototype._getBacklogOrderTitle = function () {
        if (this.backlogLoading()) {
            return "Loading the current team's backlog order.";
        }
        if (this.isHistorical()) {
            return "Backlog order is unavailable for historical query results.";
        }
        if (!this.team || !this.team.id) {
            return "Backlog order requires an Azure DevOps team context.";
        }
        if (!this.backlogAvailable()) {
            return "No backlog order is available for the current team.";
        }

        const items = this.wits();
        const eligible = items.filter((wit) => wit.backlogOrder && wit.backlogOrder.eligible).length;
        return `${this.team.name} backlog order. ${eligible} of ${items.length} query items can be dragged.`;
    };
    

    /**
     * Gets the path of the work item.
     * 
     * @param {array} relations Array of relations between work items.
     * @param {number} id Id of the current work item. 
     */
    Model.prototype._getPaths = function (relations, id) {
        var itm = relations.filter((rel) => rel.target.id === id);

        if (!itm.length || ((itm.length === 1) && !itm[0].source)) {
            return [id + ""];
        }

        return itm.filter((i) => i.source).map((i) => this._getPaths(relations, i.source.id).map((p) => p + "/" + id));
    };
    

    /**
     * Updates query string to the actual values.
     */
    Model.prototype._updateQueryString = function() {
        const showFields = this.showFields();
        
        if (ko.computedContext.isInitial()) {
            return;
        }

        sdk.getService(api.CommonServiceIds.HostNavigationService)
            .then((host) => Promise.all([
                host, 
                host.getQueryParams()
            ]))
            .then((response) => ({ 
                host: response[0], 
                state: response[1]
            }))
            .then(({ host, state }) => {
                state.showFields = showFields.join(",");
                host.setQueryParams(state);
            });
    };


    /**
     * Persists the selected display order in the existing per-user/project settings.
     *
     * @param {string} value Selected order mode.
     */
    Model.prototype._saveOrderMode = function(value) {
        if (!this.manager || !this.settingsKey) {
            return Promise.resolve(false);
        }

        this._settingsSavePromise = this._settingsSavePromise
            .catch(() => false)
            .then(() => this.manager.getValue(this.settingsKey, { scopeType: "User" }))
            .then((stored) => {
                let settings = this.settings;
                try {
                    if (stored) {
                        const parsed = JSON.parse(stored);
                        settings = parsed && (typeof(parsed) === "object") && !Array.isArray(parsed) ? parsed : {};
                    }
                }
                catch (error) {
                }
                settings.orderMode = value;
                this.settings = settings;
                return this.manager.setValue(this.settingsKey, JSON.stringify(settings), { scopeType: "User" });
            })
            .then(() => true)
            .catch((error) => {
                console.warn("App : _saveOrderMode() : Unable to save display order.");
                console.warn(error);
                return false;
            });

        return this._settingsSavePromise;
    };


    /**
     * Traverses the work items and marks the commpleted ones.
     *  
     * @param {array} wits List of work items. 
     */
    Model.prototype._markCompletedWits = function(wits) {
        var types = this.types();
        var typesOther = this.typesOther();
        
        // Mark completed work items
        wits.forEach((w) => {
            var type = ((typesOther.find((t) => t.project === w.project) || {}).types || types).find((t) => t.name === w.type);
            if (!type) {
                throw new Error("QueryGanttTabApp : Unable to find work item's type.");
            }

            var state = type.states.find((s) => s.name === w.state);
            if (!state) {
                console.warn(`QueryGanttTabApp : _markCompletedWits() : Unable to find work item's state '${w.state}' for work item  #${w.id}.`);
                return;
            }

            w.isCompleted = state.category === "Completed";
        });

        // Get count of completed work items
        wits.forEach((w) => {
            let children = wits.filter((x) => x.parent === w.path);
            w.childCount = children.length;
            w.childCompletedCount = children.filter((x) => x.isCompleted).length;
        });

        return wits;
    };

    //#endregion


    //#region [ Methods ]

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
            .then(() => Promise.all([
                sdk.getService(api.CommonServiceIds.ProjectPageService),
                sdk.getService(api.CommonServiceIds.HostNavigationService),
                dataService.getManager()
            ]))
            .then((response) => ({ project: response[0], host: response[1], manager: response[2] }))
            .then(({ project, host, manager }) => Promise.all([
                project.getProject(),
                host.getQueryParams(),
                project.getProject().then((p) => manager.getValue(`gantt_${p.id}`, { scopeType: "User" })),
                manager
            ]))
            .then((response) => ({ project: response[0], state: response[1], settings: response[2], manager: response[3] }))
            .then(({ project, state, settings, manager }) => {
                let showFields = null;
                let orderMode = backlogOrderService.queryOrder;
                let parsedSettings = {};
                let team = null;

                try {
                    team = sdk.getTeamContext();
                }
                catch (error) {
                }
                
                // Read some initial data from settings first
                if (settings) {
                    try {
                        const value = JSON.parse(settings);
                        parsedSettings = value && (typeof(value) === "object") && !Array.isArray(value) ? value : {};
                        if (parsedSettings.showFields) {
                            showFields = parsedSettings.showFields;
                        }
                        if (parsedSettings.orderMode === backlogOrderService.backlogOrder) {
                            orderMode = backlogOrderService.backlogOrder;
                        }
                    } 
                    catch (error) {
                        parsedSettings = {};
                    }
                }

                // Read some initial data from query string
                if (!Array.isArray(showFields) && state["showFields"]) {
                    showFields = state["showFields"].split(",").filter((f) => f.length > 0);
                }

                // Create application model
                const model = new Model({
                    version: cnf.version,
                    priorities: cnf.priorities,
                    fields: cnf.fields,
                    user: sdk.getUser().displayName,
                    project: project,
                    team,
                    query: sdk.getConfiguration().query,
                    showFields,
                    orderMode,
                    manager,
                    settings: parsedSettings,
                    settingsKey: `gantt_${project.id}`
                });
                console.debug("QueryGanttTabApp : ready() : %o", model);
                
                // Register tab
                sdk.register("#{Extension.Id}#-tab", () => model);

                // Start application and init application
                ko.applyBindings(model, doc.body);
                sdk.notifyLoadSucceeded();
                model.init().then(() => {
                    model.isLoading(false);
                    console.debug("QueryGanttTabApp is running.");
                });
        });
    });

    //#endregion
});
