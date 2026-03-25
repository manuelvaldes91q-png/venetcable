export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function formatUptime(uptime: string): string {
  return uptime;
}

export function calculateBandwidth(
  currentBytes: number,
  previousBytes: number,
  intervalSeconds: number
): number {
  if (previousBytes === 0 || intervalSeconds === 0) return 0;
  return (currentBytes - previousBytes) / intervalSeconds;
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "online":
      return "text-green-500";
    case "offline":
      return "text-red-500";
    default:
      return "text-yellow-500";
  }
}

export function getStatusDotColor(status: string): string {
  switch (status) {
    case "online":
      return "bg-green-500";
    case "offline":
      return "bg-red-500";
    default:
      return "bg-yellow-500";
  }
}
