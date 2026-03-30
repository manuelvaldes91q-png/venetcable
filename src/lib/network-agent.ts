import { mikrotikKnowledge, searchKnowledge, type KnowledgeEntry } from "@/lib/mikrotik-knowledge";
import { analyzeMikroTik, type Finding } from "@/lib/network-analyzer";

type Config = Parameters<typeof analyzeMikroTik>[0];

interface Context {
  config: Config;
  findings: Finding[];
  deviceName: string;
}

function understandIntent(input: string): { intent: string; topic: string } {
  const q = input.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (q.match(/hola|buenos|buenas|hey|saludos|que tal/)) return { intent: "greeting", topic: "" };
  if (q.match(/gracias|te agradezco|perfecto|excelente|ok|vale|esta bien/)) return { intent: "thanks", topic: "" };
  if (q.match(/quien eres|que eres|como te llamas|tu nombre/)) return { intent: "identity", topic: "" };
  if (q.match(/ayuda|help|que puedes hacer|opciones|comandos/)) return { intent: "help", topic: "" };

  if (q.match(/analiza|revisa|diagnostica|chequea|verifica|como esta|estado de/)) return { intent: "analyze", topic: "full" };

  if (q.match(/firewall|reglas|filtro|bloquear|permitir|puertos abiertos|proteccion|seguridad/)) return { intent: "analyze", topic: "firewall" };
  if (q.match(/cpu|procesador|carga|sobrecarga|lento|rendimiento|velocidad del router/)) return { intent: "analyze", topic: "performance" };
  if (q.match(/ram|memoria|almacenamiento/)) return { intent: "analyze", topic: "memory" };
  if (q.match(/cola|queue|velocidad|limite|ancho de banda|clientes|internet lento/)) return { intent: "analyze", topic: "queues" };
  if (q.match(/dhcp|lease|ip|pool|asignar/)) return { intent: "analyze", topic: "dhcp" };
  if (q.match(/dns|resolucion|nombres|dominios/)) return { intent: "analyze", topic: "dns" };
  if (q.match(/nat|masquerade|traduccion|no navegan|sin internet/)) return { intent: "analyze", topic: "nat" };
  if (q.match(/ruta|gateway|enrutamiento|default route/)) return { intent: "analyze", topic: "routes" };
  if (q.match(/interface|interfaz|puerto|ethernet|cable/)) return { intent: "analyze", topic: "interfaces" };
  if (q.match(/antena|radio|enlace|punto a punto/)) return { intent: "analyze", topic: "antennas" };
  if (q.match(/vpn|acceso remoto|wireguard|tunel/)) return { intent: "topic", topic: "vpn" };
  if (q.match(/hotspot|portal cautivo|login|captive/)) return { intent: "topic", topic: "hotspot" };
  if (q.match(/backup|respaldo|copia|exportar/)) return { intent: "topic", topic: "backup" };
  if (q.match(/actualizar|update|version|routeros/)) return { intent: "topic", topic: "update" };
  if (q.match(/fasttrack|fast track/)) return { intent: "topic", topic: "fasttrack" };
  if (q.match(/ntp|hora|fecha|reloj|tiempo/)) return { intent: "topic", topic: "ntp" };
  if (q.match(/ssh|telnet|winbox|acceso|contrasena/)) return { intent: "topic", topic: "access" };
  if (q.match(/proxy|socks/)) return { intent: "topic", topic: "proxy" };
  if (q.match(/arp|spoofing|mac|conflicto/)) return { intent: "topic", topic: "arp" };
  if (q.match(/wifi|inalambrico|wireless|señal/)) return { intent: "topic", topic: "wifi" };
  if (q.match(/balanceo|load balancing|dual wan|dos internet/)) return { intent: "topic", topic: "loadbalancing" };
  if (q.match(/scheduler|script|automatizar|tarea/)) return { intent: "topic", topic: "scheduler" };
  if (q.match(/log|error|registro|mensaje/)) return { intent: "analyze", topic: "logs" };
  if (q.match(/como|como se|tutorial|pasos|instrucciones/)) return { intent: "howto", topic: q };

  return { intent: "analyze", topic: "full" };
}

function getGreeting(): string {
  const greetings = [
    `👋 *¡Hola! Soy tu asistente de redes MikroTik.*\n\nEstoy aquí para ayudarte a mantener tu red funcionando perfectamente. Puedo:\n\n• 🔍 Analizar tu configuración\n• 🔒 Encontrar problemas de seguridad\n• ⚡ Optimizar el rendimiento\n• 📋 Darte comandos listos para copiar\n\n¿Qué necesitas hoy?`,
    `👋 *¡Buen día! Tu ingeniero de redes aquí.*\n\nPuedo analizar tu MikroTik, encontrar problemas, y darte soluciones paso a paso. Prueba:\n\n• "Analiza mi red"\n• "¿Mi firewall está seguro?"\n• "¿Por qué está lento?"\n• "Necesito VPN"\n\n¿En qué te ayudo?`,
  ];
  return greetings[Math.floor(Math.random() * greetings.length)];
}

function getIdentity(): string {
  return `🤖 *Soy tu Agente de Redes MikroTik*\n\nSoy un sistema experto especializado en redes MikroTik RouterOS. Tengo conocimiento de:\n\n• 🔥 Firewall y seguridad\n• ⚡ Optimización de rendimiento\n• 📊 Administración de ISP\n• 🔧 Mantenimiento y troubleshooting\n• 🌐 Configuraciones avanzadas\n\nNo necesito internet para funcionar. Analizo tu router directamente y te doy soluciones basadas en años de experiencia con MikroTik.\n\n¿Qué necesitas?`;
}

function getHelp(): string {
  return `📋 *¿Qué puedo hacer por ti?*\n\n🔍 *Análisis:*\n• "Analiza mi red" — diagnóstico completo\n• "Revisa el firewall" — solo seguridad\n• "¿Por qué está lento?" — rendimiento\n• "Revisa las colas" — clientes y velocidad\n\n🔧 *Configuración:*\n• "Necesito VPN" — acceso remoto seguro\n• "¿Cómo hago backup?" — respaldo\n• "Configura DNS" — resolución de nombres\n• "Balanceo de WANs" — dos internet\n\n📡 *ISP:*\n• "Clientes sin cola" — sin límite\n• "DHCP agotado" — sin IPs\n• "Colas desactivadas" — pendientes\n\n🔒 *Seguridad:*\n• "Puertos abiertos" — vulnerabilidades\n• "¿SSH seguro?" — acceso remoto\n• "DNS abierto" — ataques DDoS\n\nSimplemente escribe tu pregunta en lenguaje natural.`;
}

function analyzeByTopic(topic: string, ctx: Context): string {
  const relevant = ctx.findings.filter((f) => {
    const cat = f.category.toLowerCase();
    const issue = f.issue.toLowerCase();
    switch (topic) {
      case "firewall": return cat.includes("firewall") || cat.includes("seguridad");
      case "performance": return cat.includes("sistema") || cat.includes("rendimiento");
      case "memory": return cat.includes("sistema") && issue.includes("ram");
      case "queues": return cat.includes("isp") || cat.includes("cola");
      case "dhcp": return cat.includes("isp") && (issue.includes("dhcp") || issue.includes("pool") || issue.includes("lease"));
      case "dns": return issue.includes("dns") || cat.includes("red");
      case "nat": return issue.includes("nat");
      case "routes": return issue.includes("ruta") || issue.includes("gateway");
      case "interfaces": return cat.includes("interface") || cat.includes("puerto");
      case "antennas": return cat.includes("antena");
      case "logs": return cat.includes("mantenimiento") && issue.includes("log");
      default: return true;
    }
  });

  if (relevant.length > 0) {
    const { formatFindings } = require("@/lib/network-analyzer");
    return formatFindings(relevant);
  }

  const knowledge = searchKnowledge(topic);
  if (knowledge.length > 0) {
    const top = knowledge[0];
    let msg = `📖 *${top.title}*\n\n`;
    msg += `${top.explanation}\n\n`;
    msg += `🔧 *Solución:*\n${top.solution}\n\n`;
    if (top.commands.length > 0) {
      msg += `📋 *Comandos:*\n`;
      top.commands.forEach((cmd) => { msg += `\`${cmd}\`\n`; });
      msg += `\n`;
    }
    if (top.tips.length > 0) {
      msg += `💡 *Consejos:*\n`;
      top.tips.forEach((tip) => { msg += `• ${tip}\n`; });
    }
    return msg;
  }

  return `No encontré información específica sobre "${topic}". Prueba con:\n• "Analiza mi red" para un diagnóstico completo\n• "firewall", "cpu", "colas", "dns" para temas específicos`;
}

function getRecommendations(ctx: Context): string {
  const recs: string[] = [];

  if (ctx.config.system) {
    const cpu = parseInt(ctx.config.system.cpuLoad || "0", 10);
    if (cpu > 0 && cpu < 30) {
      recs.push("✅ Tu CPU está estable. Buen trabajo.");
    }
    if (cpu > 70) {
      recs.push("⚠️ CPU elevado. Revisa FastTrack y connection tracking.");
    }
  }

  if (ctx.config.firewallRules.length > 0) {
    const hasFastTrack = ctx.config.firewallRules.some((r) => r.action === "fasttrack-connection");
    if (hasFastTrack) {
      recs.push("✅ FastTrack configurado correctamente.");
    }
  }

  const activeQueues = ctx.config.simpleQueues.filter((q) => {
    const rate = q.rate || "0/0";
    const parts = rate.split("/");
    return parseInt(parts[0] || "0", 10) > 0 || parseInt(parts[1] || "0", 10) > 0;
  });

  if (activeQueues.length > 0) {
    recs.push(`✅ ${activeQueues.length} clientes con tráfico activo.`);
  }

  if (recs.length === 0) {
    return "";
  }

  return `\n📊 *Puntos positivos:*\n${recs.join("\n")}`;
}

export function processMessage(input: string, ctx: Context): string {
  const { intent, topic } = understandIntent(input);

  switch (intent) {
    case "greeting":
      return getGreeting();

    case "identity":
      return getIdentity();

    case "help":
      return getHelp();

    case "thanks":
      return `😊 ¡De nada! Estoy aquí para lo que necesites.\n\nSi tienes más dudas o quieres que revise algo, solo pregúntame.`;

    case "analyze": {
      const response = analyzeByTopic(topic, ctx);
      const recs = getRecommendations(ctx);
      return response + recs;
    }

    case "topic": {
      return analyzeByTopic(topic, ctx);
    }

    case "howto": {
      const knowledge = searchKnowledge(topic);
      if (knowledge.length > 0) {
        const top = knowledge[0];
        let msg = `📖 *${top.title}*\n\n`;
        msg += `Paso a paso:\n\n${top.solution}\n\n`;
        if (top.commands.length > 0) {
          msg += `📋 Ejecuta estos comandos:\n`;
          top.commands.forEach((cmd, i) => {
            msg += `${i + 1}. \`${cmd}\`\n`;
          });
        }
        if (top.tips.length > 0) {
          msg += `\n💡 Recuerda:\n`;
          top.tips.forEach((tip) => { msg += `• ${tip}\n`; });
        }
        return msg;
      }
      return analyzeByTopic("full", ctx);
    }

    default:
      return analyzeByTopic("full", ctx);
  }
}
