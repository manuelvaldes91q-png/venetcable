const ANALYZE_URL = "http://localhost:7990/api/ai/agent";
const POLL_URL = "http://localhost:7990/api/telegram/poll";
const POLL_INTERVAL = 10000;
const ANALYSIS_INTERVAL = 300000;

async function pollTelegram() {
  try {
    await fetch(POLL_URL, { method: "POST", signal: AbortSignal.timeout(15000) });
  } catch {}
}

async function runAnalysis() {
  try {
    const res = await fetch(ANALYZE_URL, { method: "POST", signal: AbortSignal.timeout(60000) });
    if (res.ok) {
      const data = await res.json();
      if (data.report) {
        console.log("AI found issues:", data.issueCount);
      }
    }
  } catch {}
}

console.log("AI Agent started");
console.log("- Telegram polling: every 10s");
console.log("- Network analysis: every 5min");

pollTelegram();
runAnalysis();

setInterval(pollTelegram, POLL_INTERVAL);
setInterval(runAnalysis, ANALYSIS_INTERVAL);
