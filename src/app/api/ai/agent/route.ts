import { NextResponse } from "next/server";
import { runAutonomousAnalysis, getRecentLogs, getKnowledgeBase } from "@/lib/ai-agent";
import { db } from "@/db";
import { telegramConfig, telegramUsers } from "@/db/schema";
import { eq } from "drizzle-orm";

async function notifyTelegram(message: string) {
  try {
    const [config] = await db.select().from(telegramConfig).limit(1);
    if (!config || !config.enabled) return;

    const activeUsers = await db
      .select().from(telegramUsers)
      .where(eq(telegramUsers.isActive, true));

    for (const user of activeUsers) {
      try {
        await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: user.telegramChatId,
            text: message,
            parse_mode: "Markdown",
          }),
        });
      } catch {}
    }
  } catch {}
}

export async function POST() {
  try {
    const report = await runAutonomousAnalysis();

    if (report) {
      await notifyTelegram(report);
      return NextResponse.json({ success: true, report, hasIssues: true });
    }

    return NextResponse.json({ success: true, report: null, hasIssues: false });
  } catch (e) {
    console.error("AI agent error:", e);
    return NextResponse.json({ error: "Error en análisis" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const logs = await getRecentLogs(10);
    const knowledge = await getKnowledgeBase();
    return NextResponse.json({ logs, knowledge });
  } catch (e) {
    console.error("AI agent GET error:", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
