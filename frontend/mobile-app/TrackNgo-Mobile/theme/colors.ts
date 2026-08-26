/**
 * TrackNGo mobile colour system.
 *
 * The passenger app's palette, extracted from every colour its app/, components/
 * and screens/ directories use, and
 * the reference for the driver app so the two halves of the product look like
 * one product. The driver app carries a byte-identical copy of these tokens —
 * the apps are separate Expo packages with no shared workspace, so the file is
 * duplicated rather than imported. Keep the two copies in sync.
 *
 * Use these tokens for any new colour instead of a raw hex.
 */

/** Brand blues. `primary` is the action colour: buttons, active tabs, links. */
export const brand = {
  primary: "#2F6BFF",
  deep: "#2563EB",
  accent: "#067BF9",
  tint: "#EAF2FF",
  /** Messaging accent: own bubbles, unread badges, typing indicator. */
  chat: "#1A73E8",
} as const;

/** Text colours, darkest to lightest. */
export const ink = {
  strongest: "#0F172A",
  strong: "#111827",
  base: "#1E293B",
  soft: "#1F2937",
  subtle: "#334155",
} as const;

/** Secondary text: captions, placeholders, disabled labels. */
export const muted = {
  base: "#64748B",
  light: "#94A3B8",
} as const;

/** Hairlines and dividers. */
export const border = {
  base: "#E2E8F0",
  strong: "#CBD5E1",
} as const;

/** Backgrounds, lightest to greyest. */
export const surface = {
  card: "#FFFFFF",
  soft: "#F8FAFC",
  muted: "#F1F5F9",
  sunken: "#F6F7F9",
} as const;

/** Status colours, each with the tint used behind it. */
export const status = {
  success: "#22C55E",
  successTint: "#DCFCE7",
  warning: "#F59E0B",
  warningTint: "#FEF3C7",
  danger: "#EF4444",
  dangerDeep: "#DC2626",
  dangerDark: "#991B1B",
  dangerTint: "#FEE2E2",
  /** Sign out - a destructive action, deliberately not the brand blue. */
  signOut: "#E53935",
} as const;

export const colors = { brand, ink, muted, border, surface, status } as const;
