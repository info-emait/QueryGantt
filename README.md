# How to enable build?
If you see build errors, claiming that it is not possible to run command line `grunt.ps1` because of the execution policy, it is necessary to run the following powershell script and to restart Visual Studio Code:

```ps
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

# Tests

Run `npm test` for the Node regression suites. Changes to timeline layout also
require `npm run test:browser`, which uses headless Google Chrome with a temporary
profile and synthetic work items. Install Chrome before running this command.
To use Playwright's own Chromium instead, run `npx playwright install chromium`
and set `QUERYGANTT_BROWSER_CHANNEL=chromium` when running the browser tests.

The browser suite checks the real timeline and source LESS across multiple
one-second resize polls, including hidden-tab startup, out-of-range child items,
page scrolling, collapse/expand, and narrower host widths.

# Parent-link analysis language

The rejected-move analysis uses the Azure DevOps user's page culture from
`SDK.getPageContext().globalization.culture`, read after `SDK.ready()`.
Japanese (`ja` and `ja-*`) selects Japanese buttons, results, warnings, and
Parent-chain labels; other or unavailable cultures fall back to English.
The browser language does not override this setting. Reopen the tab after
changing the Azure DevOps language. Work Item IDs, process-specific type names,
and server error details retain their original values.

The Node regression suites cover both languages and failure paths. The browser
suite mounts the actual message component using the application's template and
deliberately sets a browser language different from the host culture.
