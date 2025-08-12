define([
    "knockout",
    "vis-timeline",
    "vis-timeline-arrow"
], function (ko, VisTimeline) {
    //#region [ Fields ]
    
    let global = (function() { return this; })();

    //#endregion


    //#region [ Constructors ]
    
    /**
     * Constructor.
     * 
     * @param {object} args Arguments.
     */
    let Timeline = function (args = {}) {
        console.debug("Timeline()");

        this.node = args.element.firstChild;
        this.items = ko.isObservable(args.items) ? args.items : ko.observable(args.items || []);
        this.states = ko.isObservable(args.states) ? args.states : ko.observable(args.states || []);
        this.priorities = ko.isObservable(args.priorities) ? args.priorities : ko.observable(args.priorities || []);
        this.types = ko.isObservable(args.types) ? args.types : ko.observable(args.types || []);
        this.typesOther = ko.isObservable(args.typesOther) ? args.typesOther : ko.observable(args.typesOther || []);
        this.icons = ko.isObservable(args.icons) ? args.icons : ko.observable(args.icons || []);
        this.showFields = ko.isObservableArray(args.showFields) ? args.showFields : ko.observableArray(args.showFields || []);
        this.selectedItem = ko.isObservable(args.selectedItem) ? args.selectedItem : ko.observable(args.selectedItem || null);
        this.selectedItemId = ko.isObservable(args.selectedItemId) ? args.selectedItemId : ko.observable(args.selectedItemId || null);

        this.selectedId = ko.observable(null);
        
        this.timeline = null;
        this.groups = null;
        this.records = null;
        this.arrows = null;

        // Callbacks
        this.callbacks = args.callbacks;

        // Actions
        Object.entries(args.actions || {}).forEach(([name, action]) => typeof (action) === "function" && action(this[name].bind(this)));

        // Subscribes
        this._onItemsChangedSubscribe = ko.computed(this._onItemsChanged, this).extend({ deferred: true });
        this._onSelectedIdChangedSubscribe = ko.computed(this._onSelectedIdChanged, this);
    };

    //#endregion


    //#region [ Methods : Public ]

    /**
     * Direct method to receive a descendantsComplete notification.
     * Knockout will call it with the component’s node once all descendants are bound.
     * 
     * @param {element} node Html element. 
     */
    Timeline.prototype.koDescendantsComplete = function (node) {
        // Replace custom element placehoder
        let root = node.firstElementChild;
        node.replaceWith(root);
    };


    /**
     * Expand all.
     */
    Timeline.prototype.expand = function () {
        if (!this.timeline || !this.groups) {
            return;
        }

        this.groups.forEach((g) => {
            this.groups.update({
                id: g.id,
                visible: true,
                showNested: true
            });
        });
    };


    /**
     * Collapse all.
     */
    Timeline.prototype.collapse = function () {
        if (!this.timeline || !this.groups) {
            return;
        }

        this.groups.forEach((g) => {
            // Hide groups with nested groups
            if (g.nestedGroups instanceof Array) {
                this.groups.update({
                    id: g.id,
                    showNested: false
                });
            }

            // Hide nested groups
            if (g.treeLevel > 1) {
                this.groups.update({
                    id: g.id,
                    visible: false
                });
            }
        });
    };


    /**
     * Moves the timeline by the given percentage to left or right.
     * 
     * @param {number} percentage For example 0.1 (left) or -0.1 (right).
     */
    Timeline.prototype.move = function (percentage) {
        if (!this.timeline) {
            return;
        }

        var range = this.timeline.getWindow();
        var interval = range.end - range.start;

        this.timeline.setWindow({
            start: range.start.valueOf() - interval * percentage,
            end: range.end.valueOf() - interval * percentage
        });
    };


    /**
     * Move left.
     */
    Timeline.prototype.moveLeft = function () {
        if (this.timeline) {
            this.move(0.2);
        }
    };


    /**
     * Move right.
     */
    Timeline.prototype.moveRight = function () {
        if (this.timeline) {
            this.move(-0.2);
        }
    };


    /**
     * Zooms out.
     */
    Timeline.prototype.zoomOut = function () {
        if (this.timeline) {
            this.timeline.zoomOut(0.2);
        }
    };


    /**
     * Zooms int.
     */
    Timeline.prototype.zoomIn = function () {
        if (this.timeline) {
            this.timeline.zoomIn(0.2);
        }
    };


    /**
     * Resets zoom.
     */
    Timeline.prototype.zoomReset = function () {
        if (this.timeline) {
            this.timeline.fit();
        }
    };


    /**
     * Zooms the current timeline's selection.
     */
    Timeline.prototype.focus = function () {
        if (this.timeline) {
            this.timeline.focus(this.timeline.getSelection());
        }
    };


    /**
     * Closes the selection.
     */
    Timeline.prototype.close = function () {
        this._onSelect({
            items: []
        });
        
        if (this.timeline) {
            this.timeline.setSelection([]);
        }
    };


    /**
     * Reloads the data.
     */
    Timeline.prototype.refresh = function () {
        this.selectedId(null);
        this._destroyTimeline();
    };


    /**
     * Updates the timeline record.
     * 
     * @param {number} id Record id. 
     * @param {object} data Data to update.
     */
    Timeline.prototype.update = function(id, data) {
        const item = this.timeline.itemSet.items[id];

        if (!item || !data) {
            return;
        }
        
        const d = item.data;
        Object.entries(data).forEach(([key, value]) => d[key] = value);
        this.timeline.itemsData.update(d);
    };


    /**
     * Executes the callback.
     * 
     * @param {string} name The name of the callback.
     * @param {array} args Callback arguemnts.
     */
    Timeline.prototype.callback = function (name, ...args) {
        if (!this.callbacks) {
            return;
        }

        if (typeof (this.callbacks[name]) !== "function") {
            console.warn("Timeline : callback(): Callback '%s' is not defined.", name);
            return;
        }

        return this.callbacks[name](...args);
    };


    /**
     * Dispose.
     */
    Timeline.prototype.dispose = function () {
        console.log("~Timeline()");

        this._onItemsChangedSubscribe.dispose();
        this._onSelectedIdChangedSubscribe.dispose();
    };

    //#endregion


    //#region [ Methods : Private ]

    /**
     * Create styles for the input types.
     * 
     * @param {array} types List of supported project types.
     * @param {array} typesOther List of supported types for other projects in the query.
     */
    Timeline.prototype._createStyles = function(types, typesOther) {
        // Remove any custom styles
        global.document.head
            .querySelectorAll("style[data-mytimeline-styles='true']")
            .forEach((el) => (el.parentNode !== null) && el.parentNode.removeChild(el));

        if (!types.length) {
            return;
        }

        // Create styles
        var el = global.document.createElement("style");
        el.setAttribute("data-mytimeline-styles", "true");
        el.innerHTML = types.map((t) => 
            `.my-timeline-item--${t.name.toLowerCase().replace(/\s+/g,"-")} { 
                background-color: #${t.color};
                color: #${textColorForBackground(t.color)};
             }
             
             .my-timeline-item--${t.name.toLowerCase().replace(/\s+/g,"-")}.vis-selected {
                background: #${darkenColor(t.color, 55)};
             }`).join("\n\n");

        if(typesOther.length) {
            el.innerHTML += "\n\n";
            el.innerHTML += typesOther.map((to) => to.types.map((t) => 
                `.my-timeline-item--${to.project.toLowerCase().replace(/\s+/g,"")}-${t.name.toLowerCase().replace(/\s+/g,"-")} { 
                   background-color: #${t.color};
                   color: #${textColorForBackground(t.color)};
                 }
                    
                 .my-timeline-item--${to.project.toLowerCase().replace(/\s+/g,"")}-${t.name.toLowerCase().replace(/\s+/g,"-")}.vis-selected {
                    background: #${darkenColor(t.color, 55)};
                 }`).join("\n\n")).join("\n\n");
        }
        global.document.head.appendChild(el);
    };

    
    /**
     * Destroys timeline if it exists.
     */
    Timeline.prototype._destroyTimeline = function () {
        if (!this.timeline) {
            return;
        }

        this.timeline.destroy();
        this.timeline = null;
        this.groups = null;
        this.records = null;
    };


    /**
     * Handles the group title click event.
     * 
     * @param {object} e Event arguments. 
     */
    Timeline.prototype._onGroupTitleSelect = function (e) {
        e.stopPropagation();
        e.preventDefault();

        var id = parseInt(e.target.getAttribute("data-id"));
        if (!isNaN(id)) {
            this.callback("openNewWindow", e.target.getAttribute("href"));
        }
    };


    /**
     * Handles the group checkbox click event.
     * 
     * @param {object} e Argumenty.
     **/
    Timeline.prototype._onGroupSelect = function (e) {
        e.stopPropagation();
        e.preventDefault();

        const id = parseInt(e.target.getAttribute("data-group-id"));
        if (isNaN(id)) {
            return;
        }

        if(id === this.selectedId()) {
            this._onSelect({
                items: []
            });
            this.timeline.setSelection([]);
            return;
        }

        this.timeline.setSelection([ id ], { focus: false });
        this._onSelect({
            items: [id]
        });
    };


    /**
     * Handles the group edit click event.
     * 
     * @param {object} e Argumenty.
     **/
    Timeline.prototype._onGroupEdit = function (e) {
        e.stopPropagation();
        e.preventDefault();

        const id = parseInt(e.target.getAttribute("data-group-id"));
        if (isNaN(id)) {
            return;
        }

        this.timeline.setSelection([ id ], { focus: false });
        this._onSelect({
            items: [id]
        });
        this.selectedItemId(id);
    };


    /**
     * Handles the item select event.
     * 
     * @param {object} e Arguments.
     **/
    Timeline.prototype._onSelect = function (e) {
        let id = this.selectedId();
        if (id) {
            if (this.groups.getIds().includes(id)) {
                this.groups.update({ id, selected: false });
            }
        }

        if (!e.items.length) {
            this.selectedId(null);
            return;
        }

        id = e.items[0];
        this.selectedId(id);
        if (this.groups.getIds().includes(id)) {
            this.groups.update({ id, selected: true });
        }
    };


    /**
     * Initializes or destroys the timeline after the items are ready.
     **/
    Timeline.prototype._onItemsChanged = function () {
        var items = this.items();
        var states = this.states();
        var priorities = this.priorities();
        var types = this.types();
        var typesOther = this.typesOther();
        var icons = this.icons();
        var showFields = this.showFields();
        var now = new Date();

        this._createStyles(types, typesOther);
        this._destroyTimeline();

        if (!items || !items.length) {
            return;
        }

        // Create groups
        var markerGroup = null;
        var groups = items
            .map((wit) => {
                if (isMarker(wit)) {
                    markerGroup = markerGroup || createMarkerGroup();
                    return null;
                }

                return createGroup(wit, items, now);
            })
            .filter((group) => group !== null);

        // Add marker group to group list
        if(markerGroup) {
            groups.unshift(markerGroup);
        }
        
        // Create items
        var records = items
            .map((wit) => createRecord(wit, now))
            .filter((record) => record !== null);

        // Options for the Timeline
        var options = {
            // moment: VisTimeline.moment.utc,
            // moment: moment,
            // locales: {
            //     sk: {
            //         current: "current",
            //         time: "time",
            //         deleteSelected: "Delete selected"
            //     }
            // },
            // locale: "sk",
            xss: {
                disabled: true
            },
            groupHeightMode: "fixed",
            orientation: "both",
            horizontalScroll: true,
            verticalScroll: true,
            zoomKey: "ctrlKey",
            editable: {
                remove: false,
                updateGroup: false,
                updateTime: true
            },
            groupTemplate: (record, element) => createGroupTemplate(this, record, element, states, priorities, types, typesOther, icons, showFields),
            visibleFrameTemplate: (record, element) => createVisibleFrameTemplate(this, record, element),
            onMove: (record, callback) => updateWit(this, record, callback)
            //template: function (item, element, data) { return '<h1>' + item.header + data.moving?' '+ data.start:'' + '</h1><p>' + item.description + '</p>'; }
        };

        this.groups = new VisTimeline.DataSet(groups);
        this.records = new VisTimeline.DataSet(records);

        // Create an Timeline
        this.timeline = new VisTimeline.Timeline(this.node, this.records, this.groups, options);
        
        // Create an Arrow
        const dependencies = items
            .filter((i) => i.dependencies.length)
            .map((i) => i.dependencies.map((d) => ({ id: `${i.id}_${d}`, id_item_1: i.id, id_item_2: d })))
            .flat(1);
        if (dependencies.length) {
            this.arrows = new VisTimelineArrow(this.timeline, dependencies, { color: "rgba(var(--palette-accent2), .8)" });
        }
        
        // Events
        this.timeline.on("select", this._onSelect.bind(this));
    };


    /**
     * Gets the selected item.
     */
    Timeline.prototype._onSelectedIdChanged = function () {
        let id = this.selectedId();
        let items = this.items();
        
        if (ko.computedContext.isInitial()) {
            return;
        }

        if (!id) {
            this.selectedItem(null);
            return;
        }

        this.selectedItem(items.find((w) => w.id === id) || null);
    };    

    //#endregion


    //#region [ Methods : Static ]

    /**
     * Factory method.
     *
     * @param {object} params Parameters.
     * @param {object} componentInfo Component into.
     * @returns {object} Instance of the model.
     */
    Timeline.createViewModel = function (params, componentInfo) {
        params = params || {};
        params.element = componentInfo.element.querySelector ? componentInfo.element : componentInfo.element.parentElement || componentInfo.element.parentNode;

        return new Timeline(params);
    };

    //#endregion


    //#region [ Methods : Internal ]
    
    /**
     * Creates and gets marker group.
     * 
     * @returns Returns object, which represents marker group.
     */
    let createMarkerGroup = function () {
        return {
            id: "markers",
            treeLevel: 1,
            content: "MARKERS",
            type: "markers",
            selected: false
        };
    };


    /**
     * Creates group representation for the current work item.
     * 
     * @param {object} wit Current work item.
     * @param {array} items List of all work items. 
     * @param {number} now Current date. 
     */
    let createGroup = function (wit, items, now) {
        var group = {
            id: wit.id,
            parentId: wit.parentId,
            parentTitle: wit.parentTitle,
            project: wit.project,
            areaPath: wit.areaPath,
            nodeName: wit.nodeName,
            remainingWork: wit.remainingWork,
            iterationPath: wit.iterationPath,
            isCompleted: wit.isCompleted,
            childCount: wit.childCount,
            childCompletedCount: wit.childCompletedCount,
            assignedTo: wit.assignedTo,
            url: wit.url,
            treeLevel: wit.level,
            content: wit.title.truncate(50, true),
            title: wit.title,
            type: wit.type,
            state: wit.state,
            priority: wit.priority,
            duration: getDuration(wit),
            selected: false,
            tags: wit.tags,
            startDate: wit.startDate,
            endDate: wit.targetDate,
            nestedGroups: items
                .filter((child) => (child.parent === wit.path) && !isMarker(child))
                .map((child) => child.id)
        };

        if (!group.nestedGroups.length) {
            delete group["nestedGroups"];
        }

        return group;
    };


    /**
     * Creates record for the current work item.
     * 
     * @param {object} wit Current work item. 
     * @param {number} now Current time in milliseconds.
     */
    let createRecord = function (wit, now) {
        var subtitle = [
            getFormattedDate(wit.startDate) || "×",
            getFormattedDate(wit.targetDate) || "×"
        ];

        // Ensure dates
        let start = wit.startDate || wit.targetDate || now;
        let end = new Date((wit.targetDate || wit.startDate || now).getTime());
        end.setDate(end.getDate() + 1);

        return {
            id: wit.id,
            parentId: wit.parentId,
            parentTitle: wit.parentTitle,
            assignedTo: wit.assignedTo,
            isCompleted: wit.isCompleted,
            childCount: wit.childCount,
            childCompletedCount: wit.childCompletedCount,
            group: isMarker(wit) ? "markers" : wit.id,
            className: `my-timeline-item my-timeline-item--${wit.type.toLowerCase().replace(/\s+/g,"-")} my-timeline-item--${wit.project.toLowerCase().replace(/\s+/g,"")}-${wit.type.toLowerCase().replace(/\s+/g,"-")}`,
            title: wit.title + "<br/>(" + subtitle.join(", ") + ")",
            content: isMarker(wit) ? wit.title : wit.childCount ? `${wit.childCompletedCount}/${wit.childCount} (${Math.ceil((wit.childCompletedCount/wit.childCount) * 100)}%)` : "&nbsp;",
            selectable: true,
            type: isMarker(wit) ? "box" : "range",
            start,
            end: isMarker(wit) ? start : end
        };
    };


    /**
     * Creates template for group.
     * 
     * @param {object} vm View model.
     * @param {object} record Current record.
     * @param {HTMLElement} element Parent element.
     * @param {array} states List of supported states.
     * @param {array} priorities List of supported priorities.
     * @param {array} types List of supported types.
     * @param {array} typesOthers List of supported types for other projects in the across project query.
     * @param {array} icons List of icons.
     * @param {array} showFields List of fields which should be rendered.
     */
    let createGroupTemplate = function (vm, record, element, states, priorities, types, typesOther, icons, showFields) {
        // Do not create group label for markers group
        if (!record || (record.type === "markers")) {
            return "";
        }

        const type = ((typesOther.find((to) => to.project === record.project) || {}).types || types).find((t) => t.name === record.type) || {};
        const state = type.states.find((s) => s.name === record.state) || {};

        const result = [
            `${icons[type.icon.url] || ""}`,
            `<a class="my-timeline-group__title ${record.isCompleted ? "my-timeline-group__title--completed" : ""}" data-id="${record.id}" title="${record.title}" href="${record.url.replace('/_apis/wit/workItems/', '/_workitems/edit/')}">${showFields.includes("id") ? "<span class='font-weight-semibold'>#" + record.id + "</span>&nbsp" : ""}${record.content}</a>`,
            `<div class="my-timeline-group__state" title="${record.state}" style="background-color: #${state.color}"></div>`
        ];

        if (showFields.includes("tags")) {
            const tags = record.tags.length ? record.tags.map((t) => `<div>${t}</div>`).join("") : "";
            result.push(`<div class="my-timeline-group__tags">${tags}</div>`);
        }

        result.push(`<div class="my-timeline-group__dividier"></div>`);

        if (showFields.includes("assignedTo")) {
            result.push(`<div class="my-timeline-group__content my-timeline-group__content--assignedto text-left text-ellipsis margin-left-8">${record.assignedTo || ""}</div>`);
        }
        
        if (showFields.includes("project")) {
            result.push(`<div class="my-timeline-group__content my-timeline-group__content--project text-left text-ellipsis margin-left-8" title="Project">${record.project}</div>`);
        }
        
        if (showFields.includes("areaPath")) {
            result.push(`<div class="my-timeline-group__content my-timeline-group__content--areapath text-left text-ellipsis margin-left-8" title="Area Path">${record.areaPath}</div>`);
        }
        
        if (showFields.includes("nodeName")) {
            result.push(`<div class="my-timeline-group__content my-timeline-group__content--nodename text-left text-ellipsis margin-left-8" title="Node Name">${record.nodeName}</div>`);
        }

        if (showFields.includes("iterationPath")) {
            result.push(`<div class="my-timeline-group__content my-timeline-group__content--iterationpath text-left text-ellipsis margin-left-8" title="Iteration Path">${record.iterationPath}</div>`);
        }
        
        if (showFields.includes("parentTitle")) {
            result.push(`<div class="my-timeline-group__content my-timeline-group__content--parent text-left text-ellipsis margin-left-8" title="Parent">${record.parentTitle || ""}</div>`);
        }

        if (showFields.includes("remainingWork")) {
            result.push(`<div class="my-timeline-group__content my-timeline-group__content--remainingwork text-right margin-left-8" title="Remaining Work">${record.remainingWork + " h" || ""}</div>`);
        }

        if (showFields.includes("dates")) {
            result.push(`<div class="my-timeline-group__content my-timeline-group__content--dates text-right margin-left-8" title="Dates">${getFormattedDate(record.startDate) || "×"} - ${getFormattedDate(record.endDate) || "×"}</div>`);
        }

        if (showFields.includes("duration")) {
            result.push(`<div class="my-timeline-group__content my-timeline-group__content--duration text-right margin-left-8" title="Duration">${record.duration} day(s)</div>`);
        }

        const priority = priorities.find((p) => p.value === record.priority) || {};
        result.push(`<div class="my-timeline-group__state my-timeline-group__state--square" title="${priority.name}" style="background-color: #${priority.color}"></div>`);

        result.push(
            `<div class="my-timeline-group__button my-timeline-group__button--checkbox fluent-icons-enabled text-center ${record.selected ? "my-timeline-group__button--selected" : ""}" title="Select item" data-group-id="${record.id}" data-noexport="true">
                <span aria-hidden="true" class="flex-noshrink fabric-icon large"></span>
             </div>`);
        result.push(
            `<div class="my-timeline-group__button my-timeline-group__button--edit fluent-icons-enabled text-center" title="Edit item" data-group-id="${record.id}" data-noexport="true">
                <span aria-hidden="true" class="flex-noshrink fabric-icon large"></span>
             </div>`);

        // Create element
        let el = global.document.createElement("div");
        el.classList.add("my-timeline-group");
        el.innerHTML = result.join("");

        el.querySelector(".my-timeline-group__title").addEventListener("pointerdown", vm._onGroupTitleSelect.bind(vm), false);
        el.querySelector(".my-timeline-group__button--checkbox").addEventListener("pointerdown", vm._onGroupSelect.bind(vm), false);
        el.querySelector(".my-timeline-group__button--edit").addEventListener("pointerdown", vm._onGroupEdit.bind(vm), false);

        return el;
    };

    /**
     * Creates template for the visible frame.
     * 
     * @param {object} vm View model.
     * @param {object} record Current record.
     * @param {HTMLElement} element Parent element.
     */
    let createVisibleFrameTemplate = function (vm, record, element) {
        let el = global.document.createElement("div");
        el.classList.add("vis-item-visible-frame__progress");
        el.style.width = (record.childCount ? Math.ceil((record.childCompletedCount/record.childCount) * 100) : 0) + "%";
        return el;
    };


    /**
     * Fired when an item has been moved.
     * 
     * @param {object} vm View model.
     * @param {object} record The item being manipulated.
     * @param {function} callback A callback function which must be invoked to report back. The callback must be invoked as callback(item) or callback(null).
     */
    let updateWit = function (vm, record, callback) {
        vm.callback.call(vm, "updateWit", record).then((result) => callback(result));
    };


    /**
     * Returns true if the wit's start and target date is the same date.
     * 
     * @param {object} wit Work item. 
     */
    let isMarker = function (wit) {
        return !wit.startDate && wit.targetDate;
    };


    /**
     * Gets the work item duration.
     * 
     * @param {object} wit Work item.
     */
    let getDuration = function (wit) {
        if (!wit.startDate || !wit.targetDate) {
            return 0;
        }

        // Check dates
        var startTime = wit.startDate.getTime();
        var targetTime = wit.targetDate.getTime();

        if (startTime > targetTime) {
            return 0;
        }

        return Math.ceil((targetTime - startTime) / (1000 * 60 * 60 * 24)) + 1;
    };


    /**
     * Gets date formatted as string.
     * 
     * @param {Date} d Date object.
     */
    let getFormattedDate = function (d) {
        if (!(d instanceof Date) || isNaN(d)) {
            return "";
        }
        
        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const year = d.getFullYear();
        
        return `${day}/${month}/${year}`;
    };


    /**
     * Makes the input color lighter or darker.
     * 
     * @param {string} col Color. 
     * @param {number} amt Amount. 
     * @returns String representing the new color.
     */
    const darkenColor = function (col, amt) {
        let usePound = false;
        if (col[0] == "#") {
            col = col.slice(1);
            usePound = true;
        }
    
        const num = parseInt(col,16);
    
        let r = (num >> 16) + amt;
    
        if ( r > 255 ) r = 255;
        else if  (r < 0) r = 0;
    
        let b = ((num >> 8) & 0x00FF) + amt;
    
        if ( b > 255 ) b = 255;
        else if  (b < 0) b = 0;
        
        let g = (num & 0x0000FF) + amt;
    
        if ( g > 255 ) g = 255;
        else if  ( g < 0 ) g = 0;
    
        return (usePound ? "#" : "") + (g | (b << 8) | (r << 16)).toString(16);
    };


    /**
     * Gets the right text color according to the background color.
     * 
     * @param {string} col Color of the background.
     */
    const textColorForBackground = function (col) {
        let usePound = false;
        if (col[0] == "#") {
            col = col.slice(1);
            usePound = true;
        }

        // Make the color 6 character long
        if (col.length === 3) {
            col = col.split("").map(c => c + c).join("");
        }

        // Convert to RGB
        const r = parseInt(col.substr(0, 2), 16);
        const g = parseInt(col.substr(2, 2), 16);
        const b = parseInt(col.substr(4, 2), 16);

        // Calculate the brightnes accroding to  W3C
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;

        // Threshold value ~128
        return (usePound ? "#" : "") + (brightness > 128 ? "000" : "fff");
    };
    
    //#endregion


    //#region [ Registration ]

    ko.components.register("my-timeline", {
        viewModel: { 
            createViewModel: Timeline.createViewModel 
        },
        template: 
            `<div class="my-timeline"></div>`
    });

    //#endregion
});