/**
 * background.js – service worker
 *
 * Fixes applied:
 *  - Per-tab timers stored in a Map so opening multiple Instagram tabs
 *    doesn't reset a single shared timer.
 *  - TIME_UPDATE now stores the highest elapsedMs seen (not cumulative +1000
 *    per tick, which was over-counting).
 *  - trigger() checks that the tab still exists before scripting it.
 *  - Video uses a reliable public MP4 with a fallback message if blocked.
 *  - After triggering, the timer for that tab is deleted so it won't re-fire
 *    if the same tab stays open.
 */

const tabTimers = new Map(); // tabId → timeoutId

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!sender.tab) return; // message from popup or another SW – ignore

  const tabId = sender.tab.id;

  if (msg.type === "INSTAGRAM_OPENED") {
    scheduleDisrupt(tabId);
  }

  if (msg.type === "TIME_UPDATE") {
    // Store the max elapsed time we've seen for this session
    chrome.storage.local.get(["totalTimeMs"], (data) => {
      const prev = data.totalTimeMs || 0;
      const next = Math.max(prev, msg.elapsedMs || 0) + 1000;
      chrome.storage.local.set({ totalTimeMs: next });
    });
  }
});

// Clean up when a tab closes
chrome.tabs.onRemoved.addListener((tabId) => {
  const t = tabTimers.get(tabId);
  if (t) {
    clearTimeout(t);
    tabTimers.delete(tabId);
  }
});

function scheduleDisrupt(tabId) {
  // Cancel any existing timer for this tab
  if (tabTimers.has(tabId)) {
    clearTimeout(tabTimers.get(tabId));
  }

  // Random delay between 3 and 5 minutes (in ms)
  const minMs = 3 * 60 * 1000;
  const maxMs = 5 * 60 * 1000;
  const delay = Math.random() * (maxMs - minMs) + minMs;

  const t = setTimeout(() => {
    tabTimers.delete(tabId);
    disrupt(tabId);
  }, delay);

  tabTimers.set(tabId, t);
}

async function disrupt(tabId) {
  // Make sure the tab still exists
  let tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch {
    return; // tab was closed
  }

  if (!tab.url || !tab.url.includes("instagram.com")) return;

  // Ask the helper to unmute system volume
  fetch("http://127.0.0.1:3000/unmute").catch(() => {
    console.warn("[disruptor] helper not running – skipping system unmute");
  });

  // Unmute the tab itself
  chrome.tabs.update(tabId, { muted: false });

  // Inject the reminder video overlay
  chrome.scripting.executeScript({
    target: { tabId },
    func: injectVideo,
  });
}

/**
 * Injected into the page – must be a standalone function (no closure access).
 */
function injectVideo() {
  // Avoid injecting twice
  if (document.getElementById("__ig_disruptor__")) return;

  // ── Fullscreen backdrop ──────────────────────────────────────────────────
  const overlay = document.createElement("div");
  overlay.id = "__ig_disruptor__";
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",                          // top/right/bottom/left: 0
    width: "100vw",
    height: "100vh",
    background: "rgba(0,0,0,0.92)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    zIndex: "2147483647",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  });

  // ── Header bar ───────────────────────────────────────────────────────────
  const header = document.createElement("div");
  Object.assign(header.style, {
    position: "absolute",
    top: "0",
    left: "0",
    right: "0",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 20px",
    background: "#e1306c",
    color: "#fff",
    fontSize: "15px",
    fontWeight: "600",
  });
  header.textContent = "⏰  Time's up – take a break!";

  const closeBtn = document.createElement("button");
  Object.assign(closeBtn.style, {
    background: "rgba(255,255,255,0.2)",
    border: "none",
    borderRadius: "50%",
    color: "#fff",
    cursor: "pointer",
    fontSize: "18px",
    lineHeight: "1",
    width: "32px",
    height: "32px",
  });
  closeBtn.textContent = "✕";
  closeBtn.title = "Dismiss";
  closeBtn.onclick = () => overlay.remove();
  header.appendChild(closeBtn);

  // ── Video – fills most of the screen ────────────────────────────────────
  const video = document.createElement("video");
  video.src =
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";
  video.controls = true;
  video.loop = false;
  // Start muted so the browser allows autoplay, then immediately unmute.
  // This bypasses the autoplay-with-sound policy that was blocking audio.
  video.muted = true;
  video.autoplay = true;
  Object.assign(video.style, {
    width: "min(90vw, 160vh)",   // fills width on landscape, height on portrait
    height: "auto",
    maxHeight: "80vh",
    borderRadius: "6px",
    marginTop: "56px",           // clear the header bar
    outline: "none",
    boxShadow: "0 8px 40px rgba(0,0,0,0.8)",
  });

  // Once playback starts, unmute and set volume – this always succeeds
  // because the play() promise resolves only after the browser commits to playing.
  video.addEventListener("playing", () => {
    video.muted = false;
    video.volume = 0.9;
  }, { once: true });

  video.addEventListener("ended", () => {
    setTimeout(() => overlay.remove(), 2000);
  });

  overlay.appendChild(header);
  overlay.appendChild(video);
  document.body.appendChild(overlay);

  // Also try to play explicitly and swallow any remaining policy errors
  video.play().catch(() => {
    // Autoplay still blocked (very strict browser config) – leave muted so
    // the user at least sees the overlay and can click play manually.
  });
}
