import { sentenceCase } from "@/lib/format";

export function StatusBadge({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const tone =
    normalized.includes("active") || normalized.includes("downloaded") || normalized.includes("sent")
      ? "success"
      : normalized.includes("revoked") || normalized.includes("disabled") || normalized.includes("locked")
        ? "danger"
        : "neutral";

  return <span className={`status-badge status-${tone}`}>{sentenceCase(value)}</span>;
}
