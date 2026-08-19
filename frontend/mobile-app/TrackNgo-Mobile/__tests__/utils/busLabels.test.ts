import { formatBusTypeLabel } from "../../utils/busLabels";

describe("formatBusTypeLabel", () => {
  /** Verifies the database identifiers never reach the screen as-is. */
  it("rewrites raw bus_type identifiers into readable labels", () => {
    expect(formatBusTypeLabel("long_distance")).toBe("Long Distance");
    expect(formatBusTypeLabel("highway")).toBe("Highway");
  });

  /** The same value arrives underscored, hyphenated and upper-cased. */
  it("tolerates the shapes the value arrives in", () => {
    expect(formatBusTypeLabel("LONG_DISTANCE")).toBe("Long Distance");
    expect(formatBusTypeLabel("long-distance")).toBe("Long Distance");
    expect(formatBusTypeLabel("  Highway ")).toBe("Highway");
  });

  /** Unknown identifiers still get title-cased rather than leaking. */
  it("title-cases identifiers it does not know", () => {
    expect(formatBusTypeLabel("semi_luxury")).toBe("Semi Luxury");
    expect(formatBusTypeLabel("corporate")).toBe("Corporate");
  });

  /** Summary screens fall back to labels already written for humans. */
  it("leaves already-readable labels untouched", () => {
    expect(formatBusTypeLabel("Super Luxury A/C")).toBe("Super Luxury A/C");
    expect(formatBusTypeLabel("Non-AC")).toBe("Non-AC");
  });

  /** A missing type renders as nothing rather than "undefined". */
  it("returns an empty string for missing values", () => {
    expect(formatBusTypeLabel("")).toBe("");
    expect(formatBusTypeLabel(null)).toBe("");
    expect(formatBusTypeLabel(undefined)).toBe("");
  });
});
