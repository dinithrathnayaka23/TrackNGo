/**
 * Shared input-validation helpers for the admin auth screens (Login, Signup),
 * so the email/phone rules can't drift out of sync between the two forms the
 * way they had before this was extracted.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email)
}

export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/[^\d+]/g, '').replace('+', '')
  return /^\+?[\d\s()-]+$/.test(phone) && digits.length >= 10 && digits.length <= 15
}

/** Scores 0-5: length >= 8, and one each of uppercase, lowercase, digit, symbol. */
export function getPasswordStrength(password: string): number {
  let score = 0
  if (password.length >= 8) score += 1
  if (/[A-Z]/.test(password)) score += 1
  if (/[a-z]/.test(password)) score += 1
  if (/\d/.test(password)) score += 1
  if (/[^A-Za-z0-9]/.test(password)) score += 1
  return score
}
