export function formatDateTime(value: string | Date | number | null | undefined) {
  if (value == null) return "-";
  const date = typeof value === "string" || typeof value === "number" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "-";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

export function formatRelative(value: string | Date | number | null | undefined) {
  if (value == null) return "-";
  const ts = typeof value === "number" ? value : typeof value === "string" ? new Date(value).getTime() : value.getTime();
  if (!Number.isFinite(ts)) return "-";
  const diff = Date.now() - ts;
  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`;
  return formatDateTime(value);
}

export function formatNumber(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "-";
  return value.toLocaleString();
}

export function formatDuration(ms: number) {
  if (!Number.isFinite(ms)) return "-";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function maskPhone(phone: string) {
  if (!phone) return "";
  if (phone.length <= 4) return phone;
  return `${phone.slice(0, phone.length - 4)}****`;
}
