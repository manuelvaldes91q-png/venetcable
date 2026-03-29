const ANALYZE_URL = "http://localhost:7990/api/ai/agent";
const POLL_URL = "http://localhost:7990/api/telegram/poll";
const POLL_INTERVAL = 10000;
const ANALYSIS_INTERVAL = 600000;

let isPolling = false;

async function pollTelegram() {
  if (isPolling) return;
  isPolling = true;
  try {
    const res = await fetch(POLL_URL, { method: "POST", signal: AbortSignal.timeout(15000) });
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
  console.log("- Network analysis: every 10min");

  pollTelegram();
  setTimeout(runAnalysis, 30000);

  setInterval(pollTelegram, POLL_INTERVAL);
  setInterval(runAnalysis, ANALYSIS_INTERVAL);
}

start();
