# Changelog



## QueryGantt v1.5.0

### Added
* State can now be edited in the side detail panel.
* One hop and flat queries can be now filtered using **As of** filter to show historical data.

### Changed
* The libraries in use have been updated to the latest versions.
* Changed the shape of the arrow lines from bezier to cornered line.
* Changed the Gantt page paddings to default.

### Fixed
* Fixed when rendering failed due to the deleted state in the project process [#25](https://github.com/info-emait/QueryGantt/issues/25).




## QueryGantt v1.4.1

### Added
* Added **Edit** button to open the side detail panel.
* Start and Target date can now be edited in the side detail panel.
* Attributes **Effort** and **Completed Work** have been added to the list of attributes for display.
* The footer now displays the total **Effort**, **Remaining Work** and **Completed Work**.
* On the timeline view, a pill is displayed for **Effort**, **Remaining Work** and **Completed Work** for better distinction.

### Changed
* Clicking the checkbox on the timeline no longer opens the side detail panel.
* In the footer, the States legend now only shows states that exist in the list of displayed work items.

### Fixed
* The shadow at the bottom of the timeline was not displayed.
* Long names of Parent work items were not shown in the filter.
* Instead of showing an empty label for filtering items without a parent, **@Without parent** is displayed.
* Instead of showing an empty space for an empty **Assigned To** or **Tags** filter list, a zero-data message is displayed.



## QueryGantt v1.4.0

### Added
* The details of the selected work item are displayed in a separate panel.
* An ID attribute has been added to the list of displayed fields.
* A fixed column width has been set for the displayed fields for better readability.
* The visibility of fields can now be configured in a separate configuration panel.
* The fields visibility configuration is saved and loaded from the settings of the currently logged-in user.
* A separate filtering toolbar has been added, allowing filtering by:
    * Work item ID,
    * Work item Title,
    * Period (Start Date, Target Date),
    * Assigned To,
    * State,
    * Priority,
    * Tags,
    * Area (Node Name),
    * Parent work item.
* An informational message was added if no work items meet the selected filtering criteria.
* The text color that indicates the percentage of completeness adapts to the background color of the individual work items.

### Changed
* The libraries in use have been updated to the latest versions.
* The button for sharing the Gantt chart via a URL has been removed, while sharing the Gantt chart through a URL still remains.
* The text field for quick filtering using the "gmail" like filter syntax has been removed.
* The information about the number of displayed work items was moved from the footer to the header of the Gantt chart.


## QueryGantt v1.3.0

### Added
* Start and Target date can be now edited via the timeline.

### Fixed
* After focus the selected item was not entirely scrolled into the view.


## QueryGantt v1.2.3

### Fixed
* When the query contains circular relations the Gantt did not render.
* Fixed when rendering failed due to the CORS policy violation while fetching the icons [#18](https://github.com/info-emait/QueryGantt/issues/18).
* Fixed when rendering failed due to the new unsaved query [#18](https://github.com/info-emait/QueryGantt/issues/18).

### Changed
* Removed obtrusive placeholder animation.
* Changed zoom icons in the toolbar.
* Changed position of the components in the footer.

### Added
* Show error message when then download of the Gantt chart ends up with an error.
* Added text-overflow to the completed progress of child work items in the bar.
* After focus the selected item is also scrolled into the view.



## QueryGantt v1.2.1

### Changed
* Improved visibility of the selected item.
* Differentiate weekend days in the timeline [#19](https://github.com/info-emait/QueryGantt/issues/19).

### Added
* Quick filter support for Start Date, Target Date, Parent's Title and Node Name [#16](https://github.com/info-emait/QueryGantt/issues/16).
* Added Remaining Work in the list of selection fields [#15](https://github.com/info-emait/QueryGantt/issues/15).
* Precentage progress indication [#15](https://github.com/info-emait/QueryGantt/issues/15).
* Visualisation of the Successor-Predecessor relations for the work items.



## QueryGantt v1.2.0

### Changed
* Visibility of fields can be now configured using **Fields ...** popup menu.
* Share link now contains new `showFields` attribute instead of `showTags`, `showDates` and `showAssignedTo`.

### Added
* Additional fields can be now displayed in the timeline (Area Path, Iteration Path, Parent, Team Project).



## QueryGantt v1.1.11

### Fixed
* When the state of work item was not showing correctly for the queries across projects.
* Icon was not rendered when exporting to an image.
* Checkbox for the selected work item should not be rendered when exporting to an image.

### Changed
* Toolbar for selected work item is displayed below the main toolbar.
* The exported xlsx file now contains predefined weeks which will cover the whole year.

### Added
* Completed work items are now striked through.
* Completed progress of child work items is shown on the bar.
* Search box now contains suggestions for filtering.



## QueryGantt v1.1.9

### Fixed
* Share button was not working in Edge.



## QueryGantt v1.1.6

### Fixed
* Expand all/Collapse all buttons are now disabled for the flat queries.
* Quick filter is now added to the query string, in order to be preserved via share functionality.
* Color and icon of the work item is now respective of the project it belongs to.

### Changed
* Loading of the Azure DevOps UI components has been optimized.

### Added
* Export to image.



## QueryGantt v1.1.4

### Fixed
* Fixed issue when share url did not contain the query id.



## QueryGantt v1.1.3

### Fixed
* Fixed issue when downloading of the xlsx file was not working within Auzure DevOps Services.



## QueryGantt v1.1.1

### Changed
* Changed the `hostScopes` setting to support organization scope.



## QueryGantt v1.1.0

### Added
* Updated documentation.
* Quick filter support.



## QueryGantt v1.0.0

### Added
* Display query results in the time line.
* Expand/Collapse functionality.
* Selection of an item.
* Navigation toolbar.
* Share functionality.
* Display tags and dates.
* Export to excel.
