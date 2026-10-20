/**
 * Formats a promise date or capacity days into a human-friendly lead time:
 * "Usually dispatched within X days"
 */
export function formatPromiseLeadTime(
  promiseDateStr?: string | null,
  capacityDays?: number | null
): string | null {
  if (typeof capacityDays === "number" && capacityDays > 0) {
    return `Usually dispatched within ${capacityDays} day${capacityDays === 1 ? "" : "s"}`;
  }
  if (!promiseDateStr) return null;

  const trimmed = String(promiseDateStr).trim();
  if (!trimmed) return null;

  let targetDate: Date | null = null;
  // Support DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    targetDate = new Date(year, month, day);
  } else {
    const isoDate = new Date(trimmed.includes("T") ? trimmed : `${trimmed}T00:00:00`);
    if (!isNaN(isoDate.getTime())) {
      targetDate = isoDate;
    }
  }

  if (!targetDate || isNaN(targetDate.getTime())) return null;

  const now = new Date();
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const targetUtc = Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  const diffDays = Math.max(1, Math.round((targetUtc - todayUtc) / (1000 * 60 * 60 * 24)));

  return `Usually dispatched within ${diffDays} day${diffDays === 1 ? "" : "s"}`;
}

/**
 * Combines promise message (e.g. "Made to Order") with calculated lead time
 * so it displays e.g. "Made to Order · Usually dispatched within 10 days"
 * or "Usually dispatched within 10 days" without displaying raw DD-MM-YYYY dates.
 */
export function formatCustomerPromise(
  promiseMsg?: string | null,
  promiseDateStr?: string | null,
  capacityDays?: number | null
): string {
  const msg = (promiseMsg || "").trim();
  let days = capacityDays;
  if ((!days || days <= 0) && (msg.toLowerCase().includes("made to order") || msg.toLowerCase().includes("custom")) && !promiseDateStr) {
    days = 10;
  }
  const leadTime = formatPromiseLeadTime(promiseDateStr, days);

  // If the message already says "dispatched within", return it directly
  if (msg.toLowerCase().includes("dispatched within")) {
    return msg;
  }

  if (msg && leadTime) {
    return `${msg} · ${leadTime}`;
  }

  return leadTime || msg;
}
