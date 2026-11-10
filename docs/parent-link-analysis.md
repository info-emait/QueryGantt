# Parent-link analysis

On a backlog-reorder error, choose **Analyze Parent links** to read the named
work items and their current Parent chains. Analysis is read-only and starts
only on request; it never edits links, ranks, or work items. Confirmed findings
identify both ends of same-category links, reversed category links, and cycles.
Unknown categories, other projects, unreadable items, and time/item limits are
reported as incomplete checks rather than proof of a valid hierarchy. Skipped
higher backlog levels alone are not classified as invalid.

The message component owns the diagnostic state and loads current team category
metadata independently of the reorder implementation. The feature can therefore
be reviewed separately from backlog drag-and-drop. It expands current fields
and relations without a field selector, using the REST enum name `all`. Lookup
failures show the HTTP status and original server detail. Successful reads show
paths and links to the actual work item's project; an empty path section is hidden.

Labels use the Azure DevOps user's page culture from
`SDK.getPageContext().globalization.culture`, read after `SDK.ready()`.
Japanese (`ja` and `ja-*`) selects Japanese; other or unavailable cultures fall
back to English. Browser language does not override this setting. Reopen the
tab after changing the Azure DevOps language. IDs, process type names, and
original server errors retain their original values.

`npm test` includes the pinned SDK's actual URL serializer and synthetic REST
responses, both languages, partial failures, cycles, cancellation, and bounds.
`npm run test:browser` exercises the actual message component with host and
browser languages deliberately different. These checks do not replace a VSIX
smoke test in Azure DevOps.

## Local verification

Install dependencies with `npm install`, then run `npm test`,
`npm run test:browser`, and `npx grunt app-build:Debug`. Browser checks require
Chrome, or Playwright Chromium with `QUERYGANTT_BROWSER_CHANNEL=chromium`.
After a Release build, `QUERYGANTT_TEST_BUILT=1 npm run test:browser` checks
the minified diagnostic modules. All fixtures use synthetic data.

This feature has no import or commit dependency on the reorder feature in #33.
It recognizes named Work Item IDs in English/Japanese reorder errors. If the
message component also receives an optional observable `context` with a
`workItemIds` array, those failed-gesture endpoints are checked too, including
a target that Azure did not name. Without a compatible reorder error, no
analysis action is shown. #33 supplies the reorder operation and structured
error context; this feature can be reviewed independently.
