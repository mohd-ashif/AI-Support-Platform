/**
 * Centralized Formatting Utilities for SupportAI Platform
 * Uses Intl.NumberFormat and Intl.DateTimeFormat for consistent formatting across all pages.
 */

/**
 * Formats monetary amounts. Accepts either cents or dollar values.
 * e.g., formatCurrency(2900) -> "$29", formatCurrency(29.99) -> "$29.99"
 */
export function formatCurrency(amountOrCents: number, isCents: boolean = true, currency: string = "USD"): string {
  if (amountOrCents === undefined || amountOrCents === null || isNaN(amountOrCents)) {
    return "$0";
  }

  const valueInDollars = isCents ? amountOrCents / 100 : amountOrCents;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: valueInDollars % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(valueInDollars);
}

/**
 * Formats integers and decimal numbers with thousands separators.
 * e.g., formatNumber(12500) -> "12,500"
 */
export function formatNumber(value: number, decimals: number = 0): string {
  if (value === undefined || value === null || isNaN(value)) {
    return "0";
  }

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Formats percentages with optional decimal precision.
 * e.g., formatPercentage(94.5) -> "94.5%"
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  if (value === undefined || value === null || isNaN(value)) {
    return "0%";
  }

  return `${value.toFixed(decimals)}%`;
}

/**
 * Formats ISO date string or Date object to readable date.
 * e.g., formatDate("2026-08-14T14:00:00Z") -> "Aug 14, 2026"
 */
export function formatDate(dateInput?: string | Date | number | null): string {
  if (!dateInput) return "—";

  try {
    const date = typeof dateInput === "object" ? dateInput : new Date(dateInput);
    if (isNaN(date.getTime())) return "—";

    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  } catch {
    return "—";
  }
}

/**
 * Formats ISO date string or Date object to readable date and time.
 * e.g., formatDateTime("2026-08-14T14:00:00Z") -> "Aug 14, 2026, 2:00 PM"
 */
export function formatDateTime(dateInput?: string | Date | number | null): string {
  if (!dateInput) return "—";

  try {
    const date = typeof dateInput === "object" ? dateInput : new Date(dateInput);
    if (isNaN(date.getTime())) return "—";

    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  } catch {
    return "—";
  }
}

/**
 * Formats file sizes in bytes to human-readable string.
 * e.g., formatBytes(2548500) -> "2.4 MB"
 */
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (!bytes || bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
