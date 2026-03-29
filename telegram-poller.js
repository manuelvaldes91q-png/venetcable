const POLL_URL = "http://localhost:7990/api/telegram/poll";
const INTERVAL = 10000;

async function poll() {
  try {
    await fetch(POLL_URL, { method: "POST", signal: AbortSignal.timeout(15000) });
  } catch {}
}

console.log("Telegram poller started (every 10s)");
poll();
setInterval(poll, INTERVAL);
