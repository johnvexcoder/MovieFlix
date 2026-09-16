import { format } from "date-fns";

// Format PHP currency from minor units (cents)
export function formatPHP(amountInMinorUnits: number): string {
  const amount = amountInMinorUnits / 100; // Convert from cents to PHP
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Format percentage with sign
export function formatPercentage(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

// Format date for display
export function formatDateDisplay(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return format(dateObj, "PPP"); // e.g., "Jan 15, 2024"
}

// Format date for chart tooltips
export function formatChartDate(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return format(dateObj, "PP"); // e.g., "Jan 15"
}

// Get range label for display
export function getRangeLabel(range: string): string {
  switch (range) {
    case "1m":
      return "1 Month";
    case "3m":
      return "3 Months";
    case "6m":
      return "6 Months";
    case "1y":
      return "1 Year";
    default:
      return range;
  }
}

// Get mobile range label for display
export function getMobileRangeLabel(range: string): string {
  switch (range) {
    case "1m":
      return "1M";
    case "3m":
      return "3M";
    case "6m":
      return "6M";
    case "1y":
      return "1Y";
    default:
      return range;
  }
}