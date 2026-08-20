import type { TextStyle } from "react-native";

/**
 * TrackNGo mobile type system.
 *
 * Every screen previously hardcoded its own font sizes, which left the same
 * element (a screen header, a section label, a card title) rendering at a
 * different size on nearly every page. All screens are now normalised against
 * the scale below — use these tokens for any new text instead of raw numbers.
 */

/** The only font sizes allowed in the app. Anything else is an inconsistency. */
export const fontSize = {
  micro: 10,
  caption: 11,
  label: 12,
  body: 13,
  bodyLg: 14,
  h4: 16,
  h3: 18,
  h2: 20,
  h1: 24,
  display: 28,
  hero: 32,
} as const;

/** The only font weights allowed in the app. */
export const fontWeight = {
  medium: "500",
  semibold: "600",
  bold: "700",
  heavy: "800",
} as const satisfies Record<string, TextStyle["fontWeight"]>;

/**
 * Semantic text roles. Prefer spreading these into a StyleSheet entry and
 * layering colour/spacing on top:
 *
 *   headerTitle: { ...type.screenTitle, color: "#1F2937" }
 */
export const type = {
  /** Big numeric emphasis: totals, payable amounts, avatar initials. */
  hero: { fontSize: fontSize.hero, fontWeight: fontWeight.heavy },
  /** Dashboard figures and success/amount displays. */
  display: { fontSize: fontSize.display, fontWeight: fontWeight.heavy },
  /** Full-page hero headings — auth screens, confirmation screens. */
  pageTitle: { fontSize: fontSize.h1, fontWeight: fontWeight.heavy },
  /** Prominent titles inside sheets and greetings. */
  titleLg: { fontSize: fontSize.h2, fontWeight: fontWeight.bold },
  /** Standard screen/app-bar title and modal title. */
  screenTitle: { fontSize: fontSize.h3, fontWeight: fontWeight.bold },
  /** Section headings and card titles. */
  sectionTitle: { fontSize: fontSize.h4, fontWeight: fontWeight.bold },
  /** Emphasised values inside cards. */
  valueStrong: { fontSize: fontSize.h4, fontWeight: fontWeight.heavy },
  /** Primary body copy and text inputs. */
  body: { fontSize: fontSize.bodyLg, fontWeight: fontWeight.medium },
  /** Body copy that needs emphasis. */
  bodyStrong: { fontSize: fontSize.bodyLg, fontWeight: fontWeight.semibold },
  /** Primary button labels. */
  button: { fontSize: fontSize.bodyLg, fontWeight: fontWeight.bold },
  /** Secondary copy, list rows, compact button labels. */
  secondary: { fontSize: fontSize.body, fontWeight: fontWeight.medium },
  /** Secondary copy that needs emphasis — detail values, row titles. */
  secondaryStrong: { fontSize: fontSize.body, fontWeight: fontWeight.semibold },
  /** Field labels and form section labels. */
  label: { fontSize: fontSize.label, fontWeight: fontWeight.semibold },
  /** All-caps / small section labels above inputs. */
  labelStrong: { fontSize: fontSize.label, fontWeight: fontWeight.bold },
  /** Metadata, timestamps, helper text. */
  caption: { fontSize: fontSize.caption, fontWeight: fontWeight.medium },
  /** Status badges and pills. */
  badge: { fontSize: fontSize.caption, fontWeight: fontWeight.bold },
  /** Smallest supported text — dense grid labels only. */
  micro: { fontSize: fontSize.micro, fontWeight: fontWeight.semibold },
} as const satisfies Record<string, TextStyle>;

export default type;
