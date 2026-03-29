const ANALYZE_URL = "http://localhost:7990/api/ai/agent";
const POLL_URL = "http://localhost:7990/api/telegram/poll";
const DEVICES_URL = "http://localhost:7990/api/devices";
const METRICS_URL = "http://localhost:7990/api/metrics";
const POLL_INTERVAL = 10000;
const ANALYSIS_INTERVAL = 900000;
const METRICS_INTERVAL = 60000;

let isPolling = false;
let isCollecting = false;

async function pollTelegram() {
  if (isPolling) return;
  isPolling = true;
  try {
    const res = await fetch(POLL_URL, { method: "POST", signal: AbortSignal.timeout(30000) });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.log("Poll:", res.status, body);
    }
  } catch (e) {
    console.error("Poll error:", e.message);
  } finally {
    isPolling = false;
  }
}

async function collectMetrics() {
  if (isCollecting) return;
  isCollecting = true;
  try {
    const devRes = await fetch(DEVICES_URL, { signal: AbortSignal.timeout(5000) });
    if (!devRes.ok) { isCollecting = false; return; }
    const devices = await devRes.json();

    for (const device of devices) {
      try {
        await fetch(METRICS_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId: device.id }),
          signal: AbortSignal.timeout(30000),
        });
      } catch {}
    }
  } catch {} finally {
    isCollecting = false;
  }
}

async function runAnalysis() {
  try {
    const res = await fetch(ANALYZE_URL, { method: "POST", signal: AbortSignal.timeout(60000) });
    if (res.ok) {
      const data = await res.json();
      if (data.hasIssues) {
        console.log("AI found issues, sent to Telegram");
      }
    }
  } catch {}
}

async function waitForApp() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch("http://localhost:7990/api/auth/session", { signal: AbortSignal.timeout(3000) });
      if (res.ok || res.status === 401) {
        console.log("App is ready");
        return true;
      }
    } catch {}
    console.log("Waiting for app...", i + 1);
    await new Promise((r) => setTimeout(r, 2000));
  }
  console.error("App not ready after 60s");
  return false;
}

async function start() {
  console.log("AI Agent starting...");
  const ready = await waitForApp();
  if (!ready) {
    console.error("Cannot connect to app, exiting");
    process.exit(1);
  }

  console.log("- Telegram polling: every 10s");
  console.log("- Metrics collection: every 60s");
  console.log("- Network analysis: every 10min");

  pollTelegram();
  collectMetrics();
  setTimeout(runAnalysis, 30000);

  setInterval(pollTelegram, POLL_INTERVAL);
  setInterval(collectMetrics, METRICS_INTERVAL);
  setInterval(runAnalysis, ANALYSIS_INTERVAL);
}

start();
