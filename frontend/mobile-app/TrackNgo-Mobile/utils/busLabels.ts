/**
 * Turns the raw `bus_type` values the backend stores ("long_distance",
 * "highway") into text fit for the UI.
 *
 * The same field also carries already-readable values in places ("Super Luxury
 * A/C" is used as a fallback on the summary screens), so the formatter has to
 * be safe to apply to both: words that already contain a capital are left
 * exactly as they are, and only database-style identifiers get rewritten.
 */
export function formatBusTypeLabel(rawType?: string | null): string {
  const trimmed = (rawType ?? "").trim();
  if (!trimmed) return "";

  // Match the known keys first, tolerating the underscored, hyphenated and
  // upper-case shapes the value arrives in across different endpoints.
  const key = trimmed.toLowerCase().replace(/-/g, "_");
  if (key === "long_distance") return "Long Distance";
  if (key === "highway") return "Highway";

  // Hyphens are deliberately not split on, so "Non-AC" survives intact.
  return trimmed
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) =>
      /[A-Z]/.test(word) ? word : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
}
