![Query Gantt Logo](img/logo.png)

# About the extension
Query Gantt is an extension for the Azure DevOps, which enables you to view the result of the selected query in the form of a Gantt chart using the [vis-timeline](https://visjs.github.io/vis-timeline/) and export it to the excel file using the [xlsx-populate](xlsx-populate) parser/generator.

# Setup
After installing the extension from the Marketplace, you need to enable it in the **Manage features**  section.

# How does it work
Query Gantt can be used for any type of the query, but the timeline visualisation will be rendered only for those work items
which have the **Start Date** (Microsoft.VSTS.Scheduling.StartDate) and **Target Date** (Microsoft.VSTS.Scheduling.TargetDate)
set.

If the work item has set up both **Start Date** and **Target Date** it will be rendered as a bar, if the work item has set up only the **Target Date** it will be rendered as a marker on the timeline.