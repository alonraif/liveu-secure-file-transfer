export function Notice({
  message,
  tone = "neutral"
}: {
  message?: string | null;
  tone?: "neutral" | "success" | "danger";
}) {
  if (!message) {
    return null;
  }

  return <div className={`notice notice-${tone}`}>{message}</div>;
}
