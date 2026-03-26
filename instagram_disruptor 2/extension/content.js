/**
 * content.js – runs on every instagram.com page
 *
 * Fixes applied:
 *  - startTime is now actually used to compute elapsed ms per tick
 *  - Sends { elapsedMs } so background.js can accumulate correctly
 *  - Cleans up the interval when the page is unloaded (prevents phantom ticks)
 */

const startTime = Date.now();

chrome.runtime.sendMessage({ type: "INSTAGRAM_OPENED" });

const interval = setInterval(() => {
  const elapsedMs = Date.now() - startTime;
  chrome.runtime.sendMessage({ type: "TIME_UPDATE", elapsedMs });
}, 1000);

window.addEventListener("beforeunload", () => {
  clearInterval(interval);
});
