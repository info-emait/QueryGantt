# Changelog


## QueryGantt v1.2.1

### Changed
* Improved visibility of the selected item.
* Differentiate weekend days in the timeline [#19](https://github.com/info-emait/QueryGantt/issues/19).
* Quick filter support for Start Date, Target Date, Parent's Title and Node Name [#16](https://github.com/info-emait/QueryGantt/issues/16).
* Added Remaining Work in the list of selection fields [#15](https://github.com/info-emait/QueryGantt/issues/15).



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
