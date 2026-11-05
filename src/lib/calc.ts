/* Fórmulas de Vortex. Las mismas reglas aprobadas en la arquitectura. */
import { r2, num, sum, todayLaPaz } from "./format";

export const suggested = (cost: number, pct: number) => r2(cost * (1 + pct / 100));
export const markupOf = (price: number, cost: number) => (cost > 0 ? ((price - cost) / cost) * 100 : null);
export const marginOf = (price: number, cost: number) => (price > 0 ? ((price - cost) / price) * 100 : null);
export const productMarkup = (p: any, s: any) =>
  p.markup === null || p.markup === undefined || p.markup === "" ? num(s?.defaultMarkup ?? 40) : num(p.markup);
export const productPrice = (p: any, s: any) =>
  p.pricingMode === "manual" ? r2(p.manualPrice) : suggested(num(p.refCost), productMarkup(p, s));

export const lineCalc = (l: any) => {
  const sub = r2(num(l.qty) * num(l.price));
  const disc = l.discType === "%" ? r2((sub * num(l.discVal)) / 100) : r2(Math.min(num(l.discVal), sub));
  return { sub, disc, total: r2(sub - disc), cost: r2(num(l.qty) * num(l.cost)) };
};

export const quoteTotals = (q: any) => {
  let prod = 0, serv = 0, hidden = 0, lineDisc = 0;
  let costProd = 0, costServ = 0, costExtra = 0;
  (q.items || []).forEach((l: any) => {
    const c = lineCalc(l);
    if (l.kind === "costo") { costExtra += c.cost; return; } // costos aparte: solo internos
    if (l.kind === "producto") costProd += c.cost; else costServ += c.cost;
    if (l.show) {
      if (l.kind === "producto") prod += c.total;
      else serv += c.total;
      lineDisc += c.disc;
    } else if (!l.distributed) hidden += c.total;
  });
  const base = r2(prod + serv);
  const gdisc = q.gDiscType === "%" ? r2((base * num(q.gDiscVal)) / 100) : r2(Math.min(num(q.gDiscVal), base));
  const total = r2(base - gdisc);
  const quoteCost = r2(costProd + costServ);
  const cost = r2(quoteCost + costExtra);
  return {
    prod: r2(prod), serv: r2(serv), base, lineDisc: r2(lineDisc), gdisc, total,
    costProd: r2(costProd), costServ: r2(costServ), quoteCost, costExtra: r2(costExtra), cost,
    profit: r2(total - cost), margin: marginOf(total, cost), markup: markupOf(total, cost), hidden: r2(hidden),
  };
};

/** Reparte el valor de los conceptos ocultos en las líneas visibles. */
export const distributeHidden = (q: any) => {
  const t = quoteTotals(q);
  if (t.hidden <= 0) return q;
  const vis = q.items.filter((l: any) => l.show && lineCalc(l).total > 0);
  const sumVis = vis.reduce((a: number, l: any) => a + lineCalc(l).total, 0);
  if (!sumVis) return q;
  const target = r2(t.base + t.hidden);
  const items = q.items.map((l: any) => {
    if (!l.show) return lineCalc(l).total > 0 ? { ...l, distributed: true } : l;
    const lt = lineCalc(l).total;
    if (lt <= 0) return { ...l };
    return { ...l, price: r2(num(l.price) + (t.hidden * lt) / sumVis / num(l.qty)), priceManual: true };
  });
  const nq = { ...q, items };
  const diff = r2(target - quoteTotals(nq).base);
  if (diff !== 0) {
    const last = [...items].reverse().find((l: any) => l.show && num(l.qty) > 0);
    if (last) last.price = r2(last.price + diff / num(last.qty));
  }
  return nq;
};

export const MOV: Record<string, { label: string; dir: number }> = {
  compra: { label: "Compra", dir: 1 },
  entrada_manual: { label: "Entrada manual", dir: 1 },
  salida_proyecto: { label: "Salida a proyecto", dir: -1 },
  devolucion_proyecto: { label: "Devolución de proyecto", dir: 1 },
  devolucion_proveedor: { label: "Devolución a proveedor", dir: -1 },
  ajuste_positivo: { label: "Ajuste positivo", dir: 1 },
  ajuste_negativo: { label: "Ajuste negativo", dir: -1 },
};
export const Q_STATUS: Record<string, [string, string]> = {
  borrador: ["Borrador", "b-gray"], enviada: ["Pendiente de respuesta", "b-amber"], aceptada: ["Aceptada", "b-green"], rechazada: ["Rechazada", "b-red"],
};
export const P_STATUS: Record<string, [string, string]> = {
  pendiente: ["Pendiente de iniciar", "b-gray"], programado: ["Programado", "b-blue"], en_ejecucion: ["En ejecución", "b-red"],
  pausado: ["Pausado", "b-amber"], finalizado: ["Finalizado", "b-green"], cancelado: ["Cancelado", "b-gray"],
};
export const T_STATUS: Record<string, [string, string]> = {
  disponible: ["Disponible", "b-green"], prestada: ["Prestada", "b-blue"], en_mantenimiento: ["En mantenimiento", "b-amber"],
  extraviada: ["Extraviada", "b-red"], de_baja: ["Dada de baja", "b-gray"],
};
export const SERVICE_KINDS = ["Mano de obra", "Instalación", "Configuración del sistema", "Transporte", "Alimentación", "Canalización", "Mantenimiento", "Otro"];
export const PAY_METHODS = ["Efectivo", "Transferencia", "QR", "Depósito", "Cheque", "Otro"];
export const ACTIVE_P = ["pendiente", "programado", "en_ejecucion", "pausado"];
export const isExpired = (q: any) => q.status === "enviada" && q.validUntil && q.validUntil < todayLaPaz();

export const stockOf = (db: any, pid: string) =>
  r2(db.movements.filter((m: any) => m.productId === pid).reduce((a: number, m: any) => a + MOV[m.type].dir * num(m.qty), 0));

export const netIssued = (db: any, projectId: string, pid: string) =>
  r2(db.movements.filter((m: any) => m.projectId === projectId && m.productId === pid)
    .reduce((a: number, m: any) => a + (m.type === "salida_proyecto" ? num(m.qty) : m.type === "devolucion_proyecto" ? -num(m.qty) : 0), 0));

export const committedOf = (db: any, pid: string) =>
  r2(db.projects.filter((p: any) => ACTIVE_P.includes(p.status)).reduce((a: number, p: any) => {
    const planned = p.items.filter((i: any) => i.productId === pid).reduce((x: number, i: any) => x + num(i.qty), 0);
    return a + Math.max(0, planned - netIssued(db, p.id, pid));
  }, 0));

export const projectFin = (db: any, p: any) => {
  const agreed = r2(sum(p.items.filter((i: any) => i.billable), (i) => lineCalc(i).total) - num(p.discountAmt));
  const budgetCost = sum(p.items, (i) => lineCalc(i).cost);
  const budgetProd = sum(p.items.filter((i: any) => i.kind === "producto"), (i) => lineCalc(i).cost);
  const budgetExtra = sum(p.items.filter((i: any) => i.kind === "costo"), (i) => lineCalc(i).cost);
  const budgetServ = r2(budgetCost - budgetProd - budgetExtra);
  const movs = db.movements.filter((m: any) => m.projectId === p.id);
  const matCost = sum(movs, (m) => (m.type === "salida_proyecto" ? num(m.qty) * num(m.unitCost) : m.type === "devolucion_proyecto" ? -num(m.qty) * num(m.unitCost) : 0));
  const exps = db.expenses.filter((e: any) => e.projectId === p.id && e.status !== "anulado");
  const expCost = sum(exps, "amount");
  const pis = db.projectInstallers.filter((x: any) => x.projectId === p.id);
  const instCost = sum(pis, "agreed");
  const instPaid = sum(db.installerPayments.filter((x: any) => x.status !== "anulado" && pis.some((i: any) => i.id === x.projectInstallerId)), "amount");
  const collected = sum(db.payments.filter((x: any) => x.projectId === p.id && x.status !== "anulado"), "amount");
  const expPaid = sum(exps.filter((e: any) => e.status === "pagado"), "amount");
  const directPurch = sum(db.purchases.filter((x: any) => x.destination === "proyecto" && x.projectId === p.id && x.status === "pagada"), "total");
  const realCost = r2(matCost + expCost + instCost);
  const cashOut = r2(expPaid + instPaid + directPurch);
  return {
    agreed, budgetCost, budgetProd, budgetServ, budgetExtra, estProfit: r2(agreed - budgetCost), matCost, expCost, instCost, instPaid, instPending: r2(instCost - instPaid),
    realCost, realResult: r2(agreed - realCost), collected, pendingCollect: r2(agreed - collected), expPaid, directPurch, cashOut,
    cashFlow: r2(collected - cashOut), estMargin: marginOf(agreed, budgetCost), realMargin: marginOf(agreed, realCost),
  };
};

export const cashEvents = (db: any) => {
  const ev: any[] = [];
  const pc = (pid: string) => db.projects.find((p: any) => p.id === pid)?.companyId || null;
  db.payments.filter((x: any) => x.status !== "anulado").forEach((x: any) =>
    ev.push({ date: x.date, dir: 1, amount: num(x.amount), projectId: x.projectId, companyId: pc(x.projectId), cat: "Cobro" }));
  db.expenses.filter((x: any) => x.status === "pagado").forEach((x: any) =>
    ev.push({ date: x.paidDate || x.date, dir: -1, amount: num(x.amount), projectId: x.projectId, companyId: pc(x.projectId), cat: x.category }));
  db.installerPayments.filter((x: any) => x.status !== "anulado").forEach((x: any) => {
    const pi = db.projectInstallers.find((i: any) => i.id === x.projectInstallerId);
    ev.push({ date: x.date, dir: -1, amount: num(x.amount), projectId: pi?.projectId, companyId: pc(pi?.projectId), cat: "Instaladores" });
  });
  db.purchases.filter((x: any) => x.status === "pagada").forEach((x: any) =>
    ev.push({ date: x.paidDate || x.date, dir: -1, amount: num(x.total), projectId: x.projectId, companyId: pc(x.projectId), cat: x.destination === "proyecto" ? "Compra directa a proyecto" : "Compra de inventario" }));
  return ev;
};

/* Orden de las líneas: primero equipos y materiales, luego servicios y al final los costos aparte. */
const GROUP: Record<string, number> = { producto: 0, servicio: 1, costo: 2 };
export const orderedItems = (items: any[]) =>
  (items || []).map((l, i) => ({ l, i })).sort((a, b) => (GROUP[a.l.kind] ?? 1) - (GROUP[b.l.kind] ?? 1) || a.i - b.i).map((x) => x.l);

/* Tamaños de papel disponibles para el PDF */
export const PAPER: Record<string, { label: string; pdf: any; css: string; px: number }> = {
  carta: { label: "Carta (8,5 × 11 pulg.)", pdf: "LETTER", css: "8.5in 11in", px: 816 },
  oficio: { label: "Oficio (8,5 × 13 pulg.)", pdf: [612, 936], css: "8.5in 13in", px: 816 },
  a4: { label: "A4 (21 × 29,7 cm)", pdf: "A4", css: "210mm 297mm", px: 794 },
};
export const paperOf = (q: any) => PAPER[q?.paperSize] || PAPER.carta;
