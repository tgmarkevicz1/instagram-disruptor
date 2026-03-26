/**
 * Instagram Disruptor – Local Helper Server
 * Handles system-level unmute that the browser extension cannot do alone.
 *
 * Fixes applied:
 *  - Added OPTIONS preflight handler so browsers don't block the CORS request
 *  - Wrapped exec() calls with error callbacks
 *  - Added /status endpoint for health-checking from the extension
 *  - Graceful shutdown on SIGINT / SIGTERM
 *  - Consistent JSON responses
 */

const http = require("http");
const { exec } = require("child_process");

const PORT = 3000;

function setHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Content-Type", "application/json");
}

function unmute(callback) {
  const cmds = {
    darwin: 'osascript -e "set volume output muted false"',
    win32: "nircmd.exe mutesysvolume 0",
    linux: "amixer set Master unmute",
  };
  const cmd = cmds[process.platform] || cmds.linux;
  exec(cmd, (err) => {
    if (err) console.error("[unmute] error:", err.message);
    callback(err);
  });
}

const server = http.createServer((req, res) => {
  setHeaders(res);

  // Browser sends a preflight OPTIONS before the actual GET
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === "/unmute") {
    unmute((err) => {
      res.writeHead(err ? 500 : 200);
      res.end(JSON.stringify({ ok: !err, error: err ? err.message : null }));
    });
    return;
  }

  if (req.url === "/status") {
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true, platform: process.platform }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ ok: false, error: "not found" }));
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[instagram-disruptor] helper running on http://127.0.0.1:${PORT}`);
});

function shutdown() {
  console.log("\n[instagram-disruptor] shutting down…");
  server.close(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
