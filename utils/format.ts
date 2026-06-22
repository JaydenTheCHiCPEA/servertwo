export function formatCurrency(amount: number, symbol = "$"): string {
  return `${symbol}${Math.abs(amount).toFixed(2)}`;
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

export function formatDateTime(dateStr: string): string {
  return `${formatDate(dateStr)} ${formatTime(dateStr)}`;
}

export function formatDuration(startStr: string, endStr?: string | null): string {
  const start = new Date(startStr).getTime();
  const end = endStr ? new Date(endStr).getTime() : Date.now();
  const ms = end - start;
  const hours = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  return `${hours}h ${mins}m`;
}

export function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
}

export function generateReceiptNumber(): string {
  const date = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `RCP-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${Math.floor(Math.random() * 9000) + 1000}`;
}
