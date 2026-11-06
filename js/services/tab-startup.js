define(["sdk"], function (sdk) {
    const slowLoadDelay = 5000;

    const start = function (tabId, loadApp) {
        const notice = document.getElementById("querygantt-load-notice");
        const status = notice.querySelector("[role='status']");
        const close = notice.querySelector("button");
        let dismissed = false;
        const started = Date.now();

        const show = (message) => {
            status.textContent = message;
            notice.hidden = false;
        };
        const timer = setTimeout(() => {
            if (!dismissed) {
                show("Query Gantt is taking longer than expected to load.");
            }
        }, slowLoadDelay);
        close.addEventListener("click", () => {
            dismissed = true;
            notice.hidden = true;
            clearTimeout(timer);
        });

        // The iframe already contains a loading UI. Show it after the
        // handshake, without waiting for the chart, settings, or query.
        const handshake = Promise.resolve().then(() => sdk.init({ loaded: true, applyTheme: true }));
        const app = Promise.all([handshake, Promise.resolve().then(loadApp)])
            .then(([, module]) => module.start());
        // The SDK's cross-frame registry supports a promised instance.
        // Register before the host can call into the newly visible tab.
        sdk.register(tabId, () => app);

        return app.then((model) => {
            clearTimeout(timer);
            if (!dismissed && Date.now() - started >= slowLoadDelay) {
                show("Query Gantt took longer than expected to load.");
            }
            return model;
        }, (error) => {
            clearTimeout(timer);
            document.getElementById("querygantt-loading-spinner").hidden = true;
            notice.classList.add("querygantt-tab__load-notice--error");
            show("Query Gantt couldn't load. Reopen the Gantt tab to try again.");
            console.warn("Query Gantt startup failed.", error);
            return null;
        });
    };

    return { start };
});
