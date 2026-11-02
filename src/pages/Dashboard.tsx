import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell } from "recharts";
import { AlertTriangle } from "lucide-react";
import { useApp } from "../data/store";
import { PageHead, Field, Inp, Sel, Kpi, Empty, toneOf } from "../components/ui";
import { fmtBs, fmtPct, fmtDate, addDays, sum, r2, todayLaPaz } from "../lib/format";
import { cashEvents, projectFin, stockOf, ACTIVE_P } from "../lib/calc";

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const PIE_COLORS = ["#08BFC5", "#7928CA", "#B76AF2", "#10142C", "#5A6079", "#D23B3B", "#1F8A55", "#9AA0C3"];

const rangeFor = (period: string, custom: any): [string, string] => {
  const today = todayLaPaz();
  const y = today.slice(0, 4), m = today.slice(5, 7);
  if (period === "hoy") return [today, today];
  if (period === "semana") {
    const d = new Date(today + "T12:00:00");
    const start = addDays(today, -((d.getDay() + 6) % 7));
    return [start, addDays(start, 6)];
  }
  if (period === "mes") {
    const last = new Date(Number(y), Number(m), 0).getDate();
    return [`${y}-${m}-01`, `${y}-${m}-${String(last).padStart(2, "0")}`];
  }
  if (period === "anio") return [`${y}-01-01`, `${y}-12-31`];
  return [custom.from || "2000-01-01", custom.to || "2100-12-31"];
};

export default function Dashboard() {
  const { db, go } = useApp();
  const today = todayLaPaz();
  const [period, setPeriod] = useState("mes");
  const [custom, setCustom] = useState({ from: today.slice(0, 8) + "01", to: today });
  const [projectId, setProjectId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [from, to] = rangeFor(period, custom);

  const data = useMemo(() => {
    const inR = (d?: string) => !!d && d >= from && d <= to;
    const scopeP = db.projects.filter((p: any) => (!projectId || p.id === projectId) && (!companyId || p.companyId === companyId));
    const ev = cashEvents(db).filter((e) => inR(e.date) && (!projectId || e.projectId === projectId) && (!companyId || e.companyId === companyId));
    const income = sum(ev.filter((e) => e.dir > 0), "amount"), out = sum(ev.filter((e) => e.dir < 0), "amount");
    const fins = scopeP.map((p: any) => ({ p, f: projectFin(db, p) }));
    const closed = fins.filter(({ p }: any) => p.status === "finalizado" && inR(p.actualEnd));
    const running = fins.filter(({ p }: any) => ACTIVE_P.includes(p.status));
    const scopeQ = db.quotations.filter((q: any) => !q.deletedAt && (!companyId || q.companyId === companyId) && (!projectId || q.projectId === projectId));
    const span = (new Date(to).getTime() - new Date(from).getTime()) / 864e5;
    const buckets: Record<string, any> = {};
    ev.forEach((e) => {
      const key = span <= 31 ? e.date : e.date.slice(0, 7);
      buckets[key] = buckets[key] || { k: key, Ingresos: 0, Gastos: 0 };
      if (e.dir > 0) buckets[key].Ingresos += e.amount;
      else buckets[key].Gastos += e.amount;
    });
    const series = Object.values(buckets).sort((a: any, b: any) => a.k.localeCompare(b.k)).map((b: any) => ({
      ...b, label: span <= 31 ? b.k.slice(8) + "/" + b.k.slice(5, 7) : MONTHS[Number(b.k.slice(5, 7)) - 1] + " " + b.k.slice(2, 4),
      Ingresos: r2(b.Ingresos), Gastos: r2(b.Gastos),
    }));
    const costDist: Record<string, number> = {};
    fins.filter(({ p }: any) => p.status !== "cancelado").forEach(({ p, f }: any) => {
      costDist["Materiales"] = (costDist["Materiales"] || 0) + f.matCost;
      costDist["Instaladores"] = (costDist["Instaladores"] || 0) + f.instCost;
      db.expenses.filter((e: any) => e.projectId === p.id && e.status !== "anulado").forEach((e: any) => {
        costDist[e.category] = (costDist[e.category] || 0) + Number(e.amount);
      });
    });
    const ranked = fins.filter(({ p }: any) => p.status !== "cancelado")
      .map(({ p, f }: any) => ({ name: p.code, full: p.name, Estimado: f.estProfit, Real: f.realResult, margin: f.realMargin, id: p.id }))
      .sort((a: any, b: any) => b.Real - a.Real);
    const toolsPending = db.toolAssignments.filter((a: any) => !a.returnedAt && a.expectedReturn && a.expectedReturn < today).length
      + db.tools.filter((t: any) => ["en_mantenimiento", "extraviada"].includes(t.status)).length;
    return {
      income, out, flow: r2(income - out),
      estClosed: sum(closed, ({ f }: any) => f.estProfit), realClosed: sum(closed, ({ f }: any) => f.realResult), closedCount: closed.length,
      provisional: sum(running, ({ f }: any) => f.realResult),
      pendingCollect: sum(fins.filter(({ p }: any) => p.status !== "cancelado"), ({ f }: any) => Math.max(0, f.pendingCollect)),
      instPending: sum(fins, ({ f }: any) => Math.max(0, f.instPending)),
      pActive: scopeP.filter((p: any) => ["en_ejecucion", "pausado"].includes(p.status)).length,
      pPending: scopeP.filter((p: any) => ["pendiente", "programado"].includes(p.status)).length,
      pDone: scopeP.filter((p: any) => p.status === "finalizado").length,
      qPending: scopeQ.filter((q: any) => q.status === "enviada").length,
      qAccepted: scopeQ.filter((q: any) => q.status === "aceptada" && inR(q.date)).length,
      qRejected: scopeQ.filter((q: any) => q.status === "rechazada" && inR(q.date)).length,
      lowStock: db.products.filter((p: any) => p.active && p.trackInventory && stockOf(db, p.id) <= Number(p.minStock)).length,
      toolsPending, series,
      costDist: Object.entries(costDist).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value: r2(value) })),
      ranked,
    };
  }, [db, from, to, projectId, companyId, today]);

  const tiles: [string, any, () => void][] = [
    ["Proyectos activos", data.pActive, () => go("proyectos")], ["Proyectos pendientes", data.pPending, () => go("proyectos")],
    ["Proyectos finalizados", data.pDone, () => go("proyectos")], ["Cotizaciones pendientes", data.qPending, () => go("cotizaciones")],
    ["Aceptadas / rechazadas", `${data.qAccepted} / ${data.qRejected}`, () => go("cotizaciones")],
    ["Productos con stock bajo", data.lowStock, () => go("almacen")], ["Herramientas por revisar", data.toolsPending, () => go("herramientas")],
  ];

  return (
    <div>
      <PageHead title="Dashboard" sub={projectId ? db.projects.find((p: any) => p.id === projectId)?.name : "Situación general del negocio"} />
      <div className="vx-card p-4 mb-5 flex flex-wrap items-end gap-3">
        <div><span className="vx-lbl">Período</span><div className="flex flex-wrap gap-2">
          {[["hoy", "Hoy"], ["semana", "Esta semana"], ["mes", "Este mes"], ["anio", "Este año"], ["custom", "Personalizado"]].map(([k, l]) =>
            <button key={k} className={`vx-pill ${period === k ? "on" : ""}`} onClick={() => setPeriod(k)}>{l}</button>)}
        </div></div>
        {period === "custom" && <div className="flex gap-2">
          <Field label="Desde"><Inp type="date" value={custom.from} onChange={(e: any) => setCustom({ ...custom, from: e.target.value })} /></Field>
          <Field label="Hasta"><Inp type="date" value={custom.to} onChange={(e: any) => setCustom({ ...custom, to: e.target.value })} /></Field>
        </div>}
        <Field label="Proyecto"><Sel value={projectId} onChange={(e: any) => setProjectId(e.target.value)} options={[{ value: "", label: "Todos los proyectos" }, ...db.projects.map((p: any) => ({ value: p.id, label: `${p.code} · ${p.name}` }))]} /></Field>
        <Field label="Empresa"><Sel value={companyId} onChange={(e: any) => setCompanyId(e.target.value)} options={[{ value: "", label: "Todas las empresas" }, ...db.companies.map((c: any) => ({ value: c.id, label: c.tradeName }))]} /></Field>
        <div className="vx-muted ml-auto" style={{ fontSize: 12 }}>{fmtDate(from)} – {fmtDate(to)}</div>
      </div>

      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,300px),1fr))" }}>
        <div className="vx-card vx-vf">
          <div className="vx-muted" style={{ fontSize: 12, fontWeight: 600 }}>Flujo de caja del período</div>
          <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-.02em", color: data.flow < 0 ? "var(--rec)" : "var(--ink)" }}>{fmtBs(data.flow)}</div>
          <div className="flex gap-5 mt-2 flex-wrap">
            <div><div className="vx-muted" style={{ fontSize: 12 }}>Ingresos cobrados</div><div style={{ fontWeight: 700, color: "var(--ok)" }}>{fmtBs(data.income)}</div></div>
            <div><div className="vx-muted" style={{ fontSize: 12 }}>Gastos pagados</div><div style={{ fontWeight: 700, color: "var(--rec)" }}>{fmtBs(data.out)}</div></div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Kpi k="Resultado estimado" v={fmtBs(data.estClosed)} hint={`${data.closedCount} proyecto(s) finalizado(s) en el período`} />
          <Kpi k="Resultado real" v={fmtBs(data.realClosed)} tone={toneOf(data.realClosed)} hint="Mismos proyectos finalizados" />
          <Kpi k="Por cobrar" v={fmtBs(data.pendingCollect)} hint="Saldo actual de clientes" />
          <Kpi k="Por pagar a instaladores" v={fmtBs(data.instPending)} hint={`Resultado provisional en curso: ${fmtBs(data.provisional)}`} />
        </div>
      </div>

      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(128px,1fr))" }}>
        {tiles.map(([k, v, fn]) => (
          <button key={k} onClick={fn} className="vx-card p-3 text-left" style={{ cursor: "pointer", fontFamily: "inherit" }}>
            <div className="vx-muted" style={{ fontSize: 12, fontWeight: 600 }}>{k}</div>
            <div className="flex items-center gap-2" style={{ fontSize: 20, fontWeight: 800 }}>{v}
              {(k.includes("stock") || k.includes("Herramientas")) && Number(v) > 0 && <AlertTriangle size={16} color="var(--amber)" />}</div>
          </button>
        ))}
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))" }}>
        <div className="vx-card p-4"><h3 className="mb-3">Ingresos y gastos</h3>
          {data.series.length ? <ResponsiveContainer width="100%" height={240}><BarChart data={data.series}><CartesianGrid strokeDasharray="3 3" stroke="#E6E7F0" /><XAxis dataKey="label" fontSize={11} /><YAxis fontSize={11} width={60} /><Tooltip formatter={(v: any) => fmtBs(v)} /><Legend /><Bar dataKey="Ingresos" fill="#08BFC5" radius={[3, 3, 0, 0]} /><Bar dataKey="Gastos" fill="#B76AF2" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer>
            : <Empty text="No hay movimientos de dinero en este período." />}
        </div>
        <div className="vx-card p-4"><h3 className="mb-3">Presupuesto frente a resultado real por proyecto</h3>
          {data.ranked.length ? <ResponsiveContainer width="100%" height={240}><BarChart data={data.ranked}><CartesianGrid strokeDasharray="3 3" stroke="#E6E7F0" /><XAxis dataKey="name" fontSize={11} /><YAxis fontSize={11} width={60} /><Tooltip formatter={(v: any) => fmtBs(v)} labelFormatter={(l: any, p: any) => p?.[0]?.payload?.full || l} /><Legend /><Bar dataKey="Estimado" fill="#B76AF2" radius={[3, 3, 0, 0]} /><Bar dataKey="Real" fill="#7928CA" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer>
            : <Empty text="No hay proyectos con este filtro." />}
        </div>
        <div className="vx-card p-4"><h3 className="mb-3">Distribución de costos reales</h3>
          {data.costDist.length ? <ResponsiveContainer width="100%" height={240}><PieChart><Pie data={data.costDist} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>{data.costDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><Tooltip formatter={(v: any) => fmtBs(v)} /><Legend wrapperStyle={{ fontSize: 12 }} /></PieChart></ResponsiveContainer>
            : <Empty text="Todavía no hay costos registrados." />}
        </div>
        <div className="vx-card p-4"><h3 className="mb-3">Rentabilidad por proyecto</h3>
          {data.ranked.length ? <div className="vx-scroll"><table className="vx-tbl"><thead><tr><th>Proyecto</th><th className="r">Resultado real</th><th className="r">Margen</th></tr></thead>
            <tbody>{data.ranked.map((r: any) => <tr key={r.id} className="click" onClick={() => go("proyecto", r.id)}><td><div style={{ fontWeight: 600 }}>{r.name}</div><div className="vx-muted" style={{ fontSize: 12 }}>{r.full}</div></td><td className="r" style={{ color: `var(--${toneOf(r.Real) || "ink"})`, fontWeight: 600 }}>{fmtBs(r.Real)}</td><td className="r">{fmtPct(r.margin)}</td></tr>)}</tbody></table></div>
            : <Empty text="Aún no hay proyectos." />}
        </div>
      </div>
    </div>
  );
}
