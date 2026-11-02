/* Utilidades de formato y números (moneda en bolivianos). */
export const todayLaPaz = (): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/La_Paz", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export const r2 = (n: any): number => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
const nf = new Intl.NumberFormat("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtBs = (n: any): string => "Bs " + nf.format(r2(n));
export const fmtPct = (n: any): string =>
  n === null || n === undefined || !isFinite(n) ? "—" : new Intl.NumberFormat("es-BO", { maximumFractionDigits: 1 }).format(n) + " %";
export const fmtQty = (n: any): string => new Intl.NumberFormat("es-BO", { maximumFractionDigits: 3 }).format(Number(n || 0));
export const fmtDate = (d?: string | null): string =>
  d ? new Date(d.slice(0, 10) + "T12:00:00").toLocaleDateString("es-BO", { day: "2-digit", month: "short", year: "numeric" }) : "—";
export const fmtDateTime = (d?: string | null): string =>
  d ? new Date(d).toLocaleString("es-BO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
export const addDays = (d: string, n: number): string => {
  const x = new Date(d + "T12:00:00");
  x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10);
};
export const num = (v: any): number => (v === "" || v === null || v === undefined || isNaN(Number(v)) ? 0 : Number(v));
export const sum = (arr: any[], f: string | ((x: any) => number)): number =>
  r2(arr.reduce((a, x) => a + (typeof f === "function" ? f(x) : Number(x[f] || 0)), 0));
export const newId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c: any) => (c ^ (Math.random() * 16) >> (c / 4)).toString(16));
