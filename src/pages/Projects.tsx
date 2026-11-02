import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { FileText, Eye, Plus, Package, RotateCcw, ShoppingCart, Wallet, X, Save } from "lucide-react";
import { useApp, ins, upd, del } from "../data/store";
import { PageHead, Btn, Badge, Empty, Field, Inp, Sel, Photo, Row, Kpi, Tabs, FormModal, ReceiptLink, toneOf } from "../components/ui";
import { fmtBs, fmtPct, fmtDate, fmtQty, num, r2, sum, todayLaPaz } from "../lib/format";
import { P_STATUS, MOV, PAY_METHODS, ACTIVE_P, projectFin, lineCalc, stockOf } from "../lib/calc";
import { uploadReceipt } from "../lib/files";

export function Projects() {
  const { db, go } = useApp();
  const [f, setF] = useState("todos");
  const [qs, setQs] = useState("");
  const list = db.projects
    .filter((p: any) => f === "todos" || (f === "activos" ? ACTIVE_P.includes(p.status) : p.status === f))
    .filter((p: any) => !qs || `${p.code} ${p.name} ${db.clients.find((c: any) => c.id === p.clientId)?.name || ""}`.toLowerCase().includes(qs.toLowerCase()));
  return (
    <div>
      <PageHead title="Proyectos" sub="Instalaciones creadas a partir de cotizaciones aceptadas" />
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input className="vx-in" style={{ maxWidth: 280 }} placeholder="Buscar código, proyecto o cliente" value={qs} onChange={(e) => setQs(e.target.value)} />
        {[["todos", "Todos"], ["activos", "Activos"], ["en_ejecucion", "En ejecución"], ["finalizado", "Finalizados"], ["cancelado", "Cancelados"]].map(([k, l]) =>
          <button key={k} className={`vx-pill ${f === k ? "on" : ""}`} onClick={() => setF(k)}>{l}</button>)}
      </div>
      {list.length > 0 && <div className="vx-only-mob space-y-2 mb-3">{list.map((p: any) => {
        const fin = projectFin(db, p);
        return (
          <button key={p.id} className="vx-lcard w-full text-left" style={{ fontFamily: "inherit", cursor: "pointer", display: "block" }} onClick={() => go("proyecto", p.id)}>
            <div className="flex justify-between gap-2"><b>{p.code}</b><Badge map={P_STATUS} s={p.status} /></div>
            <div className="mt-1" style={{ fontWeight: 500 }}>{p.name}</div>
            <div className="vx-muted" style={{ fontSize: 12 }}>{db.clients.find((c: any) => c.id === p.clientId)?.name}</div>
            <div className="grid grid-cols-2 gap-2 mt-2" style={{ fontSize: 12 }}>
              <div><div className="vx-muted">Saldo por cobrar</div><b style={{ color: fin.pendingCollect > 0 ? "var(--amber)" : undefined }}>{fmtBs(fin.pendingCollect)}</b></div>
              <div className="text-right"><div className="vx-muted">Resultado real</div><b style={{ color: `var(--${toneOf(fin.realResult) || "ink"})` }}>{fmtBs(fin.realResult)}</b></div>
            </div>
          </button>
        );
      })}</div>}
      <div className={`vx-card vx-scroll ${list.length ? "vx-only-desk" : ""}`}>
        {list.length ? (
          <table className="vx-tbl">
            <thead><tr><th>Código</th><th>Proyecto y cliente</th><th>Empresa</th><th>Inicio previsto</th><th>Estado</th><th className="r">Acordado</th><th className="r">Cobrado</th><th className="r">Saldo</th><th className="r">Resultado real</th></tr></thead>
            <tbody>{list.map((p: any) => {
              const fin = projectFin(db, p);
              return (
                <tr key={p.id} className="click" onClick={() => go("proyecto", p.id)}>
                  <td style={{ fontWeight: 600 }}>{p.code}</td>
                  <td><div style={{ fontWeight: 500 }}>{p.name}</div><div className="vx-muted" style={{ fontSize: 12 }}>{db.clients.find((c: any) => c.id === p.clientId)?.name}</div></td>
                  <td>{db.companies.find((c: any) => c.id === p.companyId)?.tradeName}</td><td>{fmtDate(p.plannedStart)}</td><td><Badge map={P_STATUS} s={p.status} /></td>
                  <td className="r nw">{fmtBs(fin.agreed)}</td><td className="r nw">{fmtBs(fin.collected)}</td>
                  <td className="r nw" style={{ color: fin.pendingCollect > 0 ? "var(--amber)" : undefined }}>{fmtBs(fin.pendingCollect)}</td>
                  <td className="r nw" style={{ fontWeight: 600, color: `var(--${toneOf(fin.realResult) || "ink"})` }}>{fmtBs(fin.realResult)}</td>
                </tr>
              );
            })}</tbody>
          </table>
        ) : <Empty text="No hay proyectos con este filtro. Los proyectos se crean al aceptar una cotización." action={<Btn onClick={() => go("cotizaciones")}>Ir a cotizaciones</Btn>} />}
      </div>
    </div>
  );
}

export function ProjectDetail() {
  const { id } = useParams();
  const [sp, setSp] = useSearchParams();
  const { db, go, run, log, busy } = useApp();
  const p = db.projects.find((x: any) => x.id === id);
  const [modal, setModal] = useState<any>(null);
  const [pf, setPf] = useState<any>(null);
  const [newCheck, setNewCheck] = useState({ label: "", kind: "material" });
  useEffect(() => {
    if (p) setPf({ plannedStart: p.plannedStart || "", plannedEnd: p.plannedEnd || "", actualStart: p.actualStart || "", actualEnd: p.actualEnd || "", address: p.address || "", notes: p.notes || "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p?.id, p?.updatedAt]);
  if (!p) return <Empty text="El proyecto no existe." action={<Btn onClick={() => go("proyectos")}>Volver</Btn>} />;

  const tab = sp.get("tab") || "resumen";
  const setTab = (t: string) => setSp({ tab: t }, { replace: true });
  const fin = projectFin(db, p);
  const q = db.quotations.find((x: any) => x.id === p.quotationId);
  const acceptedV = q?.versions.find((v: any) => v.reason === "aceptada");
  const locked = ["finalizado", "cancelado"].includes(p.status);
  const today = todayLaPaz();

  const setStatus = (s: string) => {
    const patch: any = { status: s };
    if (s === "en_ejecucion" && !p.actualStart) patch.actualStart = today;
    if (s === "finalizado") patch.actualEnd = p.actualEnd || today;
    run(async () => { await upd("projects", p.id, patch); await log(`${p.code}: estado cambiado a ${P_STATUS[s][0]}.`); }, `Estado: ${P_STATUS[s][0]}`, ["projectsRaw"]);
  };
  const pfDirty = pf && JSON.stringify(pf) !== JSON.stringify({ plannedStart: p.plannedStart || "", plannedEnd: p.plannedEnd || "", actualStart: p.actualStart || "", actualEnd: p.actualEnd || "", address: p.address || "", notes: p.notes || "" });
  const saveData = () => run(async () => { await upd("projects", p.id, pf); await log(`${p.code}: datos del proyecto actualizados.`); }, "Datos guardados", ["projectsRaw"]);

  /* Materiales */
  const prodIds: string[] = [...new Set<string>([
    ...p.items.filter((i: any) => i.productId).map((i: any) => i.productId),
    ...db.movements.filter((m: any) => m.projectId === p.id).map((m: any) => m.productId),
  ])].filter((pid) => db.products.some((x: any) => x.id === pid));
  const matRows = prodIds.map((pid) => {
    const prod = db.products.find((x: any) => x.id === pid);
    const planned = sum(p.items.filter((i: any) => i.productId === pid), "qty");
    const movs = db.movements.filter((m: any) => m.projectId === p.id && m.productId === pid);
    const out = sum(movs.filter((m: any) => m.type === "salida_proyecto"), "qty");
    const back = sum(movs.filter((m: any) => m.type === "devolucion_proyecto"), "qty");
    const cost = sum(movs, (m: any) => (m.type === "salida_proyecto" ? num(m.qty) * num(m.unitCost) : m.type === "devolucion_proyecto" ? -num(m.qty) * num(m.unitCost) : 0));
    return { prod, planned, out, back, net: r2(out - back), cost, stock: stockOf(db, pid) };
  });
  const issue = async (v: any) => {
    const prod = db.products.find((x: any) => x.id === v.productId);
    const qty = num(v.qty);
    if (!prod) return "Selecciona un producto.";
    if (qty <= 0) return "La cantidad debe ser mayor que cero.";
    if (qty > stockOf(db, prod.id)) return `Solo hay ${fmtQty(stockOf(db, prod.id))} ${prod.unit} en stock.`;
    const ok = await run(async () => {
      await ins("inventory_movements", { date: v.date, type: "salida_proyecto", productId: prod.id, qty, unitCost: num(prod.avgCost), projectId: p.id, notes: v.notes || "" });
      await log(`${p.code}: salida de ${fmtQty(qty)} ${prod.unit} de ${prod.name}.`);
    }, "Salida registrada", ["movements"]);
    if (ok) setModal(null);
  };
  const giveBack = async (v: any) => {
    const row = matRows.find((r) => r.prod.id === v.productId);
    const qty = num(v.qty);
    if (!row || qty <= 0) return "La cantidad debe ser mayor que cero.";
    if (qty > row.net) return `Solo salieron ${fmtQty(row.net)} ${row.prod.unit} netos hacia este proyecto.`;
    const outs = db.movements.filter((m: any) => m.projectId === p.id && m.productId === v.productId && m.type === "salida_proyecto");
    const unitCost = row.out ? r2(sum(outs, (m: any) => num(m.qty) * num(m.unitCost)) / row.out) : num(row.prod.avgCost);
    const ok = await run(async () => {
      await ins("inventory_movements", { date: v.date, type: "devolucion_proyecto", productId: v.productId, qty, unitCost, projectId: p.id, notes: v.notes || "" });
      await log(`${p.code}: devolución de ${fmtQty(qty)} ${row.prod.unit} de ${row.prod.name}.`);
    }, "Devolución registrada", ["movements"]);
    if (ok) setModal(null);
  };

  const checklist = db.projectChecklists[p.id] || [];
  const toggleCheck = (i: any) => run(async () => { await upd("project_checklist_items", i.id, { checked: !i.checked }); }, undefined, ["checklistItems"]);
  const addCheck = () => {
    if (!newCheck.label.trim()) return;
    run(async () => { await ins("project_checklist_items", { projectId: p.id, position: checklist.length + 2000, kind: newCheck.kind, label: newCheck.label.trim(), checked: false }); }, undefined, ["checklistItems"]);
    setNewCheck({ ...newCheck, label: "" });
  };
  const payments = db.payments.filter((x: any) => x.projectId === p.id);
  const expenses = db.expenses.filter((x: any) => x.projectId === p.id);
  const pis = db.projectInstallers.filter((x: any) => x.projectId === p.id);
  const productOptions = db.products.filter((x: any) => x.active && x.trackInventory).map((x: any) => ({ value: x.id, label: `${x.name} (stock ${fmtQty(stockOf(db, x.id))} ${x.unit})` }));

  return (
    <div>
      <PageHead back={{ label: "Proyectos", onClick: () => go("proyectos") }}
        title={<span className="flex flex-wrap items-center gap-3">{p.name || "Proyecto"}<Badge map={P_STATUS} s={p.status} /></span>}
        sub={`${p.code} · ${db.clients.find((c: any) => c.id === p.clientId)?.name || ""} · ${db.companies.find((c: any) => c.id === p.companyId)?.tradeName || ""}`}
        actions={<><Btn icon={FileText} onClick={() => go("editor", p.quotationId)}>Cotización {q?.number}</Btn>{acceptedV && <Btn icon={Eye} onClick={() => go("preview", p.quotationId, acceptedV.n)}>Propuesta aceptada</Btn>}</>} />
      <Tabs value={tab} onChange={setTab} tabs={[["resumen", "Resumen"], ["materiales", "Materiales"], ["checklist", `Checklist (${checklist.filter((i: any) => i.checked).length}/${checklist.length})`], ["finanzas", "Finanzas"], ["instaladores", "Instaladores"], ["historial", "Historial"]]} />

      {tab === "resumen" && pf && <div className="space-y-5">
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,260px),1fr))" }}>
          <div className="vx-card p-4"><h3 className="mb-2">Estimado al aceptar</h3>
            <Row k="Ingreso acordado" v={fmtBs(fin.agreed)} /><Row k="Costo presupuestado" v={fmtBs(fin.budgetCost)} />
            <Row k="Ganancia estimada" v={fmtBs(fin.estProfit)} strong tone={toneOf(fin.estProfit)} /><Row k="Margen estimado" v={fmtPct(fin.estMargin)} />
            {p.estimatedAtAcceptance && Math.abs(num(p.estimatedAtAcceptance.profit) - fin.estProfit) > 0.009 && <div className="vx-muted mt-1" style={{ fontSize: 12 }}>Al aceptar era {fmtBs(p.estimatedAtAcceptance.profit)}; cambió por adicionales.</div>}
          </div>
          <div className="vx-card vx-vf"><h3 className="mb-2">Resultado real {p.status !== "finalizado" && <span className="vx-badge b-amber">Provisional</span>}</h3>
            <Row k="Materiales consumidos" v={fmtBs(fin.matCost)} /><Row k="Gastos del proyecto" v={fmtBs(fin.expCost)} /><Row k="Instaladores (acordado)" v={fmtBs(fin.instCost)} />
            <Row k="Costo real" v={fmtBs(fin.realCost)} /><Row k="Resultado real" v={fmtBs(fin.realResult)} strong tone={toneOf(fin.realResult)} /><Row k="Margen real" v={fmtPct(fin.realMargin)} />
          </div>
          <div className="vx-card p-4"><h3 className="mb-2">Dinero</h3>
            <Row k="Cobrado" v={fmtBs(fin.collected)} /><Row k="Saldo por cobrar" v={fmtBs(fin.pendingCollect)} tone={fin.pendingCollect > 0 ? "amber" : undefined} />
            <Row k="Pagado (gastos, compras, instaladores)" v={fmtBs(fin.cashOut)} /><Row k="Flujo de caja" v={fmtBs(fin.cashFlow)} strong tone={toneOf(fin.cashFlow)} />
            <div className="vx-muted mt-1" style={{ fontSize: 12 }}>Los materiales tomados del almacén afectan el resultado, no la caja del proyecto.</div>
          </div>
        </div>
        <div className="vx-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3"><h3>Datos del proyecto</h3>
            <Btn v="pri" sm icon={Save} disabled={!pfDirty || busy} onClick={saveData}>Guardar datos</Btn></div>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))" }}>
            <Field label="Estado"><Sel value={p.status} disabled={busy} onChange={(e: any) => setStatus(e.target.value)} options={Object.entries(P_STATUS).map(([value, [label]]) => ({ value, label }))} /></Field>
            <Field label="Inicio previsto"><Inp type="date" value={pf.plannedStart} onChange={(e: any) => setPf({ ...pf, plannedStart: e.target.value })} /></Field>
            <Field label="Fin previsto"><Inp type="date" value={pf.plannedEnd} onChange={(e: any) => setPf({ ...pf, plannedEnd: e.target.value })} /></Field>
            <Field label="Inicio real"><Inp type="date" value={pf.actualStart} onChange={(e: any) => setPf({ ...pf, actualStart: e.target.value })} /></Field>
            <Field label="Finalización"><Inp type="date" value={pf.actualEnd} onChange={(e: any) => setPf({ ...pf, actualEnd: e.target.value })} /></Field>
            <Field label="Dirección"><Inp value={pf.address} onChange={(e: any) => setPf({ ...pf, address: e.target.value })} /></Field>
          </div>
          <Field label="Observaciones" className="mt-3"><textarea className="vx-in" rows={2} value={pf.notes} onChange={(e) => setPf({ ...pf, notes: e.target.value })} /></Field>
        </div>
        <div className="vx-card">
          <div className="flex items-center justify-between p-4 pb-2"><h3>Presupuesto del proyecto</h3>{!locked && <Btn sm icon={Plus} onClick={() => setModal("extra")}>Agregar adicional</Btn>}</div>
          <div className="vx-scroll"><table className="vx-tbl"><thead><tr><th>Concepto</th><th>Origen</th><th className="r">Cant.</th><th className="r">Venta</th><th className="r">Costo presupuestado</th><th>Cobro al cliente</th></tr></thead>
            <tbody>{p.items.map((i: any) => {
              const c = lineCalc(i);
              return <tr key={i.id}><td>{i.name}</td><td><span className={`vx-badge ${i.origin === "adicional" ? "b-blue" : "b-gray"}`}>{i.origin === "adicional" ? "Adicional" : "Cotización"}</span></td>
                <td className="r">{fmtQty(i.qty)} {i.unit !== "servicio" ? i.unit : ""}</td><td className="r nw">{i.billable ? fmtBs(c.total) : "—"}</td><td className="r nw">{fmtBs(c.cost)}</td>
                <td>{i.billable ? "Se cobra" : <span className="vx-muted">Costo interno</span>}</td></tr>;
            })}</tbody></table></div>
        </div>
      </div>}

      {tab === "materiales" && <div className="vx-card">
        <div className="flex flex-wrap items-center justify-between gap-2 p-4 pb-2">
          <div><h3>Materiales del proyecto</h3><div className="vx-muted" style={{ fontSize: 12 }}>La salida del almacén se registra al confirmar la entrega o el uso.</div></div>
          {!locked && <div className="flex flex-wrap gap-2">
            <Btn sm v="pri" icon={Package} onClick={() => setModal({ kind: "issue" })}>Registrar salida</Btn>
            <Btn sm icon={RotateCcw} disabled={!matRows.some((r) => r.net > 0)} onClick={() => setModal({ kind: "return" })}>Registrar devolución</Btn>
            <Btn sm icon={ShoppingCart} onClick={() => go("compras", null, p.id)}>Compra directa</Btn>
          </div>}
        </div>
        <div className="vx-scroll">{matRows.length ? <table className="vx-tbl"><thead><tr><th>Producto</th><th className="r">Presupuestado</th><th className="r">Salió</th><th className="r">Devuelto</th><th className="r">Consumo neto</th><th className="r">Diferencia</th><th className="r">Costo consumido</th><th className="r">Stock actual</th><th></th></tr></thead>
          <tbody>{matRows.map((r) => {
            const diff = r2(r.net - r.planned);
            return (
              <tr key={r.prod.id}>
                <td><div className="flex items-center gap-2"><Photo path={r.prod.imagePath} size={34} /><div><div style={{ fontWeight: 500 }}>{r.prod.name}</div><div className="vx-muted" style={{ fontSize: 12 }}>{r.prod.unit}</div></div></div></td>
                <td className="r">{fmtQty(r.planned)}</td><td className="r">{fmtQty(r.out)}</td><td className="r">{fmtQty(r.back)}</td><td className="r" style={{ fontWeight: 600 }}>{fmtQty(r.net)}</td>
                <td className="r" style={{ color: diff > 0 ? "var(--rec)" : diff < 0 ? "var(--amber)" : "var(--ok)" }}>{diff > 0 ? "+" : ""}{fmtQty(diff)}</td>
                <td className="r nw">{fmtBs(r.cost)}</td><td className="r" style={{ color: r.stock <= num(r.prod.minStock) ? "var(--rec)" : undefined }}>{fmtQty(r.stock)}</td>
                <td>{!locked && <div className="flex gap-1 justify-end">
                  <Btn sm onClick={() => setModal({ kind: "issue", productId: r.prod.id, qty: Math.max(0, r2(r.planned - r.net)) || "" })}>Salida</Btn>
                  {r.net > 0 && <Btn sm onClick={() => setModal({ kind: "return", productId: r.prod.id })}>Devolución</Btn>}
                </div>}</td>
              </tr>
            );
          })}</tbody></table> : <Empty text="Este proyecto no tiene productos del catálogo." />}</div>
      </div>}

      {tab === "checklist" && <div className="vx-card p-4">
        <div className="mb-3"><h3>Preparación de la instalación</h3><div className="vx-muted" style={{ fontSize: 12 }}>Marcar elementos no mueve inventario. Esta lista es propia del proyecto: cambiarla no altera la plantilla.</div></div>
        <div style={{ height: 6, background: "#E6E7F0", borderRadius: 3 }} className="mb-4"><div style={{ height: 6, borderRadius: 3, background: "var(--grad)", width: `${checklist.length ? (checklist.filter((i: any) => i.checked).length / checklist.length) * 100 : 0}%` }} /></div>
        <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,300px),1fr))" }}>
          {[["material", "Materiales que debo llevar"], ["herramienta", "Herramientas que debo comprobar"]].map(([k, l]) => (
            <div key={k}>
              <h3 className="mb-2">{l} <span className="vx-muted">({checklist.filter((i: any) => i.kind === k && i.checked).length}/{checklist.filter((i: any) => i.kind === k).length})</span></h3>
              {checklist.filter((i: any) => i.kind === k).map((i: any) => (
                <div key={i.id} className="flex items-center gap-2 py-2" style={{ borderBottom: "1px solid #EEEFF5" }}>
                  <input type="checkbox" checked={i.checked} disabled={busy} onChange={() => toggleCheck(i)} style={{ width: 20, height: 20, accentColor: "#7928CA" }} aria-label={i.label} />
                  <span className="flex-1" style={i.checked ? { color: "var(--muted)", textDecoration: "line-through" } : {}}>{i.label}</span>
                  <button className="vx-btn gh sm" aria-label="Quitar" onClick={() => run(async () => { await del("project_checklist_items", i.id); }, undefined, ["checklistItems"])}><X size={13} /></button>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 items-end mt-4">
          <Field label="Nuevo elemento" className="flex-1"><Inp value={newCheck.label} onChange={(e: any) => setNewCheck({ ...newCheck, label: e.target.value })} onKeyDown={(e: any) => e.key === "Enter" && addCheck()} /></Field>
          <Field label="Tipo"><Sel value={newCheck.kind} onChange={(e: any) => setNewCheck({ ...newCheck, kind: e.target.value })} options={[{ value: "material", label: "Material" }, { value: "herramienta", label: "Herramienta" }]} /></Field>
          <Btn icon={Plus} disabled={!newCheck.label.trim() || busy} onClick={addCheck}>Agregar</Btn>
        </div>
      </div>}

      {tab === "finanzas" && <div className="space-y-5">
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))" }}>
          <Kpi k="Ingreso acordado" v={fmtBs(fin.agreed)} /><Kpi k="Cobrado" v={fmtBs(fin.collected)} tone="ok" />
          <Kpi k="Saldo por cobrar" v={fmtBs(fin.pendingCollect)} tone={fin.pendingCollect > 0 ? "amber" : undefined} /><Kpi k="Flujo de caja" v={fmtBs(fin.cashFlow)} tone={toneOf(fin.cashFlow)} />
        </div>
        <div className="vx-card"><div className="flex items-center justify-between p-4 pb-2"><h3>Cobros al cliente</h3><Btn sm v="pri" icon={Plus} onClick={() => setModal("payment")}>Registrar cobro</Btn></div>
          <div className="vx-scroll">{payments.length ? <table className="vx-tbl"><thead><tr><th>Fecha</th><th>Tipo</th><th>Método</th><th>Referencia</th><th className="r">Importe</th><th></th></tr></thead>
            <tbody>{payments.map((x: any) => (
              <tr key={x.id} style={x.status === "anulado" ? { opacity: 0.5 } : {}}>
                <td>{fmtDate(x.date)}</td><td style={{ textTransform: "capitalize" }}>{x.type}</td><td>{x.method}</td><td>{x.reference || "—"} <ReceiptLink path={x.receiptPath} /></td>
                <td className="r nw" style={{ fontWeight: 600 }}>{fmtBs(x.amount)}</td>
                <td className="r">{x.status === "anulado" ? <span className="vx-badge b-gray">Anulado</span>
                  : <Btn sm v="gh" onClick={() => run(async () => { await upd("payments", x.id, { status: "anulado" }); await log(`${p.code}: cobro de ${fmtBs(x.amount)} anulado.`); }, "Cobro anulado", ["payments"])}>Anular</Btn>}</td>
              </tr>
            ))}</tbody></table> : <Empty text="Todavía no registraste cobros." />}</div></div>
        <div className="vx-card"><div className="flex items-center justify-between p-4 pb-2"><h3>Gastos del proyecto</h3><Btn sm v="pri" icon={Plus} onClick={() => setModal("expense")}>Registrar gasto</Btn></div>
          <div className="vx-scroll">{expenses.length ? <table className="vx-tbl"><thead><tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th>Estado</th><th className="r">Importe</th><th></th></tr></thead>
            <tbody>{expenses.map((x: any) => (
              <tr key={x.id} style={x.status === "anulado" ? { opacity: 0.5 } : {}}>
                <td>{fmtDate(x.date)}</td><td>{x.category}</td><td>{x.description} <ReceiptLink path={x.receiptPath} /></td>
                <td>{x.status === "pagado" ? <span className="vx-badge b-green">Pagado</span> : x.status === "anulado" ? <span className="vx-badge b-gray">Anulado</span> : <span className="vx-badge b-amber">Pendiente de pago</span>}</td>
                <td className="r nw" style={{ fontWeight: 600 }}>{fmtBs(x.amount)}</td>
                <td className="r"><div className="flex gap-1 justify-end">
                  {x.status === "pendiente_pago" && <Btn sm onClick={() => run(async () => { await upd("expenses", x.id, { status: "pagado", paidDate: today }); await log(`${p.code}: gasto marcado como pagado.`); }, "Gasto marcado como pagado", ["expenses"])}>Marcar pagado</Btn>}
                  {x.status !== "anulado" && <Btn sm v="gh" onClick={() => run(async () => { await upd("expenses", x.id, { status: "anulado" }); await log(`${p.code}: gasto anulado.`); }, "Gasto anulado", ["expenses"])}>Anular</Btn>}
                </div></td>
              </tr>
            ))}</tbody></table> : <Empty text="Sin gastos registrados." />}</div></div>
        <div className="vx-card p-4"><h3 className="mb-2">Compras directas para este proyecto</h3>
          {db.purchases.filter((x: any) => x.projectId === p.id).map((x: any) => <Row key={x.id} k={`${fmtDate(x.date)} · ${x.reference || "Sin referencia"}`} v={fmtBs(x.total)} />)}
          {!db.purchases.some((x: any) => x.projectId === p.id) && <div className="vx-muted" style={{ fontSize: 13 }}>No hay compras directas. Los materiales salieron del almacén.</div>}
        </div>
      </div>}

      {tab === "instaladores" && <div className="vx-card">
        <div className="flex flex-wrap items-center justify-between gap-2 p-4 pb-2"><h3>Instaladores del proyecto</h3>
          <div className="flex gap-2 flex-wrap"><Btn sm icon={Plus} onClick={() => setModal("assignInst")}>Asignar instalador</Btn>{pis.length > 0 && <Btn sm v="pri" icon={Wallet} onClick={() => setModal("instPay")}>Registrar pago</Btn>}</div></div>
        <div className="vx-scroll">{pis.length ? <table className="vx-tbl"><thead><tr><th>Instalador</th><th>Función</th><th className="r">Acordado</th><th className="r">Pagado</th><th className="r">Pendiente</th><th>Pagos</th></tr></thead>
          <tbody>{pis.map((pi: any) => {
            const pays = db.installerPayments.filter((x: any) => x.projectInstallerId === pi.id && x.status !== "anulado");
            const paid = sum(pays, "amount");
            return (
              <tr key={pi.id}>
                <td style={{ fontWeight: 600 }}>{db.installers.find((i: any) => i.id === pi.installerId)?.name}</td><td>{pi.role}</td>
                <td className="r nw">{fmtBs(pi.agreed)}</td><td className="r nw">{fmtBs(paid)}</td>
                <td className="r nw" style={{ fontWeight: 600, color: num(pi.agreed) - paid > 0 ? "var(--amber)" : "var(--ok)" }}>{fmtBs(num(pi.agreed) - paid)}</td>
                <td style={{ fontSize: 12 }}>{pays.map((x: any) => <div key={x.id}>{fmtDate(x.date)} · {fmtBs(x.amount)} · {x.method}</div>)}{!pays.length && <span className="vx-muted">Sin pagos</span>}</td>
              </tr>
            );
          })}</tbody></table> : <Empty text={db.installers.length ? "Asigna los instaladores y el monto acordado con cada uno." : "Primero registra instaladores en Contactos → Instaladores."} />}</div>
      </div>}

      {tab === "historial" && <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,360px),1fr))" }}>
        <div className="vx-card p-4"><h3 className="mb-2">Cambios registrados</h3>
          {db.audit.filter((a: any) => a.text.includes(p.code) || (q && a.text.includes(q.number))).map((a: any) => (
            <div key={a.id} className="py-2" style={{ borderBottom: "1px solid #EEEFF5" }}><div className="vx-muted" style={{ fontSize: 12 }}>{new Date(a.at).toLocaleString("es-BO")} · {a.userEmail}</div>{a.text}</div>
          ))}
        </div>
        <div className="vx-card p-4"><h3 className="mb-2">Movimientos de inventario</h3>
          {db.movements.filter((m: any) => m.projectId === p.id).map((m: any) => (
            <div key={m.id} className="flex justify-between py-2" style={{ borderBottom: "1px solid #EEEFF5" }}>
              <div><div>{MOV[m.type].label}: {db.products.find((x: any) => x.id === m.productId)?.name}</div><div className="vx-muted" style={{ fontSize: 12 }}>{fmtDate(m.date)}</div></div>
              <div>{MOV[m.type].dir > 0 ? "+" : "-"}{fmtQty(m.qty)}</div>
            </div>
          ))}
        </div>
      </div>}

      {modal?.kind === "issue" && <FormModal title="Registrar salida de materiales" submitLabel="Registrar salida" onClose={() => setModal(null)} onSubmit={issue}
        initial={{ productId: modal.productId || productOptions[0]?.value, qty: modal.qty ?? "", date: today }}
        note="Descuenta el stock y suma el costo al resultado real del proyecto. Las herramientas no pasan por aquí."
        fields={[{ k: "productId", label: "Producto", type: "select", options: productOptions, required: true, full: true }, { k: "qty", label: "Cantidad", type: "number", required: true }, { k: "date", label: "Fecha", type: "date", required: true }, { k: "notes", label: "Observaciones", type: "textarea" }]} />}
      {modal?.kind === "return" && <FormModal title="Registrar devolución al almacén" submitLabel="Registrar devolución" onClose={() => setModal(null)} onSubmit={giveBack}
        initial={{ productId: modal.productId || matRows.find((r) => r.net > 0)?.prod.id, qty: "", date: today }}
        fields={[{ k: "productId", label: "Producto", type: "select", options: matRows.filter((r) => r.net > 0).map((r) => ({ value: r.prod.id, label: `${r.prod.name} (salieron ${fmtQty(r.net)} netos)` })), required: true, full: true }, { k: "qty", label: "Cantidad", type: "number", required: true }, { k: "date", label: "Fecha", type: "date", required: true }, { k: "notes", label: "Observaciones", type: "textarea" }]} />}
      {modal === "extra" && <FormModal title="Agregar adicional al presupuesto" onClose={() => setModal(null)} initial={{ qty: 1, billable: true }}
        note="La cotización aceptada no cambia. El adicional solo modifica el presupuesto vigente del proyecto."
        onSubmit={async (v: any) => {
          const ok = await run(async () => {
            await ins("project_items", { projectId: p.id, position: p.items.length + 1000, origin: "adicional", kind: "servicio", serviceKind: "Otro", name: v.name, unit: "servicio", qty: num(v.qty), cost: r2(num(v.cost)), price: r2(num(v.price)), show: !!v.billable, billable: !!v.billable });
            await log(`${p.code}: adicional agregado (${v.name}).`);
          }, "Adicional agregado", ["projectItems"]);
          if (ok) setModal(null);
        }}
        fields={[{ k: "name", label: "Concepto", required: true, full: true }, { k: "qty", label: "Cantidad", type: "number", required: true }, { k: "price", label: "Precio al cliente (Bs)", type: "number" }, { k: "cost", label: "Costo presupuestado (Bs)", type: "number" }, { k: "billable", label: "Cobro", type: "checkbox", hint: "Se cobra al cliente" }]} />}
      {modal === "payment" && <FormModal title="Registrar cobro" submitLabel="Registrar cobro" onClose={() => setModal(null)}
        initial={{ date: today, type: payments.length ? "parcial" : "anticipo", method: "Transferencia", amount: "" }} note={`Saldo actual por cobrar: ${fmtBs(fin.pendingCollect)}`}
        onSubmit={async (v: any) => {
          if (num(v.amount) <= 0) return "El importe debe ser mayor que cero.";
          if (num(v.amount) > fin.pendingCollect + 0.009 && !window.confirm(`El cobro de ${fmtBs(v.amount)} supera el saldo pendiente de ${fmtBs(Math.max(0, fin.pendingCollect))}. ¿Registrarlo de todos modos?`)) return;
          const ok = await run(async () => {
            const receiptPath = v.receipt ? await uploadReceipt(v.receipt, `receipts/cobros/${p.id}`) : null;
            await ins("payments", { projectId: p.id, date: v.date, amount: r2(num(v.amount)), type: v.type, method: v.method, reference: v.reference || "", notes: v.notes || "", receiptPath, status: "vigente" });
            await log(`${p.code}: cobro de ${fmtBs(v.amount)} registrado.`);
          }, "Cobro registrado", ["payments"]);
          if (ok) setModal(null);
        }}
        fields={[{ k: "amount", label: "Importe (Bs)", type: "number", required: true }, { k: "date", label: "Fecha", type: "date", required: true }, { k: "type", label: "Tipo", type: "select", options: [{ value: "anticipo", label: "Anticipo" }, { value: "parcial", label: "Pago parcial" }, { value: "final", label: "Pago final" }] }, { k: "method", label: "Método", type: "select", options: PAY_METHODS }, { k: "reference", label: "Referencia" }, { k: "receipt", label: "Comprobante (opcional)", type: "file" }, { k: "notes", label: "Observaciones", type: "textarea" }]} />}
      {modal === "expense" && <FormModal title="Registrar gasto real" submitLabel="Registrar gasto" onClose={() => setModal(null)}
        initial={{ date: today, category: db.settings.expenseCategories[0] || "Otros", status: "pagado" }}
        note="Las compras de equipos y materiales para inventario se registran en Compras para no contarlas dos veces."
        onSubmit={async (v: any) => {
          if (num(v.amount) <= 0) return "El importe debe ser mayor que cero.";
          const ok = await run(async () => {
            const receiptPath = v.receipt ? await uploadReceipt(v.receipt, `receipts/gastos/${p.id}`) : null;
            await ins("expenses", { projectId: p.id, category: v.category, description: v.description, amount: r2(num(v.amount)), date: v.date, supplierId: v.supplierId || null, status: v.status, paidDate: v.status === "pagado" ? v.date : null, receiptPath });
            await log(`${p.code}: gasto registrado (${v.description}, ${fmtBs(v.amount)}).`);
          }, "Gasto registrado", ["expenses"]);
          if (ok) setModal(null);
        }}
        fields={[{ k: "description", label: "Descripción", required: true, full: true }, { k: "amount", label: "Importe (Bs)", type: "number", required: true }, { k: "date", label: "Fecha", type: "date", required: true }, { k: "category", label: "Categoría", type: "select", options: db.settings.expenseCategories.length ? db.settings.expenseCategories : ["Otros"] }, { k: "status", label: "Estado", type: "select", options: [{ value: "pagado", label: "Pagado" }, { value: "pendiente_pago", label: "Pendiente de pago" }] }, { k: "supplierId", label: "Proveedor (opcional)", type: "select", options: [{ value: "", label: "Ninguno" }, ...db.suppliers.map((s: any) => ({ value: s.id, label: s.name }))] }, { k: "receipt", label: "Comprobante (opcional)", type: "file" }]} />}
      {modal === "assignInst" && <FormModal title="Asignar instalador" onClose={() => setModal(null)} initial={{ installerId: db.installers.find((i: any) => i.active)?.id || "" }}
        onSubmit={async (v: any) => {
          if (pis.some((x: any) => x.installerId === v.installerId)) return "Ese instalador ya está asignado a este proyecto.";
          const ok = await run(async () => { await ins("project_installers", { projectId: p.id, installerId: v.installerId, agreed: r2(num(v.agreed)), role: v.role || "" }); await log(`${p.code}: instalador asignado.`); }, "Instalador asignado", ["projectInstallers"]);
          if (ok) setModal(null);
        }}
        fields={[{ k: "installerId", label: "Instalador", type: "select", options: db.installers.filter((i: any) => i.active).map((i: any) => ({ value: i.id, label: i.name })), required: true }, { k: "agreed", label: "Importe acordado (Bs)", type: "number", required: true }, { k: "role", label: "Función" }]} />}
      {modal === "instPay" && <FormModal title="Registrar pago a instalador" submitLabel="Registrar pago" onClose={() => setModal(null)} initial={{ piId: pis[0]?.id, date: today, method: "Efectivo" }}
        onSubmit={async (v: any) => {
          if (num(v.amount) <= 0) return "El importe debe ser mayor que cero.";
          const ok = await run(async () => { await ins("installer_payments", { projectInstallerId: v.piId, date: v.date, amount: r2(num(v.amount)), method: v.method, notes: v.notes || "", status: "vigente" }); await log(`${p.code}: pago a instalador de ${fmtBs(v.amount)}.`); }, "Pago registrado", ["installerPayments"]);
          if (ok) setModal(null);
        }}
        fields={[{ k: "piId", label: "Instalador", type: "select", options: pis.map((pi: any) => ({ value: pi.id, label: db.installers.find((i: any) => i.id === pi.installerId)?.name })), required: true }, { k: "amount", label: "Importe (Bs)", type: "number", required: true }, { k: "date", label: "Fecha", type: "date", required: true }, { k: "method", label: "Método", type: "select", options: PAY_METHODS }, { k: "notes", label: "Observaciones", type: "textarea" }]} />}
    </div>
  );
}
