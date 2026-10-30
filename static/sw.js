// Minimal service worker so the app can be added to the home screen.
// It does not cache anything, so you always see the latest code.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
