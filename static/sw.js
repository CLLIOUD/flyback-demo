self.addEventListener("install", () => {
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
    let payload = {};

    try {
        payload = event.data ? event.data.json() : {};
    } catch (error) {
        console.error("Push payload parse error:", error);
    }

    const options = {
        body: payload.body || "",
        data: {
            url: payload.url || "/return",
        },
    };

    event.waitUntil(
        self.registration.showNotification(
            payload.title || "TIME CAPSULE FLYBACK",
            options,
        ),
    );
});

self.addEventListener("notificationclick", (event) => {
    console.log("notificationclick", event.notification.data);
    event.notification.close();

    const target = event.notification.data?.url || "/return";
    const absoluteUrl = new URL(target, self.location.origin).href;

    console.log("Opening notification URL:", absoluteUrl);

    event.waitUntil(
        clients.openWindow(absoluteUrl),
    );
});
