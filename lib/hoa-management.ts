export const money = (value: number | string | null | undefined) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value ?? 0));
export function today() { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
export function downloadCsv(filename: string, rows: (string | number | boolean | null | undefined)[][]) {
  const csv = rows.map(row => row.map(value => {
    let text = String(value ?? "");
    if (/^[\s]*[=+@-]|^[\t\r\n]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  }).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export type TreasuryEntry = { id: string; kind: "charge" | "payment"; category: string; amount: number; effective_date: string; payment_method: string | null; reference: string; note: string; created_at: string; voided_at: string | null; void_reason: string | null };
export type TreasuryProperty = { id: string; lot_number: number; street_address: string; total_owed: number; delinquent: number; prior_balance: number; dues: number; late_fee: number; lien_fee: number; interest: number; opening_balance: number; payments: number; year_balance: number; dues_remaining: number; assessed: boolean; entries: TreasuryEntry[] };
export type TreasuryYear = { year: number; annual_dues: number; late_fee: number; lien_fee: number; interest_rate: number; due_date: string; notes: string; updated_at: string };
export type TreasuryData = { year: number; settings: TreasuryYear | null; years: number[]; properties: TreasuryProperty[] };
export const paymentMethods = [{value:"check",label:"Check"},{value:"cash",label:"Cash"},{value:"ach",label:"ACH"},{value:"bank_transfer",label:"Bank transfer"},{value:"online",label:"Online payment"},{value:"money_order",label:"Money order"},{value:"other",label:"Other"}];
