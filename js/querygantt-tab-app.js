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
    "my/components/count",
    "my/components/legend",
    "my/components/header",
    "my/components/workitem",
    "my/components/timeline",
    "my/templates/gantt",
    "text!img/icon_list.txt"
], function (module, require, polyfills, ko, bindings, sdk, xlsx, domtoimage, api, witApi, Count, Legend, Header, WorkItem, Timeline, ganttTemplate, icon_list) {
    //#region [ Fields ]

    var global = (function () { return this; })();
    var doc = global.document;
    var cnf = module.config();

    //#endregion


    //#region [ Constructors ]
    
    /**
     * Constructor.
     * 
     * @param {object} args Arguments.
     */
    var Model = function (args) {
        console.debug("QueryGanttTabApp()");

        this.version = args.version;
        this.user = args.user;
        this.project = args.project;
        this.query = args.query;

        this.token = null;
        this.path = null;

        this.showFields = ko.observableArray(["duration"]).extend({ rateLimit: { timeout: 1000, method: "notifyWhenChangesStop" } });
        this.shareLink = ko.observable("");

        this.isLoading = ko.observable(true);
        this.types = ko.observableArray([]);
        this.typesOther = ko.observableArray([]);
        this.icons = ko.observable({});
        this.sortColumns = ko.observableArray([]);
        this.witIds = ko.observableArray([]);
        this.relations = ko.observableArray([]);
        this.wits = ko.observableArray([]);
        this.current = ko.observable(null);
        
        this.states = ko.computed(this._getStates, this);
        this.priorities = ko.observableArray(args.priorities);
        this.fields = ko.observableArray(args.fields);
        this.title = ko.computed(this._getTitle, this);
        this.filter = ko.observable("").extend({ rateLimit: { timeout: 500, method: "notifyWhenChangesStop" } });
        this.filteredWits = ko.computed(this._getFilteredWits, this);

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

        // Subscribes
        this._onSettingsChangedSubscribe = ko.computed(this._onSettingsChanged, this).extend({ deferred: true });
    };

    //#endregion


    //#region [ Methods : Public ]

    /**
     * Initialize the application.
     */
    Model.prototype.init = function () {
        var client = api.getClient(witApi.WorkItemTrackingRestClient);
        
        return client._options.rootPath.then((path) => {
                this.path = path;
                return sdk.getService(api.CommonServiceIds.HostNavigationService);
            })
            .then((service) => service.getQueryParams())
            .then((state) => {
                if (state["showFields"]) {
                    this.showFields(state["showFields"].split(","));
                }

                if(state["filter"]) {
                    this.filter(state["filter"]);
                }

                return sdk.getAccessToken();
            })
            .then((token) => {
                this.token = token;
                return fetch(this.path + this.project.name + "/_apis/wit/workItemTypes", this._getFetchParams())
                    .then((response) => response.ok ? response.json() : null);
            })
            .then((types) => {
                this.types(types.value);

                if (this.query.id !== "00000000-0000-0000-0000-000000000000") {
                    return client.queryById(this.query.id, this.project.id);
                }

                return client.queryByWiql({ query: this.query.wiql }, this.project.id);
            })
            .then((data) => {
                this.sortColumns(data.sortColumns || []);
                this.queryType(data.queryType === 1 ? "flat" : data.queryType === 2 ? "tree" : "onehop");

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
                    return;
                }

                // Split request into chunks
                var xhrs = [];
                var i;
                var j;
                var chunk = 200;
                for (i = 0, j = ids.length; i < j; i += chunk) {
                    xhrs.push(client.getWorkItems(ids.slice(i, i + chunk), this.project.id, null, null, "all"));
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
                        completedWork: (wit.fields["Microsoft.VSTS.Scheduling.CompletedWork"] || 0).toFixed(2),
                        remainingWork: (wit.fields["Microsoft.VSTS.Scheduling.RemainingWork"] || 0).toFixed(2),
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
                    xhrs.push(client.getWorkItems(parentIds.slice(i, i + chunk), this.project.id, null, null, "all"));
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
                let xhr = icons.map((url) => fetch(url, this._getFetchParams()).then((response) => response.ok ? response.text() : null).catch((error) => icon_list));
                Promise.all(xhr).then((response) => {
                    let tmp = {};
                    response.forEach((svg, index) => {
                        let node = (new DOMParser().parseFromString(svg, "text/html")).body.firstChild;
                        node.classList.add("my-timeline-group__icon");
                        tmp[icons[index]] = node.outerHTML; 
                    });
                    this.icons(tmp);

                    this.wits(wits);
                    // Force to update share link
                    this._onSettingsChanged();
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

        patch.push(obj1);
        patch.push(obj2);

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

                // Set output data
                this.wits().forEach((wit, i) => {
                    sheet.cell(`B${i + 8}`).value(wit.id);
                    sheet.cell(`C${i + 8}`).value(wit.level);
                    sheet.cell(`D${i + 8}`).value(wit.type);
                    sheet.cell(`E${i + 8}`).value(wit.title);
                    sheet.cell(`G${i + 8}`).value(wit.assignedTo);
                    sheet.cell(`H${i + 8}`).value(wit.state);
                    sheet.cell(`I${i + 8}`).value(wit.tags.join(";"));
                    sheet.cell(`J${i + 8}`).value(wit.startDate || wit.targetDate);
                    sheet.cell(`K${i + 8}`).value(wit.targetDate);
                });
                
                return workbook.outputAsync();
            })
            .then((blob) => api.getClient(witApi.WorkItemTrackingRestClient).createAttachment(blob, this.project.id, `${this.query.name}_${(new Date()).toISOString().split(".").shift().replace(/(-|:)/gi,"")}.xlsx`))
            .then((response) => sdk.getService(api.CommonServiceIds.HostNavigationService).then((service) => service.navigate(response.url)));
        /*
        var extension = sdk.getExtensionContext();
        var baseUri = (function() {return this;})().location.href.split("/_apis/")[0];
        var uri = [ baseUri, "/_apis/public/gallery/publisher/", extension.publisherId, "/extension/", extension.extensionId, "/", this.version, "/assetbyname/xlsx/gantt.xlsx" ].join("");
        */
    };


    // /**
    //  * Shares the Gantt chart.
    //  */
    // Model.prototype.share = function () {
    //     this._onSettingsChanged()
    //         .then(() => sdk.getService(api.CommonServiceIds.HostNavigationService))
    //         .then((service) => Promise.all([service.getPageRoute(), service.getQueryParams()]))
    //         .then((response) => {
    //             var extension = sdk.getExtensionContext();
    //             var query = response[1];
    //             var uri = this.path + this.project.name + "/_queries/" + extension.id + "." + extension.extensionId + "-tab" + "/" + this.query.id + "/?" + new URLSearchParams(query).toString();

    //             var link = doc.createElement("a");
    //             link.style.opacity = "0";
    //             doc.body.append(link);
    //             link.href = "mailto:?subject=" 
    //                 + encodeURIComponent("ddd") 
    //                 + "&body="
    //                 + encodeURIComponent(uri)
    //                 + "\n";
    //             link.click();
    //             link.remove();
    //         });
    // };


    /**
     * Performs an action.
     * 
     * @param {string} name Name of the observable which holds the action.
     */
    Model.prototype.action = function (name) {
        var action = ko.isObservable(this[name]) && this[name]();
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
        this.wits([]);
        this.relations([]);
        this.witIds([]);
        this.sortColumns([]);
        this.types([]);

        this.init().then(() => this.isLoading(false));
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
        this.title.dispose();
        this.filteredWits.dispose();
        this._onSettingsChangedSubscribe.dispose();
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
     * Gets title for the current item.
     */
    Model.prototype._getTitle = function () {
        var current = this.current();
        
        if(!current) {
            return "";
        }

        return current.title;
    };


    /**
     * Gets the work items filtered by the quick filter.
     */
    Model.prototype._getFilteredWits = function () {
        //var filter = (this.filter() || "").toLowerCase().toAccentInsensitive();
        var filter = this.filter() || "";
        var wits = this.wits();
        
        if (!filter.length) {
            return wits;
        }

        let query = filter.parseFilter();
        let predicates = query.map((q) => {
            // Joining operators
            if (q.operator) {
                return q.operator === "OR" ? " || " :
                       q.operator === "AND" ? " && " : " && ";
            }

            // For basic match we search within the title attribute
            if ("match" === q.key) {
                return q.accept ? `(wit.title.toLowerCase().toAccentInsensitive().indexOf("${q.accept.toLowerCase().toAccentInsensitive()}") !== -1)` : 
                                  `(wit.title.toLowerCase().toAccentInsensitive().indexOf("${q.reject.toLowerCase().toAccentInsensitive()}") === -1)`;
            }
            // Search only by the title
            if ("title" === q.key) {
                return `(wit.title.toLowerCase().toAccentInsensitive().indexOf("${q.value.toLowerCase().toAccentInsensitive()}") !== -1)`;
            }
            // Search by tags
            if ("tag" === q.key) {
                return `((wit.tags || []).map((t) => t.toLowerCase().toAccentInsensitive()).includes("${q.value.toLowerCase().toAccentInsensitive()}"))`;
            }
            // Search by state
            if ("state" === q.key) {
                return `(wit.state.toLowerCase().toAccentInsensitive().replace(/\\s/g,'') === "${q.value.toLowerCase().toAccentInsensitive()}".replace(/\\s/g,''))`;
            }
            // Search by priority
            if ("priority" === q.key) {
                return `(wit.priority == ${q.value})`;
            }
            // Search by assigned to
            if ("assignedto" === q.key) {
                return `(wit.assignedTo.toLowerCase().toAccentInsensitive().replace(/\\s/g,'').indexOf("${q.value.toLowerCase().toAccentInsensitive()}".replace(/\\s/g,'')) !== -1)`;
            }
            // Search by target date
            if ("targetdate" === q.key) {
                return `(wit.targetDate && wit.targetDate.toISOString().split("T")[0] <= "${q.value === '@today' ? (new Date()).toISOString().split("T")[0] : q.value}")`;
            }
            // Search by start date
            if ("startdate" === q.key) {
                return `(wit.startDate && wit.startDate.toISOString().split("T")[0] >= "${q.value === '@today' ? (new Date()).toISOString().split("T")[0] : q.value}")`;
            }
            // Search only by the parent
            if ("parent" === q.key) {
                return `(wit.parentTitle.toLowerCase().toAccentInsensitive().indexOf("${q.value.toLowerCase().toAccentInsensitive()}") !== -1)`;
            }
            // Search only by the node name
            if ("nodename" === q.key) {
                return `(wit.nodeName.toLowerCase().toAccentInsensitive().indexOf("${q.value.toLowerCase().toAccentInsensitive()}") !== -1)`;
            }
        });

        // Remove the last logical operator
        if ((predicates[predicates.length - 1] === " && ") || (predicates[predicates.length - 1] === " || ")) {
            predicates.pop();
        }

        // Create funcion
        let lambda = Function("wit", "return " + predicates.join("") + ";");

        try {
            return wits.filter((w) => lambda(w));
        } 
        catch (err) {
            console.warn(`App : _getFilteredWits() : Invalid filter has been entered.`);
            console.warn(err);
            return [];
        }
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
     * Handles the change of settings and save them into the url.
     **/
    Model.prototype._onSettingsChanged = function () {
        var showFields = this.showFields();
        var filter = this.filter();

        // Create share link
        sdk.getService(api.CommonServiceIds.HostNavigationService)
            .then((service) => service.getQueryParams())
            .then((state) => {
                state.showFields = showFields.join(",");
                state.filter = filter;

                var extension = sdk.getExtensionContext();
                var uri = this.path + this.project.name + "/_queries/" + extension.id + "." + extension.extensionId + "-tab" + "/" + this.query.id + "/?" + new URLSearchParams(state).toString();

                this.shareLink("mailto:?subject=" 
                    + encodeURIComponent(this.query.name) 
                    + "&body="
                    + encodeURIComponent(uri)
                    + "\n");
            });

        if (ko.computedContext.isInitial()) {
            return;
        }
     
        return sdk.getService(api.CommonServiceIds.HostNavigationService)
            .then((service) => {
                return service.getQueryParams()
                    .then((state) => {
                        state.showFields = showFields.join(",");
                        state.filter = filter;
                        service.setQueryParams(state);
                    });
            });
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
                throw new Error("QueryGanttTabApp : Unable to find work item's state.");
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
            .then(() => sdk.getService(api.CommonServiceIds.ProjectPageService))
            .then((service) => service.getProject())
            .then((project) => {
                // Create application model
                var model = new Model({
                    version: cnf.version,
                    priorities: cnf.priorities,
                    fields: cnf.fields,
                    user: sdk.getUser().displayName,
                    project: project,
                    query: sdk.getConfiguration().query
                });
                console.debug(model);
                
                // Register tab
                sdk.register("#{Extension.Id}#-tab", function () {                
                    return model;
                });

                // Start application and init application
                ko.applyBindings(model, doc.body);
                sdk.notifyLoadSucceeded();
                model.init().then(() => model.isLoading(false));
        });
    });

    //#endregion
});

/**
 * Custom Section
 * 
 * "type": "ms.vss-releaseManagement-web.release-summary-section",
 * "targets": [
 *     "ms.vss-releaseManagement-web.release-details-summary-tab"
 * ],
 */