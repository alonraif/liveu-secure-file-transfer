export function formatDateTime(value?: Date | string | null) {
  if (!value) {
    return "Not available";
  }

  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

export function formatBytes(value?: bigint | number | null) {
  if (value === null || value === undefined) {
    return "0 B";
  }

  const bytes = typeof value === "bigint" ? Number(value) : value;
  if (bytes === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const amount = bytes / 1024 ** exponent;
  return `${amount.toFixed(amount >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

export function sentenceCase(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatNoticeMessage(value: string) {
  return /^[a-z0-9_]+$/i.test(value) ? sentenceCase(value) : value;
}
