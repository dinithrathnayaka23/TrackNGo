/**
 * Height of the bottom tab bar's own content, before the system navigation inset.
 *
 * Screens inside the tab navigator need this to position content against the tab
 * bar — a chat composer avoiding the keyboard, for instance, has to know how much
 * of the screen bottom the bar already occupies. Kept here rather than in the tab
 * layout so both can import it without a route file having to export values.
 */
export const TAB_BAR_CONTENT_HEIGHT = 62;
