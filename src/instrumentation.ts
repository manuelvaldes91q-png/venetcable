export async function register() {
  const pollInterval = Number(process.env.TELEGRAM_POLL_INTERVAL) || 10000;

  const startPolling = async () => {
    try {
      const { pollTelegramUpdates, checkAndSendAlerts } = await import("@/lib/telegram");
      const poll = async () => {
        try {
          await pollTelegramUpdates();
          await checkAndSendAlerts();
        } catch {}
      };
      await poll();
      setInterval(poll, pollInterval);
      console.log(`Telegram polling started (${pollInterval}ms)`);
    } catch (e) {
      console.error("Failed to start Telegram polling:", e);
      setTimeout(startPolling, 30000);
    }
  };

  startPolling();
}
