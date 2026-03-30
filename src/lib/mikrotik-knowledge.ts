export interface KnowledgeEntry {
  keywords: string[];
  title: string;
  explanation: string;
  solution: string;
  commands: string[];
  tips: string[];
}

export const mikrotikKnowledge: KnowledgeEntry[] = [
  {
    keywords: ["firewall", "vacio", "abierto", "sin reglas", "sin firewall"],
    title: "Tu router está completamente abierto",
    explanation: "Imagina que tu casa no tiene puerta. Cualquiera puede entrar, tomar lo que quiera y hacer lo que quiera. Eso es exactamente lo que pasa con tu router sin firewall. Cada puerto está expuesto a internet, y cualquier persona del mundo puede intentar conectarse a tus servicios internos.",
    solution: "Necesitas al menos dos reglas básicas para proteger tu router. La primera permite las conexiones que tú iniciaste (como cuando navegas en internet). La segunda bloquea todo lo demás.",
    commands: [
      "/ip firewall filter add chain=input connection-state=established,related action=accept comment=\"Permitir conexiones activas\"",
      "/ip firewall filter add chain=input action=drop comment=\"Bloquear todo lo demás\""
    ],
    tips: [
      "Siempre agrega la regla de established ANTES de la regla drop",
      "Si bloqueas todo sin establecer conexiones, pierdes acceso al router",
      "Usa Winbox o consola física para aplicar estas reglas"
    ]
  },
  {
    keywords: ["drop", "input", "final", "bloquear"],
    title: "Falta la regla de cierre en el firewall",
    explanation: "Tu firewall tiene reglas pero ninguna que diga 'bloquear todo lo que no coincida'. Es como tener un guardia de seguridad que revisa ciertas personas pero deja pasar a todos los demás sin preguntar. La regla drop al final es tu última línea de defensa.",
    solution: "Agrega una regla al final de la cadena input que bloquee todo. Esta regla siempre debe ser la ÚLTIMA.",
    commands: [
      "/ip firewall filter add chain=input action=drop comment=\"Drop final\" place-before=0"
    ],
    tips: [
      "El orden de las reglas importa: MikroTik las evalúa de arriba a abajo",
      "La regla drop SIEMPRE va al final",
      "Puedes usar 'place-before' para posicionar reglas"
    ]
  },
  {
    keywords: ["winbox", "8291", "puerto winbox"],
    title: "Winbox expuesto a internet",
    explanation: "Winbox es tu herramienta de administración. Si está abierto al público, cualquier persona del mundo puede intentar conectarse. Los atacantes usan bots que buscan routers MikroTik con Winbox abierto para intentar adivinar contraseñas. MikroTik ha tenido vulnerabilidades en Winbox en el pasado que permitían acceso sin contraseña.",
    solution: "Restringe Winbox solo a tu red local o a IPs específicas. Nunca dejes Winbox abierto al mundo.",
    commands: [
      "/ip firewall filter add chain=input protocol=tcp dst-port=8291 src-address=192.168.0.0/16 action=accept comment=\"Winbox solo local\"",
      "/ip firewall filter add chain=input protocol=tcp dst-port=8291 action=drop comment=\"Bloquear Winbox público\""
    ],
    tips: [
      "Si necesitas acceso remoto, usa VPN en vez de abrir Winbox",
      "Cambia el puerto por defecto no es suficiente (security by obscurity)",
      "Revisa los logs regularmente para detectar intentos de acceso"
    ]
  },
  {
    keywords: ["ssh", "22", "puerto ssh"],
    title: "SSH accesible públicamente",
    explanation: "SSH es más seguro que Telnet pero aún así, dejarlo abierto al público significa que bots de todo el mundo intentarán adivinar tu contraseña por fuerza bruta. Pueden intentar miles de combinaciones por segundo.",
    solution: "Restringe SSH a IPs conocidas o usa VPN. También puedes usar port knocking o fail2ban equivalente.",
    commands: [
      "/ip firewall filter add chain=input protocol=tcp dst-port=22 src-address-list=allowed-ips action=accept",
      "/ip firewall filter add chain=input protocol=tcp dst-port=22 action=drop",
      "/ip firewall address-list add list=allowed-ips address=TU_IP_PUBLICA"
    ],
    tips: [
      "Usa llaves SSH en vez de contraseñas cuando sea posible",
      "Cambia el puerto SSH (aunque esto no es seguridad real)",
      "Monitorea los logs de intentos de acceso fallidos"
    ]
  },
  {
    keywords: ["dns", "resolver", "dns abierto", "dns publico", "amplificacion"],
    title: "DNS resolver abierto al público",
    explanation: "Si tu router responde consultas DNS a cualquiera en internet, los atacantes lo usan para ataques de amplificación DDoS. Envían una consulta pequeña con la IP de la víctima como remitente, y tu router responde con una respuesta grande a la víctima. Tu router se convierte en cómplice involuntario de ataques DDoS.",
    solution: "Desactiva las solicitudes remotas de DNS o restringe el acceso solo a tu red local.",
    commands: [
      "/ip dns set allow-remote-requests=no",
      "/ip firewall filter add chain=input protocol=udp dst-port=53 src-address=192.168.0.0/16 action=accept comment=\"DNS solo local\"",
      "/ip firewall filter add chain=input protocol=udp dst-port=53 action=drop comment=\"Bloquear DNS público\""
    ],
    tips: [
      "Si necesitas DNS para clientes, usa un DNS server separado",
      "Monitorea el tráfico DNS saliente para detectar anomalías",
      "Considera usar DNS over HTTPS para mayor privacidad"
    ]
  },
  {
    keywords: ["telnet", "23", "telnet abierto"],
    title: "Telnet habilitado",
    explanation: "Telnet es un protocolo antiguo que envía TODO en texto plano, incluyendo tu contraseña. Cualquiera que intercepte el tráfico puede ver tus credenciales. No hay ninguna razón para usar Telnet en 2026.",
    solution: "Desactiva Telnet inmediatamente y usa SSH o Winbox.",
    commands: [
      "/ip service disable telnet",
      "/ip service set ssh port=22"
    ],
    tips: [
      "Nunca uses Telnet, ni siquiera en red local",
      "SSH es el reemplazo seguro de Telnet",
      "Desactiva también FTP si no lo usas: /ip service disable ftp"
    ]
  },
  {
    keywords: ["fasttrack", "fast track", "rendimiento", "lento", "cpu alto"],
    title: "FastTrack no configurado",
    explanation: "Sin FastTrack, cada paquete de cada conexión pasa por el CPU del router. Con FastTrack, una vez que la conexión se establece, los paquetes siguientes van directo sin procesamiento de firewall. La diferencia puede ser del 1000% en rendimiento. Es como tener un carril exprés en una autopista: los carros que ya pasaron el peaje van directo sin volver a parar.",
    solution: "Agrega reglas FastTrack para conexiones establecidas y relacionadas. Esto mejora el rendimiento dramáticamente.",
    commands: [
      "/ip firewall filter add chain=forward connection-state=established,related action=fasttrack-connection comment=\"FastTrack\"",
      "/ip firewall filter add chain=output connection-state=established,related action=fasttrack-connection"
    ],
    tips: [
      "FastTrack requiere que la regla established esté ANTES",
      "No todos los routers soportan FastTrack (RB750, RB951, etc. sí)",
      "FastTrack y queues simples no siempre funcionan juntos"
    ]
  },
  {
    keywords: ["connection tracking", "tabla de conexiones", "conexiones", "tracking"],
    title: "Tabla de conexiones llena o cerca del límite",
    explanation: "El router mantiene una tabla de todas las conexiones activas. Si esta tabla se llena, nuevas conexiones no pueden establecerse y la red se cae. Esto pasa especialmente con muchos clientes o sin FastTrack.",
    solution: "Habilita FastTrack para reducir conexiones en la tabla. También puedes aumentar el límite de connection tracking.",
    commands: [
      "/ip firewall connection tracking set max-entries=100000",
      "/ip firewall filter add chain=forward connection-state=established,related action=fasttrack-connection"
    ],
    tips: [
      "Monitorea con /ip firewall connection print count",
      "Sin FastTrack, cada conexión de cada cliente se trackea",
      "Con FastTrack, solo las conexiones nuevas se procesan por CPU"
    ]
  },
  {
    keywords: ["cpu", "procesador", "alta carga", "100%", "sobrecarga"],
    title: "CPU del router muy alta",
    explanation: "CPU alta significa que el router no puede procesar todo el tráfico. Las causas más comunes son: firewall denso sin FastTrack, demasiadas colas, un ataque DDoS, o un proceso interno consumiendo recursos. Cuando el CPU llega al 100%, los paquetes se descartan y la red se vuelve inutilizable.",
    solution: "Primero identifica qué consume CPU con /tool profile. Luego optimiza según el caso.",
    commands: [
      "/tool profile duration=5s",
      "/ip firewall connection print count-only",
      "/queue simple print stats"
    ],
    tips: [
      "Si es firewall: agrega FastTrack",
      "Si es colas: reduce el número de colas o usa queue tree",
      "Si es connection tracking: aumenta el límite o agrega FastTrack"
    ]
  },
  {
    keywords: ["ram", "memoria", "memoria llena", "sin memoria"],
    title: "RAM del router casi agotada",
    explanation: "La RAM se usa para tablas de rutas, firewall, connection tracking, y buffers. Si se agota, el router puede reiniciarse o dejar de funcionar. Los routers con poca RAM (32MB, 64MB) son especialmente vulnerables.",
    solution: "Reduce reglas de firewall innecesarias, usa FastTrack, y revisa qué consume memoria.",
    commands: [
      "/system resource print",
      "/ip firewall filter print stats",
      "/ip firewall connection print count-only"
    ],
    tips: [
      "Cada regla de firewall consume memoria",
      "Las address-lists grandes consumen mucha memoria",
      "Considera actualizar el router si la RAM es insuficiente"
    ]
  },
  {
    keywords: ["nat", "sin nat", "no hay nat", "no navegan", "sin internet"],
    title: "Sin reglas NAT configuradas",
    explanation: "NAT (Network Address Translation) permite que dispositivos con IPs privadas (192.168.x.x) accedan a internet usando la IP pública del router. Sin NAT, tus clientes no pueden navegar aunque tengan IP y gateway correcto.",
    solution: "Agrega una regla NAT de source NAT (masquerade) en la interfaz que sale a internet.",
    commands: [
      "/ip firewall nat add chain=srcnat out-interface=ether1 action=masquerade comment=\"NAT principal\""
    ],
    tips: [
      "Masquerade es más lento que src-nat con IP fija",
      "Si tienes IP pública fija, usa src-nat en vez de masquerade",
      "Solo necesitas NAT para tráfico saliente (no entrante)"
    ]
  },
  {
    keywords: ["npt", "ntp", "hora", "fecha", "tiempo", "reloj"],
    title: "NTP no configurado — hora incorrecta",
    explanation: "Si el router tiene la hora incorrecta, los logs no son confiables, los leases DHCP pueden fallar, los certificados SSL pueden rechazarse, y las tareas programadas no funcionan correctamente. Es un problema silencioso que causa muchos dolores de cabeza.",
    solution: "Configura NTP para sincronizar la hora con servidores de tiempo públicos.",
    commands: [
      "/system ntp client set enabled=yes primary-ntp=200.160.0.8 secondary-ntp=200.189.40.8",
      "/system clock set time-zone-name=America/Caracas"
    ],
    tips: [
      "Usa servidores NTP de tu región para menor latencia",
      "La zona horaria es importante para logs y leases",
      "Verifica con /system clock print"
    ]
  },
  {
    keywords: ["colas", "queue", "desactivada", "sin limite", "velocidad"],
    title: "Colas de velocidad mal configuradas",
    explanation: "Las colas controlan cuánto ancho de banda puede usar cada cliente. Colas desactivadas significan que esos clientes no tienen límite y pueden consumir todo el ancho de banda. Colas sin límite son inútiles. Un cliente sin cola puede dejar a todos los demás sin internet.",
    solution: "Activa todas las colas y asigna límites de velocidad apropiados.",
    commands: [
      "/queue/simple enable [find]",
      "/queue/simple set [find name=\"CLIENTE\"] max-limit=10M/20M"
    ],
    tips: [
      "La sintaxis es SUBIDA/BAJADA (ej: 5M/20M = 5Mbps subida, 20Mbps bajada)",
      "Usa burst para permitir picos de velocidad temporal",
      "Revisa que ningún cliente tenga 0/0 como límite"
    ]
  },
  {
    keywords: ["dhcp", "pool", "ip agotada", "sin ip", "no asigna"],
    title: "Pool de DHCP agotado",
    explanation: "Si el rango de IPs del DHCP se agota, nuevos dispositivos no pueden conectarse a la red. Esto pasa cuando hay más dispositivos que IPs disponibles, o cuando leases viejos no se liberan.",
    solution: "Amplía el rango de DHCP o reduce el tiempo de lease para liberar IPs más rápido.",
    commands: [
      "/ip pool set [find name=dhcp_pool1] ranges=192.168.1.100-192.168.1.250",
      "/ip dhcp-server set [find name=dhcp1] lease-time=1h"
    ],
    tips: [
      "Usa un rango que no incluya la IP del router",
      "Lease time corto (1h) libera IPs más rápido",
      "Convierte clientes frecuentes a IP estática"
    ]
  },
  {
    keywords: ["arp", "duplicada", "conflicto ip", "dos mac", "spoofing"],
    title: "Conflicto de ARP — misma IP con diferentes MACs",
    explanation: "Cuando dos dispositivos tienen la misma IP, o alguien está haciendo ARP spoofing, la red se vuelve inestable. Los paquetes van a un lado o al otro aleatoriamente. Esto puede ser un error de configuración o un ataque deliberado.",
    solution: "Identifica los dispositivos involucrados y corrige la duplicación. Si es spoofing, usa ARP bindings estáticos.",
    commands: [
      "/ip arp print where address=192.168.1.X",
      "/ip arp add address=192.168.1.X mac-address=AA:BB:CC:DD:EE:FF interface=bridge1"
    ],
    tips: [
      "Usa DHCP estático para controlar las IPs",
      "ARP bindings estáticos previenen spoofing",
      "Revisa los logs para detectar cambios de ARP"
    ]
  },
  {
    keywords: ["puertos", "interface", "cable", "crc", "errores", "colisiones"],
    title: "Errores en interfaces de red",
    explanation: "Errores CRC significan que los datos que llegan están corruptos, usualmente por cable dañado o mala terminación. Colisiones indican que el puerto está en half-duplex cuando debería ser full-duplex. Estos errores causan retransmisiones y pérdida de rendimiento.",
    solution: "Revisa los cables y fuerza full-duplex si es necesario.",
    commands: [
      "/interface ethernet monitor [find name=ether1] once",
      "/interface ethernet set [find name=ether1] full-duplex=yes speed=1Gbps"
    ],
    tips: [
      "Usa cables CAT5e o CAT6 para Gigabit",
      "Evita cables cerca de fuentes eléctricas (interferencia EMI)",
      "Si CRC sigue subiendo, reemplaza el cable"
    ]
  },
  {
    keywords: ["proxy", "socks", "3128", "1080"],
    title: "Proxy o SOCKS abierto al público",
    explanation: "Un proxy abierto puede ser usado por cualquiera para navegar anónimamente a través de tu router. Los atacantes los buscan activamente para usarlos como relay en actividades ilegales. Tu IP aparecerá como origen de esas actividades.",
    solution: "Desactiva el proxy y SOCKS si no los usas. Si los usas, restringe el acceso.",
    commands: [
      "/ip proxy set enabled=no",
      "/ip socks set enabled=no",
      "/ip firewall filter add chain=input protocol=tcp dst-port=3128 action=drop",
      "/ip firewall filter add chain=input protocol=tcp dst-port=1080 action=drop"
    ],
    tips: [
      "Si necesitas proxy, úsalo solo en red local",
      "Monitorea el tráfico de estos puertos",
      "Muchos ISPs bloquean estos puertos automáticamente"
    ]
  },
  {
    keywords: ["rutas", "gateway", "default route", "sin ruta", "no hay internet"],
    title: "Sin ruta por defecto o gateway inalcanzable",
    explanation: "La ruta por defecto (0.0.0.0/0) le dice al router a dónde enviar el tráfico que no es de la red local. Sin ella, el router no sabe cómo llegar a internet. Si el gateway está caído, el router tiene la ruta pero no puede usarla.",
    solution: "Verifica que la ruta por defecto existe y que el gateway es alcanzable.",
    commands: [
      "/ip route print where dst-address=0.0.0.0/0",
      "/ping 8.8.8.8",
      "/ip route add dst-address=0.0.0.0/0 gateway=IP_DEL_GATEWAY"
    ],
    tips: [
      "Si tienes múltiples WANs, usa routing rules para balanceo",
      "Usa check-gateway=ping para detectar gateways caídos",
      "Agrega rutas de respaldo con mayor distancia"
    ]
  },
  {
    keywords: ["hotspot", "captive portal", "login"],
    title: "Configuración de Hotspot",
    explanation: "Hotspot crea un portal cautivo donde los usuarios deben autenticarse antes de navegar. Es útil para cafeterías, hoteles y espacios públicos. Requiere configuración de perfiles de usuario, páginas de login, y reglas de firewall.",
    solution: "Configura hotspot con perfiles de velocidad y usuarios.",
    commands: [
      "/ip hotspot setup",
      "/ip hotspot user add name=cliente password=1234 profile=default",
      "/ip hotspot profile set [find default] shared-users=1 rate-limit=5M/10M"
    ],
    tips: [
      "Usa HTTPS para la página de login",
      "Configura session-timeout para liberar IPs",
      "Usa walled-gateway para permitir acceso a ciertos sitios sin login"
    ]
  },
  {
    keywords: ["scheduler", "script", "tarea", "programada", "automatizacion"],
    title: "Tareas programadas y scripts",
    explanation: "Los schedulers ejecutan scripts automáticamente en intervalos definidos. Son útiles para backups automáticos, reinicios programados, y monitoreo. Pero un scheduler mal configurado puede causar problemas o ser usado como puerta trasera.",
    solution: "Revisa todos los schedulers activos y sus scripts. Elimina los que no reconozcas.",
    commands: [
      "/system scheduler print",
      "/system script print",
      "/system scheduler remove [find name=SOSPECHOSO]"
    ],
    tips: [
      "Revisa la política de cada scheduler",
      "Los schedulers con política 'password' o 'sensitive' son sospechosos",
      "Usa schedulers para backups automáticos diarios"
    ]
  },
  {
    keywords: ["backup", "export", "copiar", "guardar configuracion"],
    title: "Realizar backup de la configuración",
    explanation: "Un backup te salva cuando algo sale mal. Puedes exportar la configuración completa o hacer un backup binario. El export genera comandos RouterOS que puedes ejecutar para restaurar. El backup binario restaura exactamente el estado del router.",
    solution: "Haz backup regularmente y guárdalo fuera del router.",
    commands: [
      "/export file=backup-fecha",
      "/system backup save name=backup-fecha",
      "/file print"
    ],
    tips: [
      "Haz backup antes de cualquier cambio importante",
      "El export es más portable que el backup binario",
      "Automatiza backups con un scheduler"
    ]
  },
  {
    keywords: ["actualizar", "update", "version", "routeros"],
    title: "Actualización de RouterOS",
    explanation: "Las actualizaciones de RouterOS corrigen vulnerabilidades y bugs. Mantener el router actualizado es fundamental para la seguridad. MikroTik libera actualizaciones regularmente.",
    solution: "Verifica la versión actual y actualiza si hay una nueva disponible.",
    commands: [
      "/system package update check-for-updates",
      "/system package update install"
    ],
    tips: [
      "Haz backup antes de actualizar",
      "Lee el changelog antes de actualizar",
      "En producción, prueba en un router de prueba primero"
    ]
  },
  {
    keywords: ["balanceo", "load balancing", "dos wan", "mwan", "dual wan"],
    title: "Balanceo de carga entre múltiples WANs",
    explanation: "Si tienes dos o más conexiones a internet, puedes balancear el tráfico entre ellas para mejor rendimiento y redundancia. Si una WAN cae, el tráfico pasa automáticamente a la otra.",
    solution: "Configura mangle rules para marcar conexiones y rutas por cada WAN.",
    commands: [
      "/ip firewall mangle add chain=output connection-mark=no-mark action=mark-connection new-connection-mark=wan1_conn out-interface=ether1",
      "/ip firewall mangle add chain=output connection-mark=no-mark action=mark-connection new-connection-mark=wan2_conn out-interface=ether2",
      "/ip route add gateway=IP_WAN1 routing-mark=wan1_route",
      "/ip route add gateway=IP_WAN2 routing-mark=wan2_route"
    ],
    tips: [
      "Usa PCC (Per Connection Classifier) para balanceo real",
      "Configura check-gateway=ping para failover",
      "Necesitas NAT para cada WAN"
    ]
  },
  {
    keywords: ["vpn", "pptp", "l2tp", "openvpn", "wireguard", "acceso remoto"],
    title: "Configurar VPN para acceso remoto seguro",
    explanation: "VPN crea un túnel cifrado entre tu dispositivo y el router. Es la forma más segura de acceder remotamente a tu red sin exponer servicios como Winbox o SSH a internet.",
    solution: "WireGuard es la mejor opción actual: rápido, seguro y fácil de configurar.",
    commands: [
      "/interface wireguard add listen-port=13231 name=wg1 private-key=\"GENERAR_CON_WIREGUARD\"",
      "/interface wireguard peers add interface=wg1 public-key=\"CLAVE_PUBLICA_CLIENTE\" allowed-address=10.0.0.2/32",
      "/ip address add address=10.0.0.1/24 interface=wg1",
      "/ip firewall filter add chain=input protocol=udp dst-port=13231 action=accept"
    ],
    tips: [
      "WireGuard es más rápido que OpenVPN",
      "Usa VPN en vez de abrir puertos de administración",
      "Cada usuario debe tener su propia llave"
    ]
  },
  {
    keywords: ["wifi", "inalambrico", "wireless", "señal", "interferencia"],
    title: "Problemas de WiFi",
    explanation: "Los problemas de WiFi más comunes son interferencia de vecinos, canales saturados, y potencia insuficiente. En 2.4GHz solo hay 3 canales limpios (1, 6, 11). En 5GHz hay más canales disponibles.",
    solution: "Escanea el espectro, cambia a un canal libre, y ajusta la potencia.",
    commands: [
      "/interface wireless scan wlan1 duration=10s",
      "/interface wireless set [find name=wlan1] channel=frequency mode=ap-bridge",
      "/interface wireless frequency-monitor wlan1 duration=10s"
    ],
    tips: [
      "En 2.4GHz usa solo canales 1, 6 u 11",
      "En 5GHz hay más canales y menos interferencia",
      "Reduce la potencia si hay muchos APs cerca"
    ]
  },
];

export function searchKnowledge(query: string): KnowledgeEntry[] {
  const queryLower = query.toLowerCase();
  const words = queryLower.split(/\s+/);

  return mikrotikKnowledge
    .map((entry) => {
      let score = 0;
      for (const keyword of entry.keywords) {
        for (const word of words) {
          if (keyword.includes(word) || word.includes(keyword)) {
            score += 2;
          }
        }
        if (queryLower.includes(keyword)) {
          score += 5;
        }
      }
      return { entry, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.entry);
}
