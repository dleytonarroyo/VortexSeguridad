import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, History, ShoppingCart, AlertTriangle, Trash2 } from "lucide-react";
import { useApp, ins, upd, rpc } from "../data/store";
import { PageHead, Btn, Empty, Field, Inp, Sel, Photo, Kpi, Modal, FormModal, ReceiptLink } from "../components/ui";
import { fmtBs, fmtDate, fmtQty, num, r2, sum, newId, todayLaPaz } from "../lib/format";
import { MOV, ACTIVE_P, stockOf, committedOf } from "../lib/calc";
import { uploadReceipt } from "../lib/files";

export function Stock() {
  const { db, go, run, log } = useApp();
  const [onlyAlerts, setOnlyAlerts] = useState(false);
  const [modal, setModal] = useState(false);
  const rows = db.products.filter((p: any) => p.trackInventory && p.active).map((p: any) => {
    const st = stockOf(db, p.id);
    const com = committedOf(db, p.id);
    return { p, st, com, avail: r2(st - com), value: r2(st * num(p.avgCost)), low: st <= num(p.minStock), short: st - com < 0 };
  });
  const shown = rows.filter((r: any) => !onlyAlerts || r.low || r.short);
  const manual = async (v: any) => {
    const qty = num(v.qty);
    const prod = db.products.find((x: any) => x.id === v.productId);
    if (!prod) return "Selecciona un producto.";
    if (qty <= 0) return "La cantidad debe ser mayor que cero.";
    if (MOV[v.type].dir < 0 && qty > stockOf(db, prod.id)) return `Solo hay ${fmtQty(stockOf(db, prod.id))} ${prod.unit} en stock.`;
    if (v.type.startsWith("ajuste") && !v.notes) return "Explica el motivo del ajuste.";
    const ok = await run(async () => {
      await ins("inventory_movements", { date: v.date, type: v.type, productId: prod.id, qty, unitCost: num(prod.avgCost), notes: v.notes || "" });
      await log(`${MOV[v.type].label}: ${fmtQty(qty)} ${prod.unit} de ${prod.name}.`);
    }, "Movimiento registrado", ["movements"]);
    if (ok) setModal(false);
  };
  return (
    <div>
      <PageHead title="Existencias" sub="Stock actual calculado a partir de los movimientos"
        actions={<><Btn icon={History} onClick={() => go("movimientos")}>Movimientos</Btn><Btn icon={ShoppingCart} onClick={() => go("compras")}>Registrar compra</Btn><Btn v="pri" icon={Plus} disabled={!rows.length} onClick={() => setModal(true)}>Entrada o ajuste</Btn></>} />
      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))" }}>
        <Kpi k="Valor del inventario" v={fmtBs(sum(rows, "value"))} hint="Stock × costo promedio" />
        <Kpi k="Por debajo del mínimo" v={rows.filter((r: any) => r.low).length} tone={rows.some((r: any) => r.low) ? "rec" : undefined} />
        <Kpi k="Faltantes para proyectos" v={rows.filter((r: any) => r.short).length} hint="Comprometido mayor que el stock" tone={rows.some((r: any) => r.short) ? "amber" : undefined} />
      </div>
      <div className="vx-card">
        <div className="flex items-center justify-between p-4 pb-2"><h3>Productos con inventario</h3>
          <label className="flex items-center gap-2" style={{ fontSize: 13 }}><input type="checkbox" checked={onlyAlerts} onChange={(e) => setOnlyAlerts(e.target.checked)} />Solo alertas</label></div>
        <div className="vx-scroll">{shown.length ? <table className="vx-tbl"><thead><tr><th>Producto</th><th>Tipo</th><th className="r">Stock</th><th className="r">Mínimo</th><th className="r">Comprometido</th><th className="r">Disponible</th><th className="r">Costo promedio</th><th className="r">Valor</th><th>Alerta</th></tr></thead>
          <tbody>{shown.map(({ p, st, com, avail, value, low, short }: any) => (
            <tr key={p.id}>
              <td><div className="flex items-center gap-2"><Photo path={p.imagePath} size={34} /><div><div style={{ fontWeight: 500 }}>{p.name}</div><div className="vx-muted" style={{ fontSize: 12 }}>{p.sku}</div></div></div></td>
              <td style={{ textTransform: "capitalize" }}>{p.itemType}</td>
              <td className="r" style={{ fontWeight: 600 }}>{fmtQty(st)} <span className="vx-muted" style={{ fontSize: 11 }}>{p.unit}</span></td>
              <td className="r">{fmtQty(p.minStock)}</td><td className="r">{fmtQty(com)}</td>
              <td className="r" style={{ color: avail < 0 ? "var(--rec)" : undefined }}>{fmtQty(avail)}</td>
              <td className="r nw">{fmtBs(p.avgCost)}</td><td className="r nw">{fmtBs(value)}</td>
              <td>{low && <span className="vx-badge b-red"><AlertTriangle size={11} />Stock bajo</span>} {short && <span className="vx-badge b-amber">Falta para proyectos</span>}</td>
            </tr>
          ))}</tbody></table> : <Empty text={rows.length ? "No hay alertas." : "Registra productos en el Catálogo para controlar su inventario."} action={!rows.length && <Btn onClick={() => go("catalogo")}>Ir al catálogo</Btn>} />}</div>
      </div>
      {modal && <FormModal title="Entrada o ajuste de inventario" submitLabel="Registrar movimiento" onClose={() => setModal(false)} onSubmit={manual}
        initial={{ type: "entrada_manual", productId: rows[0]?.p.id, date: todayLaPaz() }}
        note="Las compras y las salidas a proyectos tienen su propio registro. Usa esta opción para el stock inicial, conteos físicos o devoluciones a proveedor."
        fields={[{ k: "type", label: "Tipo de movimiento", type: "select", options: ["entrada_manual", "ajuste_positivo", "ajuste_negativo", "devolucion_proveedor"].map((k) => ({ value: k, label: MOV[k].label })) },
          { k: "productId", label: "Producto", type: "select", options: rows.map((r: any) => ({ value: r.p.id, label: `${r.p.name} (stock ${fmtQty(r.st)})` })), required: true },
          { k: "qty", label: "Cantidad", type: "number", required: true }, { k: "date", label: "Fecha", type: "date", required: true }, { k: "notes", label: "Motivo u observaciones", type: "textarea" }]} />}
    </div>
  );
}

export function Movements() {
  const { db, go } = useApp();
  const [type, setType] = useState("");
  const [pid, setPid] = useState("");
  const list = db.movements.filter((m: any) => (!type || m.type === type) && (!pid || m.productId === pid))
    .slice().sort((a: any, b: any) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));
  return (
    <div>
      <PageHead back={{ label: "Existencias", onClick: () => go("almacen") }} title="Movimientos de inventario" sub="Historial completo. Los movimientos no se editan: un error se corrige con un ajuste." />
      <div className="vx-card p-4 mb-4 flex flex-wrap gap-3">
        <Field label="Tipo"><Sel value={type} onChange={(e: any) => setType(e.target.value)} options={[{ value: "", label: "Todos" }, ...Object.entries(MOV).map(([value, m]) => ({ value, label: m.label }))]} /></Field>
        <Field label="Producto"><Sel value={pid} onChange={(e: any) => setPid(e.target.value)} options={[{ value: "", label: "Todos" }, ...db.products.map((p: any) => ({ value: p.id, label: p.name }))]} /></Field>
      </div>
      <div className="vx-card vx-scroll">{list.length ? <table className="vx-tbl"><thead><tr><th>Fecha</th><th>Tipo</th><th>Producto</th><th className="r">Cantidad</th><th className="r">Costo unitario</th><th className="r">Valor</th><th>Proyecto</th><th>Observaciones</th></tr></thead>
        <tbody>{list.map((m: any) => {
          const p = db.products.find((x: any) => x.id === m.productId);
          const pr = db.projects.find((x: any) => x.id === m.projectId);
          return (
            <tr key={m.id}>
              <td>{fmtDate(m.date)}</td><td><span className={`vx-badge ${MOV[m.type].dir > 0 ? "b-green" : "b-red"}`}>{MOV[m.type].label}</span></td><td>{p?.name}</td>
              <td className="r" style={{ fontWeight: 600 }}>{MOV[m.type].dir > 0 ? "+" : "-"}{fmtQty(m.qty)} <span className="vx-muted" style={{ fontSize: 11 }}>{p?.unit}</span></td>
              <td className="r nw">{fmtBs(m.unitCost)}</td><td className="r nw">{fmtBs(num(m.qty) * num(m.unitCost))}</td>
              <td>{pr ? <button className="vx-link" onClick={() => go("proyecto", pr.id)}>{pr.code}</button> : "—"}</td><td className="vx-muted">{m.notes}</td>
            </tr>
          );
        })}</tbody></table> : <Empty text="Todavía no hay movimientos." />}</div>
    </div>
  );
}

function PurchaseModal({ presetProject, onClose }: any) {
  const { db, run, log, busy } = useApp();
  const prods = db.products.filter((p: any) => p.active && p.trackInventory);
  const [v, setV] = useState<any>({
    supplierId: db.suppliers.find((s: any) => s.active)?.id || "", date: todayLaPaz(), reference: "",
    destination: presetProject ? "proyecto" : "almacen",
    projectId: presetProject || db.projects.find((p: any) => ACTIVE_P.includes(p.status))?.id || "",
    status: "pagada", updateRef: true, receipt: null,
  });
  const [lines, setLines] = useState<any[]>([{ id: newId(), productId: prods[0]?.id, qty: 1, unitCost: prods[0]?.refCost ?? 0 }]);
  const [err, setErr] = useState("");
  const total = sum(lines, (l: any) => num(l.qty) * num(l.unitCost));
  const setL = (id: string, patch: any) => setLines(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const submit = async () => {
    if (!prods.length) { setErr("Primero registra productos en el catálogo."); return; }
    if (lines.some((l) => num(l.qty) <= 0)) { setErr("Todas las cantidades deben ser mayores que cero."); return; }
    if (v.destination === "proyecto" && !v.projectId) { setErr("Selecciona el proyecto."); return; }
    setErr("");
    const ok = await run(async () => {
      const receiptPath = v.receipt ? await uploadReceipt(v.receipt, "receipts/compras") : null;
      await rpc("register_purchase", {
        p: {
          date: v.date, supplier_id: v.supplierId || null, reference: v.reference, destination: v.destination,
          project_id: v.destination === "proyecto" ? v.projectId : null, status: v.status, update_ref: v.updateRef, receipt_path: receiptPath,
          items: lines.map((l) => ({ product_id: l.productId, qty: num(l.qty), unit_cost: r2(num(l.unitCost)) })),
        },
      });
      await log(`Compra registrada por ${fmtBs(total)}${v.destination === "proyecto" ? " (directa a proyecto)" : ""}.`);
    }, "Compra registrada", ["purchasesRaw", "purchaseItems", "movements", "products", "priceHistory"]);
    if (ok) onClose();
  };
  return (
    <Modal title="Registrar compra" wide onClose={onClose} footer={<><Btn onClick={onClose}>Cancelar</Btn><Btn v="pri" disabled={busy} onClick={submit}>{busy ? "Guardando…" : `Registrar compra de ${fmtBs(total)}`}</Btn></>}>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
        <Field label="Proveedor"><Sel value={v.supplierId} onChange={(e: any) => setV({ ...v, supplierId: e.target.value })} options={[{ value: "", label: "Sin proveedor" }, ...db.suppliers.filter((s: any) => s.active).map((s: any) => ({ value: s.id, label: s.name }))]} /></Field>
        <Field label="Fecha"><Inp type="date" value={v.date} onChange={(e: any) => setV({ ...v, date: e.target.value })} /></Field>
        <Field label="Referencia (factura o recibo)"><Inp value={v.reference} onChange={(e: any) => setV({ ...v, reference: e.target.value })} /></Field>
        <Field label="Destino"><Sel value={v.destination} onChange={(e: any) => setV({ ...v, destination: e.target.value })} options={[{ value: "almacen", label: "Almacén" }, { value: "proyecto", label: "Directo a un proyecto" }]} /></Field>
        {v.destination === "proyecto" && <Field label="Proyecto"><Sel value={v.projectId} onChange={(e: any) => setV({ ...v, projectId: e.target.value })} options={[{ value: "", label: "Selecciona" }, ...db.projects.filter((p: any) => p.status !== "cancelado").map((p: any) => ({ value: p.id, label: `${p.code} · ${p.name}` }))]} /></Field>}
        <Field label="Pago"><Sel value={v.status} onChange={(e: any) => setV({ ...v, status: e.target.value })} options={[{ value: "pagada", label: "Pagada" }, { value: "pendiente", label: "Pendiente de pago" }]} /></Field>
        <Field label="Comprobante (opcional)"><input className="vx-in" type="file" accept="image/png,image/jpeg,application/pdf" onChange={(e) => setV({ ...v, receipt: e.target.files?.[0] || null })} /></Field>
      </div>
      <div className="vx-scroll mt-4"><table className="vx-tbl"><thead><tr><th>Producto</th><th className="r">Cantidad</th><th className="r">Costo unitario</th><th className="r">Subtotal</th><th></th></tr></thead>
        <tbody>{lines.map((l) => (
          <tr key={l.id}>
            <td><select className="vx-in" style={{ minWidth: 180 }} value={l.productId} onChange={(e) => setL(l.id, { productId: e.target.value, unitCost: db.products.find((p: any) => p.id === e.target.value)?.refCost ?? 0 })}>{prods.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></td>
            <td className="r"><input className="vx-in num" style={{ width: 80 }} type="number" min="0" inputMode="decimal" value={l.qty} onChange={(e) => setL(l.id, { qty: e.target.value })} /></td>
            <td className="r"><input className="vx-in num" style={{ width: 100 }} type="number" min="0" inputMode="decimal" value={l.unitCost} onChange={(e) => setL(l.id, { unitCost: e.target.value })} /></td>
            <td className="r nw">{fmtBs(num(l.qty) * num(l.unitCost))}</td>
            <td>{lines.length > 1 && <button className="vx-btn gh sm" aria-label="Quitar línea" onClick={() => setLines(lines.filter((x) => x.id !== l.id))}><Trash2 size={14} /></button>}</td>
          </tr>
        ))}</tbody></table></div>
      <Btn sm icon={Plus} className="mt-2" disabled={!prods.length} onClick={() => setLines([...lines, { id: newId(), productId: prods[0]?.id, qty: 1, unitCost: prods[0]?.refCost ?? 0 }])}>Agregar línea</Btn>
      <label className="flex items-center gap-2 mt-3" style={{ fontSize: 13 }}><input type="checkbox" checked={v.updateRef} onChange={(e) => setV({ ...v, updateRef: e.target.checked })} />Actualizar el costo de referencia del catálogo con estos costos</label>
      <div className="vx-muted mt-2" style={{ fontSize: 12 }}>{v.destination === "proyecto" ? "Se registra la entrada y la salida al proyecto en el mismo momento: el costo va al proyecto y el pago a la caja, sin duplicarse." : "La compra entra al stock y recalcula el costo promedio. No afecta la rentabilidad de ningún proyecto hasta que el material salga."}</div>
      {err && <div className="mt-2" style={{ color: "var(--rec)" }}>{err}</div>}
    </Modal>
  );
}

export function Purchases() {
  const { db, go, run, log } = useApp();
  const [sp] = useSearchParams();
  const preset = sp.get("proyecto");
  const [open, setOpen] = useState(!!preset);
  return (
    <div>
      <PageHead back={{ label: "Existencias", onClick: () => go("almacen") }} title="Compras" sub="Compras al almacén y compras directas para proyectos" actions={<Btn v="pri" icon={Plus} onClick={() => setOpen(true)}>Registrar compra</Btn>} />
      <div className="vx-card vx-scroll">{db.purchases.length ? <table className="vx-tbl"><thead><tr><th>Fecha</th><th>Proveedor</th><th>Referencia</th><th>Destino</th><th>Productos</th><th className="r">Total</th><th>Pago</th></tr></thead>
        <tbody>{db.purchases.map((x: any) => (
          <tr key={x.id}>
            <td>{fmtDate(x.date)}</td><td>{db.suppliers.find((s: any) => s.id === x.supplierId)?.name || "—"}</td><td>{x.reference || "—"} <ReceiptLink path={x.receiptPath} /></td>
            <td>{x.destination === "proyecto" ? <span className="vx-badge b-blue">{db.projects.find((p: any) => p.id === x.projectId)?.code}</span> : "Almacén"}</td>
            <td>{x.items.map((i: any) => `${db.products.find((p: any) => p.id === i.productId)?.name || "?"} × ${fmtQty(i.qty)}`).join(", ")}</td>
            <td className="r nw" style={{ fontWeight: 600 }}>{fmtBs(x.total)}</td>
            <td>{x.status === "pagada" ? <span className="vx-badge b-green">Pagada</span> : x.status === "anulada" ? <span className="vx-badge b-gray">Anulada</span>
              : <Btn sm onClick={() => run(async () => { await upd("purchases", x.id, { status: "pagada", paidDate: todayLaPaz() }); await log(`Compra ${x.reference || ""} marcada como pagada.`); }, "Compra marcada como pagada", ["purchasesRaw"])}>Marcar pagada</Btn>}</td>
          </tr>
        ))}</tbody></table> : <Empty text="Todavía no registraste compras." action={<Btn v="pri" icon={Plus} onClick={() => setOpen(true)}>Registrar compra</Btn>} />}</div>
      {open && <PurchaseModal presetProject={preset} onClose={() => setOpen(false)} />}
    </div>
  );
}
