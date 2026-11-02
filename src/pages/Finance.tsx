import { useState } from "react";
import { Plus } from "lucide-react";
import { useApp, ins, upd } from "../data/store";
import { PageHead, Btn, Empty, Kpi, Tabs, FormModal, ReceiptLink } from "../components/ui";
import { fmtBs, fmtDate, num, r2, sum, todayLaPaz } from "../lib/format";
import { cashEvents, projectFin } from "../lib/calc";
import { uploadReceipt } from "../lib/files";

export default function Finance() {
  const { db, run, log, go } = useApp();
  const [tab, setTab] = useState("caja");
  const [modal, setModal] = useState(false);
  const today = todayLaPaz();
  const ev = cashEvents(db).sort((a, b) => b.date.localeCompare(a.date));
  const fins = db.projects.filter((p: any) => p.status !== "cancelado").map((p: any) => ({ p, f: projectFin(db, p) }));
  const pcode = (id: string) => db.projects.find((p: any) => p.id === id)?.code || "General";
  const sortDesc = (arr: any[]) => arr.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return (
    <div>
      <PageHead title="Finanzas" sub="Todo el dinero del negocio, sin duplicar importes" actions={<Btn v="pri" icon={Plus} onClick={() => setModal(true)}>Gasto general</Btn>} />
      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))" }}>
        <Kpi k="Total cobrado" v={fmtBs(sum(ev.filter((e) => e.dir > 0), "amount"))} tone="ok" />
        <Kpi k="Total pagado" v={fmtBs(sum(ev.filter((e) => e.dir < 0), "amount"))} tone="rec" />
        <Kpi k="Flujo de caja acumulado" v={fmtBs(sum(ev, (e: any) => e.dir * e.amount))} />
        <Kpi k="Por cobrar a clientes" v={fmtBs(sum(fins, ({ f }: any) => Math.max(0, f.pendingCollect)))} />
        <Kpi k="Pendiente de pago" v={fmtBs(sum(db.expenses.filter((e: any) => e.status === "pendiente_pago"), "amount") + sum(db.purchases.filter((x: any) => x.status === "pendiente"), "total"))} tone="amber" hint="Gastos y compras sin pagar" />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[["caja", "Movimientos de dinero"], ["cobros", "Cobros"], ["gastos", "Gastos"], ["instaladores", "Pagos a instaladores"]]} />
      <div className="vx-card vx-scroll">
        {tab === "caja" && (ev.length ? <table className="vx-tbl"><thead><tr><th>Fecha</th><th>Concepto</th><th>Proyecto</th><th className="r">Entrada</th><th className="r">Salida</th></tr></thead>
          <tbody>{ev.map((e, i) => <tr key={i}><td>{fmtDate(e.date)}</td><td>{e.cat}</td><td>{pcode(e.projectId)}</td><td className="r nw" style={{ color: "var(--ok)" }}>{e.dir > 0 ? fmtBs(e.amount) : ""}</td><td className="r nw" style={{ color: "var(--rec)" }}>{e.dir < 0 ? fmtBs(e.amount) : ""}</td></tr>)}</tbody></table> : <Empty text="Todavía no hay movimientos de dinero." />)}
        {tab === "cobros" && (db.payments.length ? <table className="vx-tbl"><thead><tr><th>Fecha</th><th>Proyecto</th><th>Tipo</th><th>Método</th><th className="r">Importe</th></tr></thead>
          <tbody>{sortDesc(db.payments).map((x: any) => <tr key={x.id} className="click" style={x.status === "anulado" ? { opacity: 0.5 } : {}} onClick={() => go("proyecto", x.projectId, "finanzas")}><td>{fmtDate(x.date)}</td><td>{pcode(x.projectId)}</td><td style={{ textTransform: "capitalize" }}>{x.type}</td><td>{x.method}</td><td className="r nw">{fmtBs(x.amount)}</td></tr>)}</tbody></table> : <Empty text="Sin cobros registrados." />)}
        {tab === "gastos" && (db.expenses.length ? <table className="vx-tbl"><thead><tr><th>Fecha</th><th>Proyecto</th><th>Categoría</th><th>Descripción</th><th>Estado</th><th className="r">Importe</th></tr></thead>
          <tbody>{sortDesc(db.expenses).map((x: any) => (
            <tr key={x.id} style={x.status === "anulado" ? { opacity: 0.5 } : {}}>
              <td>{fmtDate(x.date)}</td><td>{pcode(x.projectId)}</td><td>{x.category}</td><td>{x.description} <ReceiptLink path={x.receiptPath} /></td>
              <td>{x.status === "pagado" ? <span className="vx-badge b-green">Pagado</span> : x.status === "anulado" ? <span className="vx-badge b-gray">Anulado</span>
                : <Btn sm onClick={() => run(async () => { await upd("expenses", x.id, { status: "pagado", paidDate: today }); await log("Gasto marcado como pagado."); }, "Gasto marcado como pagado", ["expenses"])}>Marcar pagado</Btn>}</td>
              <td className="r nw">{fmtBs(x.amount)}</td>
            </tr>
          ))}</tbody></table> : <Empty text="Sin gastos registrados." />)}
        {tab === "instaladores" && (db.installerPayments.length ? <table className="vx-tbl"><thead><tr><th>Fecha</th><th>Instalador</th><th>Proyecto</th><th>Método</th><th className="r">Importe</th></tr></thead>
          <tbody>{sortDesc(db.installerPayments).map((x: any) => {
            const pi = db.projectInstallers.find((i: any) => i.id === x.projectInstallerId);
            return <tr key={x.id} style={x.status === "anulado" ? { opacity: 0.5 } : {}}><td>{fmtDate(x.date)}</td><td>{db.installers.find((i: any) => i.id === pi?.installerId)?.name}</td><td>{pcode(pi?.projectId)}</td><td>{x.method}</td><td className="r nw">{fmtBs(x.amount)}</td></tr>;
          })}</tbody></table> : <Empty text="Sin pagos a instaladores." />)}
      </div>
      {modal && <FormModal title="Registrar gasto general" submitLabel="Registrar gasto" onClose={() => setModal(false)}
        note="Gastos del negocio que no pertenecen a un proyecto. Aparecen en el flujo de caja general, no en la rentabilidad de los proyectos."
        initial={{ date: today, category: db.settings.expenseCategories[0] || "Otros", status: "pagado" }}
        onSubmit={async (v: any) => {
          if (num(v.amount) <= 0) return "El importe debe ser mayor que cero.";
          const ok = await run(async () => {
            const receiptPath = v.receipt ? await uploadReceipt(v.receipt, "receipts/gastos/general") : null;
            await ins("expenses", { projectId: null, category: v.category, description: v.description, amount: r2(num(v.amount)), date: v.date, status: v.status, paidDate: v.status === "pagado" ? v.date : null, receiptPath });
            await log(`Gasto general registrado: ${v.description}.`);
          }, "Gasto registrado", ["expenses"]);
          if (ok) setModal(false);
        }}
        fields={[{ k: "description", label: "Descripción", required: true, full: true }, { k: "amount", label: "Importe (Bs)", type: "number", required: true }, { k: "date", label: "Fecha", type: "date", required: true },
          { k: "category", label: "Categoría", type: "select", options: db.settings.expenseCategories.length ? db.settings.expenseCategories : ["Otros"] },
          { k: "status", label: "Estado", type: "select", options: [{ value: "pagado", label: "Pagado" }, { value: "pendiente_pago", label: "Pendiente de pago" }] },
          { k: "receipt", label: "Comprobante (opcional)", type: "file" }]} />}
    </div>
  );
}
