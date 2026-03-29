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
    if (res.status === 409) {
      console.log("Bot polling conflict, waiting...");
    }
  } catch {} finally {
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

console.log("AI Agent started");
console.log("- Telegram polling: every 10s");
console.log("- Network analysis: every 10min");

pollTelegram();
setTimeout(runAnalysis, 30000);

setInterval(pollTelegram, POLL_INTERVAL);
setInterval(runAnalysis, ANALYSIS_INTERVAL);
