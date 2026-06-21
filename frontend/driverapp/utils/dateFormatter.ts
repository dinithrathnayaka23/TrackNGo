/**
 * Format date string from ISO format (YYYY-MM-DD) to readable format (DD MMM YYYY)
 * @param dateString - ISO date string (e.g., "2025-12-31")
 * @returns Formatted date string (e.g., "31 Dec 2025") or "N/A" if invalid
 */
export const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return 'N/A';

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';

    const options: Intl.DateTimeFormatOptions = {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    };

    return date.toLocaleDateString('en-US', options);
  } catch {
    return 'N/A';
  }
};

/**
 * Check if a license is expired
 * @param expiryDate - ISO date string (e.g., "2025-12-31")
 * @returns true if expired, false otherwise
 */
export const isLicenseExpired = (expiryDate: string | null | undefined): boolean => {
  if (!expiryDate) return false;

  try {
    const expiry = new Date(expiryDate);
    const today = new Date();
    return expiry < today;
  } catch {
    return false;
  }
};
