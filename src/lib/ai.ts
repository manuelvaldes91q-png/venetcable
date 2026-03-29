const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const SYSTEM_PROMPT = `Eres un ingeniero de redes experto especializado en redes MikroTik y ISP.
Tu trabajo es analizar datos de monitoreo de red y dar recomendaciones prácticas y concisas.
Responde siempre en español.
Sé directo y específico. Si detectas un problema, explica la causa probable y la solución.
Usa formato simple, sin markdown complejo.`;

export async function analyzeWithAI(
  data: string,
  question?: string
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return "⚠️ No hay API key de OpenRouter configurada.\nAgrega OPENROUTER_API_KEY en las variables de entorno.\nObtén una gratis en https://openrouter.ai";
  }

  console.log("AI Key loaded:", apiKey.substring(0, 15) + "...");

  const userMessage = question
    ? `Pregunta del usuario: ${question}\n\nDatos actuales de la red:\n${data}`
    : `Analiza estos datos de monitoreo y dame recomendaciones si detectas algún problema:\n\n${data}`;

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://mikrotik-monitor.local",
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.3-70b-instruct:free",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        max_tokens: 500,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("AI API error:", res.status, err);
      return `⚠️ Error de la API de IA (${res.status}): ${err}`;
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || "No se obtuvo respuesta de la IA.";
  } catch (e) {
    console.error("AI error:", e);
    return "⚠️ Error al conectar con la IA. Intenta más tarde.";
  }
}

export function buildNetworkSnapshot(
  devices: { name: string; host: string; status: string }[],
  metrics: { deviceName: string; cpu: number | null; ram: number | null; uptime: string | null; ping: number | null; loss: number | null }[],
  antennas: { name: string; ip: string | null; status: string }[],
  queues: { name: string; rate: string }[]
): string {
  let snap = "=== ESTADO DE LA RED ===\n\n";

  snap += "DISPOSITIVOS:\n";
  for (const d of devices) {
    snap += `- ${d.name} (${d.host}): ${d.status}\n`;
  }

  snap += "\nMÉTRICAS:\n";
  for (const m of metrics) {
    snap += `- ${m.deviceName}: CPU=${m.cpu ?? "?"}%, RAM=${m.ram ?? "?"}%, Ping=${m.ping ?? "?"}ms, Pérdida=${m.loss ?? "?"}%, Uptime=${m.uptime || "?"}\n`;
  }

  snap += "\nANTENAS:\n";
  for (const a of antennas) {
    snap += `- ${a.name} (${a.ip || "sin IP"}): ${a.status}\n`;
  }

  if (queues.length > 0) {
    snap += "\nCLIENTES ACTIVOS:\n";
    for (const q of queues) {
      snap += `- ${q.name}: ${q.rate}\n`;
    }
  }

  return snap;
}
