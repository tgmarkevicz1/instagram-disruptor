function formatMs(ms) {
  const totalSec = Math.floor((ms || 0) / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Show tracked time
chrome.storage.local.get(["totalTimeMs"], (data) => {
  document.getElementById("time").textContent = formatMs(data.totalTimeMs);
});

// Reset button
document.getElementById("resetBtn").addEventListener("click", () => {
  chrome.storage.local.set({ totalTimeMs: 0 }, () => {
    document.getElementById("time").textContent = "0:00";
  });
});

// Check helper status
fetch("http://127.0.0.1:3000/status")
  .then((r) => r.json())
  .then((d) => {
    document.getElementById("dot").className = "dot green";
    document.getElementById("helperText").textContent = `Helper running (${d.platform})`;
  })
  .catch(() => {
    document.getElementById("dot").className = "dot red";
    document.getElementById("helperText").textContent = "Helper not running – run server.js";
  });
