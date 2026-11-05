import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Plus, Eye, EyeOff, Save, Send, ThumbsUp, ThumbsDown, Copy, Trash2, FolderKanban, GripVertical, ChevronUp, ChevronDown } from "lucide-react";
import { useApp, ins, rpc, upd } from "../data/store";
import { PageHead, Btn, Badge, Empty, Modal, Field, Inp, Sel, Photo, Row, Spinner, toneOf } from "../components/ui";
import { fmtBs, fmtPct, fmtDate, num, r2, newId, todayLaPaz } from "../lib/format";
import {
  Q_STATUS, SERVICE_KINDS, quoteTotals, lineCalc, suggested, markupOf, marginOf, productMarkup, productPrice,
  distributeHidden, isExpired, stockOf, orderedItems, PAPER,
} from "../lib/calc";
import { uploadImage } from "../lib/files";

/* Convierte la cotización de la pantalla al formato que guarda la base de datos */
const itemsPayload = (items: any[]) => items.map((l, i) => ({
  id: l.id, position: i, kind: l.kind, service_kind: l.serviceKind || null, product_id: l.productId || null,
  name: l.name || "", description: l.description || "", unit: l.unit || "unidad", qty: num(l.qty), cost: r2(num(l.cost)),
  markup: l.markup === null || l.markup === "" || l.markup === undefined ? null : num(l.markup), price: r2(num(l.price)),
  price_manual: !!l.priceManual, disc_type: l.discType || "%", disc_val: num(l.discVal), show: !!l.show,
  image_path: l.imagePath || null, distributed: !!l.distributed, supplier_id: l.supplierId || null,
}));
const cleanItems = (items: any[]) => items.map((l) => ({
  ...l, qty: num(l.qty), cost: r2(num(l.cost)), price: r2(num(l.price)), discVal: num(l.discVal),
  markup: l.markup === null || l.markup === "" || l.markup === undefined ? null : num(l.markup),
}));

function ProductPicker({ onPick, onClose, existing = [] }: any) {
  const { db } = useApp();
  const [qs, setQs] = useState("");
  const [sel, setSel] = useState<Record<string, any>>({});
  const list = db.products.filter((p: any) => p.active && `${p.name} ${p.sku} ${p.brand} ${p.category}`.toLowerCase().includes(qs.toLowerCase()));
  const count = Object.keys(sel).length;
  const toggle = (p: any) => setSel((s0) => { const n = { ...s0 }; if (n[p.id] !== undefined) delete n[p.id]; else n[p.id] = 1; return n; });
  const confirm = () => onPick(db.products.filter((p: any) => sel[p.id] !== undefined).map((p: any) => ({ p, qty: num(sel[p.id]) > 0 ? num(sel[p.id]) : 1 })));
  return (
    <Modal title="Agregar productos del catálogo" onClose={onClose} wide
      footer={<><Btn onClick={onClose}>Cancelar</Btn><Btn v="pri" disabled={!count} onClick={confirm}>{count ? `Agregar ${count} producto${count > 1 ? "s" : ""}` : "Selecciona productos"}</Btn></>}>
      <Inp autoFocus placeholder="Buscar por nombre, SKU, marca o categoría" value={qs} onChange={(e: any) => setQs(e.target.value)} />
      <div className="vx-muted mt-2" style={{ fontSize: 12 }}>Marca todos los productos que necesites y ajusta la cantidad de cada uno. Luego pulsa “Agregar”.</div>
      <div className="mt-2" style={{ maxHeight: 440, overflowY: "auto" }}>
        {list.map((p: any) => {
          const st = stockOf(db, p.id);
          const on = sel[p.id] !== undefined;
          return (
            <div key={p.id} className="flex items-center gap-3 p-2" style={{ borderBottom: "1px solid #EEEFF5", background: on ? "#F6F0FD" : undefined, borderRadius: 8 }}>
              <input type="checkbox" checked={on} onChange={() => toggle(p)} style={{ width: 20, height: 20, accentColor: "#7928CA", flexShrink: 0 }} aria-label={`Seleccionar ${p.name}`} />
              <button type="button" onClick={() => toggle(p)} className="flex items-center gap-3 flex-1 min-w-0 text-left" style={{ border: 0, background: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
                <Photo path={p.imagePath} />
                <div className="flex-1 min-w-0">
                  <div style={{ fontWeight: 600 }}>{p.name} {existing.includes(p.id) && <span className="vx-badge b-gray">Ya agregado</span>}</div>
                  <div className="vx-muted" style={{ fontSize: 12 }}>{p.sku} · {fmtBs(productPrice(p, db.settings))}{p.trackInventory ? ` · Stock ${st} ${p.unit}` : ""}</div>
                </div>
              </button>
              {on && <div className="vx-step" style={{ width: 128, flexShrink: 0 }}>
                <button type="button" aria-label="Restar" onClick={() => setSel({ ...sel, [p.id]: Math.max(1, r2(num(sel[p.id]) - 1)) })}>−</button>
                <input type="number" min="0" inputMode="decimal" value={sel[p.id]} onChange={(e) => setSel({ ...sel, [p.id]: e.target.value })} aria-label="Cantidad" />
                <button type="button" aria-label="Sumar" onClick={() => setSel({ ...sel, [p.id]: r2(num(sel[p.id]) + 1) })}>+</button>
              </div>}
            </div>
          );
        })}
        {!list.length && <Empty text={db.products.length ? "No se encontraron productos." : "El catálogo está vacío. Registra productos en Catálogo."} />}
      </div>
    </Modal>
  );
}

export default function QuoteEditor() {
  const { id } = useParams();
  const { db, go, run, log, notify, busy, setLeaveGuard } = useApp();
  const saved = db.quotations.find((q: any) => q.id === id);
  const savedSig = useMemo(() => JSON.stringify(saved || null), [saved]);
  const [draft, setDraft] = useState<any>(null);
  const [picker, setPicker] = useState(false);
  const [modal, setModal] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [form, setForm] = useState<any>({});
  const [imgLine, setImgLine] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(saved ? JSON.parse(JSON.stringify(saved)) : null);
    setErrors([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedSig]);

  const dirtyNow = !!(saved && draft && saved.status !== "aceptada" &&
    JSON.stringify({ ...draft, items: cleanItems(draft.items), versions: undefined, updatedAt: undefined }) !==
    JSON.stringify({ ...saved, items: cleanItems(saved.items), versions: undefined, updatedAt: undefined }));
  useEffect(() => { setLeaveGuard(dirtyNow); }, [dirtyNow, setLeaveGuard]);
  useEffect(() => () => setLeaveGuard(false), [setLeaveGuard]);
  const saveRef = useRef<() => void>(() => {});
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); saveRef.current(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  if (!saved) return <Empty text="La cotización no existe o fue eliminada." action={<Btn onClick={() => go("cotizaciones")}>Volver a cotizaciones</Btn>} />;
  if (!draft) return <Spinner />;

  const ro = saved.status === "aceptada";
  const pick = (q: any) => JSON.stringify({ ...q, items: cleanItems(q.items), versions: undefined, updatedAt: undefined });
  const dirty = pick(draft) !== pick(saved);
  const t = quoteTotals(draft);
  const set = (patch: any) => setDraft((q: any) => ({ ...q, ...patch }));
  const setLine = (lid: string, patch: any) => setDraft((q: any) => ({
    ...q,
    items: q.items.map((l: any) => {
      if (l.id !== lid) return l;
      const n = { ...l, ...patch };
      if ("markup" in patch) { n.price = suggested(num(n.cost), num(patch.markup)); n.priceManual = false; }
      if ("price" in patch) n.priceManual = true;
      if ("cost" in patch && !n.priceManual && n.markup !== null) n.price = suggested(num(patch.cost), num(n.markup));
      return n;
    }),
  }));
  const removeLine = (lid: string) => setDraft((q: any) => ({ ...q, items: q.items.filter((l: any) => l.id !== lid) }));
  const addProducts = (picked: any[]) => {
    setDraft((q: any) => ({
      ...q,
      items: [...q.items, ...picked.map(({ p, qty }: any) => ({
        id: newId(), kind: "producto", serviceKind: null, productId: p.id, name: p.name, description: p.description, unit: p.unit, qty,
        cost: Number(p.refCost), markup: productMarkup(p, db.settings), price: productPrice(p, db.settings), priceManual: p.pricingMode === "manual",
        discType: "%", discVal: 0, show: true, imagePath: p.imagePath, distributed: false, supplierId: p.supplierId || null,
      }))],
    }));
    setPicker(false);
    if (picked.length > 1) notify(`${picked.length} productos agregados`);
  };
  const addExtraCost = (name = "") => setDraft((q: any) => ({
    ...q,
    items: [...q.items, { id: newId(), kind: "costo", serviceKind: "Costo aparte", productId: null, name, description: "", unit: "servicio", qty: 1, cost: 0, markup: null, price: 0, priceManual: true, discType: "%", discVal: 0, show: false, imagePath: null, distributed: false }],
  }));
  const addService = (kind = "Mano de obra") => setDraft((q: any) => ({
    ...q,
    items: [...q.items, { id: newId(), kind: "servicio", serviceKind: kind, productId: null, name: kind, description: "", unit: "servicio", qty: 1, cost: 0, markup: null, price: 0, priceManual: true, discType: "%", discVal: 0, show: true, imagePath: null, distributed: false }],
  }));

  const company = db.companies.find((c: any) => c.id === draft.companyId);
  const client = db.clients.find((c: any) => c.id === draft.clientId);

  /* Guarda cabecera y líneas en una sola operación */
  const persist = async () => {
    let number = draft.number;
    if (saved.status === "borrador" && company && !String(number).startsWith(company.prefix + "-")) {
      number = await rpc("next_document_number", { p_prefix: company.prefix });
    }
    await rpc("save_quotation", {
      p_id: draft.id,
      p_header: {
        company_id: draft.companyId, client_id: draft.clientId || null, number, project_name: draft.projectName || "", address: draft.address || "",
        description: draft.description || "", date: draft.date, valid_until: draft.validUntil || null, terms: draft.terms || "",
        commercial_notes: draft.commercialNotes || "", internal_notes: draft.internalNotes || "", g_disc_type: draft.gDiscType || "%", g_disc_val: num(draft.gDiscVal),
        show_signature: draft.showSignature !== false, paper_size: draft.paperSize || "carta",
      },
      p_items: itemsPayload(orderedItems(draft.items)),
    });
    return number;
  };
  const snapshot = (number: string) => ({
    data: { ...draft, number, items: cleanItems(draft.items), versions: undefined },
    company: company || null,
    client: client || null,
  });
  const validate = () => {
    const e: string[] = [];
    if (!draft.clientId) e.push("Selecciona un cliente.");
    if (!String(draft.projectName || "").trim()) e.push("Escribe el nombre del proyecto.");
    if (!draft.items.some((l: any) => l.show)) e.push("Agrega al menos un concepto visible en el PDF.");
    if (t.total <= 0) e.push("El total comercial debe ser mayor que cero.");
    setErrors(e);
    return !e.length;
  };

  const save = () => run(async () => { const n = await persist(); await log(`Cotización ${n} guardada.`); }, "Cambios guardados", ["quotationsRaw", "quotationItems"]);
  saveRef.current = () => { if (dirty && !ro && !busy) save(); };
  const send = () => {
    if (!validate()) return;
    run(async () => {
      const n = await persist();
      const s = snapshot(n);
      const v = await rpc("add_quotation_version", { p_quotation: draft.id, p_reason: "enviada", p_data: s.data, p_company: s.company, p_client: s.client, p_set_status: "enviada" });
      await log(`Cotización ${n} marcada como enviada (versión ${v}).`);
    }, "Cotización marcada como enviada", ["quotationsRaw", "quotationItems", "versions"]);
  };
  const accept = async () => {
    let pid: any = null;
    const ok = await run(async () => {
      const n = await persist();
      const s = snapshot(n);
      pid = await rpc("accept_quotation", {
        p_quotation: draft.id, p_template: form.template || null, p_start: form.start || null,
        p_data: s.data, p_company: s.company, p_client: s.client, p_totals: quoteTotals(draft),
      });
      await log(`Cotización ${n} aceptada. Proyecto creado.`);
    }, "Cotización aceptada y proyecto creado");
    setModal(null);
    if (ok && pid) go("proyecto", pid, null, { force: true });
  };
  const reject = async () => {
    const ok = await run(async () => {
      if (dirty) await persist();
      await upd("quotations", draft.id, { status: "rechazada", rejectReason: form.reason || "" });
      await log(`Cotización ${draft.number} rechazada.`);
    }, "Cotización rechazada", ["quotationsRaw", "quotationItems"]);
    setModal(null);
    if (ok) go("cotizaciones", null, null, { force: true });
  };
  const toTrash = async () => {
    const ok = await run(async () => { await upd("quotations", draft.id, { deletedAt: todayLaPaz() }); await log(`Cotización ${draft.number} enviada a la papelera.`); }, "Cotización enviada a la papelera", ["quotationsRaw"]);
    if (ok) go("cotizaciones", null, null, { force: true });
  };
  const duplicate = async () => {
    if (dirty) { notify("Guarda los cambios antes de duplicar la cotización.", "error"); return; }
    let nid: any = null;
    const ok = await run(async () => {
      nid = await rpc("duplicate_quotation", { p_source: saved.id });
    }, "Copia creada. Los cambios que hagas en ella no afectan a la original.", ["quotationsRaw", "quotationItems"]);
    if (ok && nid) go("editor", nid, null, { force: true });
  };
  const preview = async () => {
    if (dirty && !ro) {
      const ok = await run(async () => { await persist(); }, undefined, ["quotationsRaw", "quotationItems"]);
      if (!ok) return;
    }
    go("preview", draft.id, null, { force: true });
  };
  const newClient = async () => {
    let cid = "";
    const ok = await run(async () => {
      const c = await ins("clients", { name: form.cname, contact: form.ccontact || "", phone: form.cphone || "" });
      cid = c.id;
      await log(`Cliente ${form.cname} registrado.`);
    }, "Cliente registrado", ["clients"]);
    if (ok && cid) { set({ clientId: cid }); setModal(null); }
  };
  const newSupplier = async () => {
    let sid = "";
    const ok = await run(async () => {
      const sp = await ins("suppliers", { name: form.sname, phone: form.sphone || "", contact: form.scontact || "" });
      sid = sp.id;
      await log(`Proveedor ${form.sname} registrado.`);
    }, "Proveedor registrado", ["suppliers"]);
    if (ok && sid) { if (form.lineId) setLine(form.lineId, { supplierId: sid }); setModal(null); }
  };
  const supplierName = (id?: string | null) => db.suppliers.find((x: any) => x.id === id)?.name || "Sin proveedor";
  const supSel = (l: any, style: any = {}) => (
    <select className="vx-in" style={{ fontSize: 13, ...style }} disabled={ro} value={l.supplierId || ""} aria-label="Proveedor"
      onChange={(e) => {
        if (e.target.value === "__new") { setForm({ sname: "", lineId: l.id }); setModal("supplier"); return; }
        setLine(l.id, { supplierId: e.target.value || null });
      }}>
      <option value="">— Proveedor —</option>
      {db.suppliers.filter((x: any) => x.active || x.id === l.supplierId).map((x: any) => <option key={x.id} value={x.id}>Proveedor: {x.name}</option>)}
      {!ro && <option value="__new">+ Nuevo proveedor…</option>}
    </select>
  );
  const onFile = async (e: any) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !imgLine) return;
    try {
      notify("Subiendo imagen…");
      const path = await uploadImage(f, `quotations/${draft.id}`);
      setLine(imgLine, { imagePath: path });
      notify("Imagen lista. Recuerda guardar los cambios.");
    } catch (err: any) {
      notify(err?.message || "No se pudo subir la imagen.", "error");
    }
  };

  const products = orderedItems(draft.items).filter((l: any) => l.kind === "producto");
  const services = orderedItems(draft.items).filter((l: any) => l.kind === "servicio");
  const extras = draft.items.filter((l: any) => l.kind === "costo");
  const hiddenLines = draft.items.filter((l: any) => !l.show && l.kind !== "costo");

  const disc = (l: any) => (
    <div className="flex gap-1" style={{ minWidth: 118 }}>
      <input className="vx-in num" style={{ width: 64 }} type="number" min="0" inputMode="decimal" disabled={ro} value={l.discVal} onChange={(e) => setLine(l.id, { discVal: e.target.value })} aria-label="Descuento" />
      <select className="vx-in" style={{ width: 56, padding: "7px 4px" }} disabled={ro} value={l.discType} onChange={(e) => setLine(l.id, { discType: e.target.value })} aria-label="Tipo de descuento"><option value="%">%</option><option value="Bs">Bs</option></select>
    </div>
  );
  const eye = (l: any) => (
    <button className="vx-btn sm" disabled={ro} title={l.show ? "Visible en el PDF" : "Oculto en el PDF"} onClick={() => setLine(l.id, { show: !l.show, distributed: false })}
      style={l.show ? {} : { background: "var(--amber-soft)", borderColor: "#E9CFA3", color: "var(--amber)" }}>
      {l.show ? <Eye size={13} /> : <EyeOff size={13} />}{l.show ? "Visible" : "Oculto"}
    </button>
  );
  const stepper = (l: any) => (
    <div className="vx-step">
      <button type="button" disabled={ro} aria-label="Restar" onClick={() => setLine(l.id, { qty: Math.max(0, r2(num(l.qty) - 1)) })}>−</button>
      <input type="number" min="0" inputMode="decimal" disabled={ro} value={l.qty} onChange={(e) => setLine(l.id, { qty: e.target.value })} aria-label="Cantidad" />
      <button type="button" disabled={ro} aria-label="Sumar" onClick={() => setLine(l.id, { qty: r2(num(l.qty) + 1) })}>+</button>
    </div>
  );
  const lineFoot = (l: any, c: any) => (
    <div className="flex items-center justify-between gap-2 mt-3">{eye(l)}
      <div className="text-right"><div className="vx-muted" style={{ fontSize: 11 }}>{l.show ? "Total de la línea" : l.distributed ? "Incluido en los precios" : "No suma al total"}</div><div style={{ fontWeight: 800, fontSize: 17 }}>{fmtBs(c.total)}</div></div>
    </div>
  );
  const pickImage = (lid: string) => { setImgLine(lid); fileRef.current?.click(); };

  /* Orden y numeración */
  const pdfNo: Record<string, number> = {};
  orderedItems(draft.items).filter((l: any) => l.show && l.kind !== "costo").forEach((l: any, i: number) => (pdfNo[l.id] = i + 1));
  const moveTo = (fromId: string, toId: string) => setDraft((q: any) => {
    const items = orderedItems(q.items);
    const from = items.findIndex((l: any) => l.id === fromId), to = items.findIndex((l: any) => l.id === toId);
    if (from < 0 || to < 0 || from === to || items[from].kind !== items[to].kind) return q;
    const [m] = items.splice(from, 1);
    items.splice(to, 0, m);
    return { ...q, items };
  });
  const move = (l: any, dir: number) => {
    const list = orderedItems(draft.items).filter((x: any) => x.kind === l.kind);
    const i = list.findIndex((x: any) => x.id === l.id);
    const t = list[i + dir];
    if (t) moveTo(l.id, t.id);
  };
  const dragProps = (l: any) => ro ? {} : {
    draggable: dragId === l.id,
    onDragStart: (e: any) => { e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", l.id); } catch { /* */ } },
    onDragOver: (e: any) => { if (dragId) { e.preventDefault(); setOverId(l.id); } },
    onDrop: (e: any) => { e.preventDefault(); if (dragId) moveTo(dragId, l.id); setDragId(null); setOverId(null); },
    onDragEnd: () => { setDragId(null); setOverId(null); },
  };
  const handleCell = (l: any) => (
    <td style={{ width: 46, whiteSpace: "nowrap" }}>
      <div className="flex items-center gap-1">
        {!ro && <span title="Arrastra para mover" aria-label="Arrastra para mover" style={{ cursor: "grab", color: "var(--muted)", display: "inline-flex" }}
          onMouseDown={() => setDragId(l.id)} onMouseUp={() => setDragId(null)}><GripVertical size={16} /></span>}
        <b style={{ fontSize: 12, color: "var(--lens-dark)" }}>{pdfNo[l.id] || "—"}</b>
      </div>
    </td>
  );
  const rowStyle = (l: any) => ({ ...(l.show ? {} : { background: "#FFFBF3" }), ...(overId === l.id && dragId && dragId !== l.id ? { boxShadow: "inset 0 3px 0 var(--lens)" } : {}), ...(dragId === l.id ? { opacity: 0.5 } : {}) });
  const cardHead = (l: any, list: any[]) => {
    const i = list.findIndex((x: any) => x.id === l.id);
    return (
      <div className="flex items-center justify-between mb-2">
        <span className="vx-badge b-purple">{pdfNo[l.id] ? `Ítem ${pdfNo[l.id]}` : "No sale en el PDF"}</span>
        {!ro && <div className="flex gap-1">
          <button className="vx-btn sm" disabled={i <= 0} aria-label="Subir" onClick={() => move(l, -1)}><ChevronUp size={15} /></button>
          <button className="vx-btn sm" disabled={i >= list.length - 1} aria-label="Bajar" onClick={() => move(l, 1)}><ChevronDown size={15} /></button>
        </div>}
      </div>
    );
  };

  const productCard = (l: any) => {
    const c = lineCalc(l);
    const cat = db.products.find((p: any) => p.id === l.productId);
    return (
      <div key={l.id} className={`vx-lcard ${l.show ? "" : "off"}`}>
        {cardHead(l, products)}
        <div className="flex gap-3 items-start">
          <button className="vx-btn gh" style={{ padding: 0 }} disabled={ro} aria-label="Reemplazar foto" onClick={() => pickImage(l.id)}><Photo path={l.imagePath} size={60} /></button>
          <div className="flex-1 min-w-0">
            <input className="vx-in" style={{ fontWeight: 600 }} disabled={ro} value={l.name} onChange={(e) => setLine(l.id, { name: e.target.value })} aria-label="Nombre del producto" />
            <div className="vx-muted mt-1" style={{ fontSize: 12 }}>{l.priceManual ? "Precio manual" : `Incremento ${l.markup} %`} · margen {fmtPct(marginOf(c.total, c.cost))}</div>
          </div>
          {!ro && <button className="vx-btn gh sm" aria-label="Quitar línea" onClick={() => removeLine(l.id)}><Trash2 size={16} /></button>}
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <Field label={`Cantidad (${l.unit})`}>{stepper(l)}</Field>
          <Field label="Precio unitario (Bs)"><input className="vx-in num" style={{ fontWeight: 700 }} type="number" min="0" inputMode="decimal" disabled={ro} value={l.price} onChange={(e) => setLine(l.id, { price: e.target.value })} /></Field>
        </div>
        <div className="mt-3">{supSel(l)}</div>
        {lineFoot(l, c)}
        <details className="mt-2"><summary>Costo, incremento, descuento y foto ▾</summary>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <Field label="Costo (Bs)"><input className="vx-in num" type="number" min="0" inputMode="decimal" disabled={ro} value={l.cost} onChange={(e) => setLine(l.id, { cost: e.target.value })} /></Field>
            <Field label="Incremento (%)"><input className="vx-in num" type="number" inputMode="decimal" disabled={ro} value={l.priceManual ? r2(markupOf(num(l.price), num(l.cost)) ?? 0) : (l.markup ?? "")} onChange={(e) => setLine(l.id, { markup: e.target.value })} /></Field>
            <Field label="Descuento">{disc(l)}</Field>
            <div><span className="vx-lbl">Precio sugerido</span><b>{fmtBs(suggested(num(l.cost), num(l.markup)))}</b></div>
          </div>
          <Field label="Descripción en el PDF" className="mt-2"><textarea className="vx-in" rows={2} disabled={ro} value={l.description} onChange={(e) => setLine(l.id, { description: e.target.value })} /></Field>
          {!ro && cat && l.imagePath !== cat.imagePath && <Btn sm v="gh" className="mt-1" onClick={() => setLine(l.id, { imagePath: cat.imagePath })}>Usar la foto del catálogo</Btn>}
        </details>
      </div>
    );
  };
  const serviceCard = (l: any) => {
    const c = lineCalc(l);
    return (
      <div key={l.id} className={`vx-lcard ${l.show ? "" : "off"}`}>
        {cardHead(l, services)}
        <div className="flex gap-2 items-start">
          <div className="flex-1 min-w-0 grid gap-2">
            <select className="vx-in" disabled={ro} value={l.serviceKind || "Otro"} onChange={(e) => setLine(l.id, { serviceKind: e.target.value })} aria-label="Tipo de servicio">{SERVICE_KINDS.map((k) => <option key={k}>{k}</option>)}</select>
            <input className="vx-in" style={{ fontWeight: 600 }} disabled={ro} value={l.name} onChange={(e) => setLine(l.id, { name: e.target.value })} aria-label="Concepto" />
          </div>
          {!ro && <button className="vx-btn gh sm" aria-label="Quitar concepto" onClick={() => removeLine(l.id)}><Trash2 size={16} /></button>}
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <Field label="Cantidad">{stepper(l)}</Field>
          <Field label="Precio al cliente (Bs)"><input className="vx-in num" style={{ fontWeight: 700 }} type="number" min="0" inputMode="decimal" disabled={ro} value={l.price} onChange={(e) => setLine(l.id, { price: e.target.value })} /></Field>
          <Field label="Costo interno (Bs)"><input className="vx-in num" type="number" min="0" inputMode="decimal" disabled={ro} value={l.cost} onChange={(e) => setLine(l.id, { cost: e.target.value })} /></Field>
          <Field label="Descuento">{disc(l)}</Field>
        </div>
        {lineFoot(l, c)}
      </div>
    );
  };

  return (
    <div>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={onFile} />
      <PageHead back={{ label: "Cotizaciones", onClick: () => go("cotizaciones") }}
        title={<span className="flex flex-wrap items-center gap-3">{draft.number} <Badge map={Q_STATUS} s={saved.status} />{isExpired(saved) && <span className="vx-badge b-red">Vencida</span>}</span>}
        sub={ro ? "Cotización aceptada: el documento está bloqueado para conservar lo acordado." : dirty ? "Tienes cambios sin guardar." : "Todos los cambios están guardados."}
        actions={<>
          {!ro && <Btn v="pri" icon={Save} disabled={!dirty || busy} onClick={save}>Guardar cambios</Btn>}
          <Btn icon={Eye} disabled={busy} onClick={preview}>Vista previa</Btn>
          {!ro && saved.status !== "rechazada" && <Btn icon={Send} disabled={busy} onClick={send}>{saved.status === "enviada" ? "Enviar nueva versión" : "Marcar como enviada"}</Btn>}
          {!ro && saved.status !== "rechazada" && <Btn icon={ThumbsUp} disabled={busy} onClick={() => { if (validate()) { setForm({ template: db.checklistTemplates.find((x: any) => x.active)?.id || "", start: "" }); setModal("accept"); } }}>Aceptar</Btn>}
          {saved.status === "enviada" && <Btn v="dng" icon={ThumbsDown} onClick={() => { setForm({ reason: "" }); setModal("reject"); }}>Rechazar</Btn>}
          <Btn icon={Copy} disabled={busy} onClick={duplicate}>Duplicar</Btn>
          {["rechazada", "borrador"].includes(saved.status) && <Btn v="dng" icon={Trash2} onClick={toTrash}>Enviar a papelera</Btn>}
          {ro && saved.projectId && <Btn v="pri" icon={FolderKanban} onClick={() => go("proyecto", saved.projectId)}>Ver proyecto</Btn>}
        </>} />

      {errors.length > 0 && <div className="vx-card p-3 mb-4" style={{ borderColor: "#EBC3C3", background: "var(--rec-soft)" }}>{errors.map((e) => <div key={e} style={{ color: "var(--rec)" }}>• {e}</div>)}</div>}
      {saved.copiedFrom && (() => {
        const src = db.quotations.find((x: any) => x.id === saved.copiedFrom);
        return <div className="vx-card p-3 mb-4" style={{ background: "var(--cyan-soft)", borderColor: "#A9E6E8" }}>
          Esta es una copia{src ? <> de <button className="vx-link" onClick={() => go("editor", src.id)}>{src.number}</button></> : ""}. Los cambios que hagas aquí no modifican la cotización original.
        </div>;
      })()}
      {saved.status === "rechazada" && <div className="vx-card p-3 mb-4" style={{ background: "var(--rec-soft)", borderColor: "#EBC3C3" }}>Rechazada. Motivo: {saved.rejectReason || "sin especificar"}.</div>}

      <div className="vx-editor">
        <div className="space-y-5" style={{ minWidth: 0 }}>
          <div className="vx-card p-4">
            <h2 className="mb-3">Datos de la cotización</h2>
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))" }}>
              <Field label="Empresa emisora"><Sel disabled={ro || saved.status !== "borrador"} value={draft.companyId}
                onChange={(e: any) => { const c = db.companies.find((x: any) => x.id === e.target.value); set({ companyId: c.id, terms: c.terms || draft.terms }); }}
                options={db.companies.filter((c: any) => c.active || c.id === draft.companyId).map((c: any) => ({ value: c.id, label: c.tradeName }))} /></Field>
              <Field label="Cliente"><div className="flex gap-2">
                <Sel disabled={ro} value={draft.clientId || ""} onChange={(e: any) => set({ clientId: e.target.value })} options={[{ value: "", label: "Selecciona un cliente" }, ...db.clients.filter((c: any) => c.active || c.id === draft.clientId).map((c: any) => ({ value: c.id, label: c.name }))]} />
                {!ro && <Btn sm icon={Plus} title="Nuevo cliente" aria-label="Nuevo cliente" onClick={() => { setForm({ cname: "" }); setModal("client"); }} />}
              </div></Field>
              <Field label="Nombre del proyecto"><Inp disabled={ro} value={draft.projectName} onChange={(e: any) => set({ projectName: e.target.value })} /></Field>
              <Field label="Dirección de instalación"><Inp disabled={ro} value={draft.address} onChange={(e: any) => set({ address: e.target.value })} /></Field>
              <Field label="Fecha"><Inp disabled={ro} type="date" value={draft.date || ""} onChange={(e: any) => set({ date: e.target.value })} /></Field>
              <Field label="Válida hasta"><Inp disabled={ro} type="date" value={draft.validUntil || ""} onChange={(e: any) => set({ validUntil: e.target.value })} /></Field>
              <Field label="Tamaño de papel del PDF"><Sel disabled={ro} value={draft.paperSize || "carta"} onChange={(e: any) => set({ paperSize: e.target.value })} options={Object.entries(PAPER).map(([value, p]) => ({ value, label: p.label }))} /></Field>
            </div>
            <Field label="Descripción del trabajo" className="mt-3"><textarea className="vx-in" rows={2} disabled={ro} value={draft.description} onChange={(e) => set({ description: e.target.value })} /></Field>
          </div>

          <div className="vx-card" style={{ overflow: "hidden" }}>
            <div className="p-4"><h2>Detalle de la cotización</h2><div className="vx-muted" style={{ fontSize: 12 }}>Ve agregando equipos y servicios; el total para el cliente se actualiza al final de esta sección.</div></div>
            <div className="vx-sec flex flex-wrap items-center justify-between gap-2"><span>Equipos y materiales ({products.length})</span>{!ro && <Btn sm v="pri" icon={Plus} onClick={() => setPicker(true)}>Agregar producto</Btn>}</div>
            {products.length ? <>
              <div className="vx-scroll vx-only-desk">
                <table className="vx-tbl"><thead><tr><th>N.º</th><th>Foto</th><th style={{ minWidth: 190 }}>Producto</th><th className="r">Cant.</th><th className="r">Costo</th><th className="r">Incremento</th><th className="r">Precio final</th><th className="r">Total</th><th>PDF</th><th>Descuento</th><th></th></tr></thead>
                  <tbody>{products.map((l: any) => {
                    const c = lineCalc(l);
                    const cat = db.products.find((p: any) => p.id === l.productId);
                    return (
                      <tr key={l.id} style={rowStyle(l)} {...dragProps(l)}>
                        {handleCell(l)}
                        <td><button className="vx-btn gh" style={{ padding: 0 }} disabled={ro} title="Reemplazar la foto solo en esta cotización" onClick={() => pickImage(l.id)}><Photo path={l.imagePath} /></button>
                          {!ro && cat && l.imagePath !== cat.imagePath && <div><button className="vx-link" style={{ fontSize: 11 }} onClick={() => setLine(l.id, { imagePath: cat.imagePath })}>Usar la del catálogo</button></div>}</td>
                        <td><input className="vx-in" disabled={ro} value={l.name} onChange={(e) => setLine(l.id, { name: e.target.value })} /><textarea className="vx-in mt-1" rows={1} style={{ fontSize: 12 }} disabled={ro} value={l.description} onChange={(e) => setLine(l.id, { description: e.target.value })} />{supSel(l, { marginTop: 4 })}</td>
                        <td><div className="flex items-center gap-1"><input className="vx-in num" style={{ width: 62 }} type="number" min="0" disabled={ro} value={l.qty} onChange={(e) => setLine(l.id, { qty: e.target.value })} /><span className="vx-muted" style={{ fontSize: 11 }}>{l.unit}</span></div></td>
                        <td className="r"><input className="vx-in num" style={{ width: 78 }} type="number" min="0" disabled={ro} value={l.cost} onChange={(e) => setLine(l.id, { cost: e.target.value })} /><div className="vx-muted nw" style={{ fontSize: 11 }}>Total {fmtBs(c.cost)}</div></td>
                        <td className="r"><div className="flex items-center gap-1"><input className="vx-in num" style={{ width: 66 }} type="number" disabled={ro} value={l.priceManual ? r2(markupOf(num(l.price), num(l.cost)) ?? 0) : (l.markup ?? "")} onChange={(e) => setLine(l.id, { markup: e.target.value })} /><span className="vx-muted">%</span></div></td>
                        <td className="r"><input className="vx-in num" style={{ width: 96, fontWeight: 600, borderColor: l.priceManual ? "#E9CFA3" : undefined }} type="number" min="0" disabled={ro} value={l.price} onChange={(e) => setLine(l.id, { price: e.target.value })} />
                          <div style={{ fontSize: 11, color: l.priceManual ? "var(--amber)" : "var(--muted)" }}>{l.priceManual ? "Manual · " : ""}Sugerido {fmtBs(suggested(num(l.cost), num(l.markup)))}</div></td>
                        <td className="r nw" style={{ fontWeight: 600 }}>{fmtBs(c.total)}<div className="vx-muted" style={{ fontSize: 11 }}>Margen {fmtPct(marginOf(c.total, c.cost))}</div></td>
                        <td>{eye(l)}</td>
                        <td>{disc(l)}</td>
                        <td>{!ro && <button className="vx-btn gh sm" aria-label="Quitar línea" onClick={() => removeLine(l.id)}><Trash2 size={14} /></button>}</td>
                      </tr>
                    );
                  })}</tbody>
                  <tfoot><tr><td colSpan={4}>Totales de equipos y materiales</td><td className="r nw">{fmtBs(t.costProd)}<div className="vx-muted" style={{ fontSize: 11, fontWeight: 500 }}>costo real</div></td><td></td><td></td><td className="r nw">{fmtBs(t.prod)}<div className="vx-muted" style={{ fontSize: 11, fontWeight: 500 }}>al cliente</div></td><td colSpan={3}></td></tr></tfoot>
                </table>
              </div>
              <div className="vx-only-mob p-3 space-y-3">{products.map(productCard)}{!ro && <Btn icon={Plus} className="w-full justify-center" onClick={() => setPicker(true)}>Agregar otro producto</Btn>}</div>
            </> : <Empty text="Agrega equipos y materiales del catálogo." action={!ro && <Btn v="pri" icon={Plus} onClick={() => setPicker(true)}>Agregar producto</Btn>} />}
            {products.length > 0 && <div className="vx-only-mob px-4 py-2" style={{ fontSize: 13 }}><Row k="Costo real de equipos y materiales" v={fmtBs(t.costProd)} /><Row k="Equipos y materiales al cliente" v={fmtBs(t.prod)} strong /></div>}

            <div className="vx-sec flex flex-wrap items-center justify-between gap-2"><span>Mano de obra, transporte y servicios ({services.length})</span>
              {!ro && <div className="flex flex-wrap gap-2">{["Mano de obra", "Transporte", "Alimentación"].map((k) => <Btn key={k} sm icon={Plus} onClick={() => addService(k)}>{k}</Btn>)}<Btn sm icon={Plus} onClick={() => addService("Otro")}>Otro</Btn></div>}</div>
            {services.length ? <>
              <div className="vx-scroll vx-only-desk">
                <table className="vx-tbl"><thead><tr><th>N.º</th><th>Tipo</th><th style={{ minWidth: 200 }}>Concepto</th><th className="r">Cant.</th><th className="r">Precio al cliente</th><th className="r">Costo interno</th><th className="r">Total</th><th>PDF</th><th>Descuento</th><th></th></tr></thead>
                  <tbody>{services.map((l: any) => {
                    const c = lineCalc(l);
                    return (
                      <tr key={l.id} style={rowStyle(l)} {...dragProps(l)}>
                        {handleCell(l)}
                        <td><select className="vx-in" style={{ width: 150 }} disabled={ro} value={l.serviceKind || "Otro"} onChange={(e) => setLine(l.id, { serviceKind: e.target.value })}>{SERVICE_KINDS.map((k) => <option key={k}>{k}</option>)}</select></td>
                        <td><input className="vx-in" disabled={ro} value={l.name} onChange={(e) => setLine(l.id, { name: e.target.value })} /></td>
                        <td className="r"><input className="vx-in num" style={{ width: 64 }} type="number" min="0" disabled={ro} value={l.qty} onChange={(e) => setLine(l.id, { qty: e.target.value })} /></td>
                        <td className="r"><input className="vx-in num" style={{ width: 96 }} type="number" min="0" disabled={ro} value={l.price} onChange={(e) => setLine(l.id, { price: e.target.value })} /></td>
                        <td className="r"><input className="vx-in num" style={{ width: 96 }} type="number" min="0" disabled={ro} value={l.cost} onChange={(e) => setLine(l.id, { cost: e.target.value })} /></td>
                        <td className="r nw" style={{ fontWeight: 600 }}>{l.show ? fmtBs(c.total) : <span className="vx-muted" title="No suma al total del PDF">{l.distributed ? "Distribuido" : fmtBs(c.total)}</span>}</td>
                        <td>{eye(l)}</td>
                        <td>{disc(l)}</td>
                        <td>{!ro && <button className="vx-btn gh sm" aria-label="Quitar concepto" onClick={() => removeLine(l.id)}><Trash2 size={14} /></button>}</td>
                      </tr>
                    );
                  })}</tbody>
                  <tfoot><tr><td colSpan={5}>Totales de servicios</td><td className="r nw">{fmtBs(t.costServ)}<div className="vx-muted" style={{ fontSize: 11, fontWeight: 500 }}>costo real</div></td><td className="r nw">{fmtBs(t.serv)}<div className="vx-muted" style={{ fontSize: 11, fontWeight: 500 }}>al cliente</div></td><td colSpan={3}></td></tr></tfoot>
                </table>
              </div>
              <div className="vx-only-mob p-3 space-y-3">{services.map(serviceCard)}</div>
            </> : <Empty text="Sin servicios. Agrega mano de obra, transporte u otros conceptos." />}
            {services.length > 0 && <div className="vx-only-mob px-4 py-2" style={{ fontSize: 13 }}><Row k="Costo real de servicios" v={fmtBs(t.costServ)} /><Row k="Servicios al cliente" v={fmtBs(t.serv)} strong /></div>}

            <div className="vx-sec flex flex-wrap items-center justify-between gap-2"><span>Costos aparte · no se muestran al cliente ({extras.length})</span>
              {!ro && <div className="flex flex-wrap gap-2">{["Viáticos", "Comisión", "Alquiler de equipo"].map((k) => <Btn key={k} sm icon={Plus} onClick={() => addExtraCost(k)}>{k}</Btn>)}<Btn sm icon={Plus} onClick={() => addExtraCost("")}>Otro costo</Btn></div>}</div>
            {extras.length ? <>
              <div className="vx-scroll vx-only-desk">
                <table className="vx-tbl"><thead><tr><th style={{ minWidth: 240 }}>Concepto</th><th className="r">Cant.</th><th className="r">Costo unitario</th><th className="r">Costo total</th><th></th></tr></thead>
                  <tbody>{extras.map((l: any) => (
                    <tr key={l.id}>
                      <td><input className="vx-in" placeholder="Ej.: viáticos del técnico" disabled={ro} value={l.name} onChange={(e) => setLine(l.id, { name: e.target.value })} /></td>
                      <td className="r"><input className="vx-in num" style={{ width: 64 }} type="number" min="0" disabled={ro} value={l.qty} onChange={(e) => setLine(l.id, { qty: e.target.value })} /></td>
                      <td className="r"><input className="vx-in num" style={{ width: 100 }} type="number" min="0" disabled={ro} value={l.cost} onChange={(e) => setLine(l.id, { cost: e.target.value })} /></td>
                      <td className="r nw" style={{ fontWeight: 600 }}>{fmtBs(lineCalc(l).cost)}</td>
                      <td>{!ro && <button className="vx-btn gh sm" aria-label="Quitar costo" onClick={() => removeLine(l.id)}><Trash2 size={14} /></button>}</td>
                    </tr>
                  ))}</tbody>
                  <tfoot><tr><td colSpan={3}>Total de costos aparte</td><td className="r nw">{fmtBs(t.costExtra)}</td><td></td></tr></tfoot>
                </table>
              </div>
              <div className="vx-only-mob p-3 space-y-3">{extras.map((l: any) => (
                <div key={l.id} className="vx-lcard">
                  <div className="flex gap-2 items-start">
                    <input className="vx-in flex-1" style={{ fontWeight: 600 }} placeholder="Ej.: viáticos del técnico" disabled={ro} value={l.name} onChange={(e) => setLine(l.id, { name: e.target.value })} aria-label="Concepto" />
                    {!ro && <button className="vx-btn gh sm" aria-label="Quitar costo" onClick={() => removeLine(l.id)}><Trash2 size={16} /></button>}
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <Field label="Cantidad">{stepper(l)}</Field>
                    <Field label="Costo unitario (Bs)"><input className="vx-in num" type="number" min="0" inputMode="decimal" disabled={ro} value={l.cost} onChange={(e) => setLine(l.id, { cost: e.target.value })} /></Field>
                  </div>
                  <div className="flex justify-between mt-2"><span className="vx-muted" style={{ fontSize: 12 }}>Costo total</span><b>{fmtBs(lineCalc(l).cost)}</b></div>
                </div>
              ))}<Row k="Total de costos aparte" v={fmtBs(t.costExtra)} strong /></div>
            </> : <div className="px-4 py-3 vx-muted" style={{ fontSize: 13 }}>Gastos internos que no cobras por separado ni aparecen en el PDF: viáticos, comisiones, alquileres, etc. Se suman al costo total.</div>}

            <div className="p-4 pt-2">
              <div className="vx-total">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div style={{ minWidth: 220 }}>
                    <div className="muted" style={{ fontSize: 12, fontWeight: 600 }}>TOTAL QUE VERÁ EL CLIENTE</div>
                    <div className="big mt-1">{fmtBs(t.total)}</div>
                    <div className="muted mt-1" style={{ fontSize: 12 }}>Igual a la suma de los conceptos visibles en el PDF.</div>
                  </div>
                  <div style={{ minWidth: 240, flex: "0 1 320px", fontSize: 13 }}>
                    <div className="flex justify-between py-1"><span className="muted">Equipos y materiales</span><span>{fmtBs(t.prod)}</span></div>
                    <div className="flex justify-between py-1"><span className="muted">Servicios visibles</span><span>{fmtBs(t.serv)}</span></div>
                    {t.lineDisc > 0 && <div className="flex justify-between py-1"><span className="muted">Descuentos por línea (ya aplicados)</span><span>- {fmtBs(t.lineDisc)}</span></div>}
                    <div className="flex items-center justify-between gap-2 py-1"><span className="muted">Descuento global</span>
                      <div className="flex gap-1">
                        <input className="vx-in num" style={{ width: 76 }} type="number" min="0" inputMode="decimal" disabled={ro} value={draft.gDiscVal} onChange={(e) => set({ gDiscVal: e.target.value })} aria-label="Descuento global" />
                        <select className="vx-in" style={{ width: 60, padding: "7px 4px" }} disabled={ro} value={draft.gDiscType} onChange={(e) => set({ gDiscType: e.target.value })} aria-label="Tipo de descuento"><option value="%">%</option><option value="Bs">Bs</option></select>
                      </div></div>
                    {t.gdisc > 0 && <div className="flex justify-between py-1"><span className="muted">Descuento aplicado</span><span>- {fmtBs(t.gdisc)}</span></div>}
                  </div>
                </div>
              </div>

              <div className="vx-card vx-vf mt-3" style={{ background: "#FAF7FE" }}>
                <h3 className="mb-1">Costos y ganancia · solo para ti</h3>
                <div className="vx-muted mb-2" style={{ fontSize: 12 }}>Nada de esto aparece en el PDF del cliente.</div>
                <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,260px),1fr))" }}>
                  <div>
                    <Row k="Costo real de equipos y materiales" v={fmtBs(t.costProd)} />
                    <Row k="Costo real de servicios y otros" v={fmtBs(t.costServ)} />
                    <div style={{ borderTop: "1px solid var(--line)" }}><Row k="Costo de la cotización" v={fmtBs(t.quoteCost)} strong /></div>
                    <Row k="Costos aparte" v={fmtBs(t.costExtra)} />
                    <div style={{ borderTop: "2px solid var(--lens)" }}><Row k="Costo total" v={fmtBs(t.cost)} strong /></div>
                  </div>
                  <div>
                    <Row k="Total al cliente" v={fmtBs(t.total)} />
                    <Row k="Costo total" v={"- " + fmtBs(t.cost)} />
                    <div style={{ borderTop: "2px solid var(--lens)" }}><Row k="Ganancia líquida" v={fmtBs(t.profit)} strong tone={toneOf(t.profit)} /></div>
                    <Row k="Margen de ganancia" v={fmtPct(t.margin)} strong tone={toneOf(t.profit)} />
                    <Row k="Incremento sobre el costo" v={fmtPct(t.markup)} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="vx-card p-4 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))" }}>
            <Field label="Condiciones de pago (aparecen en el PDF)"><textarea className="vx-in" rows={3} disabled={ro} value={draft.terms} onChange={(e) => set({ terms: e.target.value })} /></Field>
            <Field label="Observaciones comerciales (aparecen en el PDF)"><textarea className="vx-in" rows={3} disabled={ro} value={draft.commercialNotes} onChange={(e) => set({ commercialNotes: e.target.value })} /></Field>
            <Field label="Notas internas (solo en Vortex)"><textarea className="vx-in" rows={3} disabled={ro} value={draft.internalNotes} onChange={(e) => set({ internalNotes: e.target.value })} /></Field>
            <div className="col-span-full flex flex-wrap items-center gap-3" style={{ borderTop: "1px solid var(--line)", paddingTop: 10 }}>
              <label className="flex items-center gap-2" style={{ fontSize: 14, fontWeight: 600 }}>
                <input type="checkbox" style={{ width: 18, height: 18, accentColor: "#7928CA" }} disabled={ro} checked={draft.showSignature !== false} onChange={(e) => set({ showSignature: e.target.checked })} />
                Incluir la firma al final de la cotización
              </label>
              {company && !company.signaturePath && !company.signerName
                ? <span className="vx-muted" style={{ fontSize: 12 }}>La empresa {company.tradeName} aún no tiene firma. <button className="vx-link" onClick={() => go("empresas")}>Agregarla en Empresas emisoras</button></span>
                : company && <span className="vx-muted" style={{ fontSize: 12 }}>Firma de {company.signerName || company.tradeName}{company.signerTitle ? ` · ${company.signerTitle}` : ""}</span>}
            </div>
          </div>
        </div>

        <div className="vx-editor-side">
          {products.length > 0 && (
            <div className="vx-card p-4">
              <h3 className="mb-1">Compras por proveedor</h3>
              <div className="vx-muted mb-2" style={{ fontSize: 12 }}>Costo de los equipos y materiales de esta cotización. Solo se ve aquí, nunca en el PDF.</div>
              {Object.entries(products.reduce((acc: any, l: any) => {
                const k = l.supplierId || "";
                acc[k] = acc[k] || { cost: 0, n: 0 };
                acc[k].cost += lineCalc(l).cost; acc[k].n += 1;
                return acc;
              }, {})).sort((a: any, b: any) => b[1].cost - a[1].cost).map(([k, v]: any) => (
                <Row key={k || "none"} k={`${supplierName(k)} (${v.n})`} v={fmtBs(v.cost)} tone={k ? undefined : "amber"} />
              ))}
            </div>
          )}
          {hiddenLines.length > 0 && (
            <div className="vx-card p-4" style={{ borderColor: "#E9CFA3" }}>
              <h3 className="mb-1 flex items-center gap-2"><EyeOff size={15} color="var(--amber)" />Conceptos ocultos en el PDF</h3>
              {hiddenLines.map((l: any) => <Row key={l.id} k={l.name} v={l.distributed ? "Distribuido" : `Costo ${fmtBs(lineCalc(l).cost)}`} />)}
              {t.hidden > 0 ? <>
                <div className="mt-2" style={{ fontSize: 13 }}>Valor de venta sin cobrar: <b>{fmtBs(t.hidden)}</b>. Hoy no suma al total; solo su costo reduce tu ganancia.</div>
                {!ro && <Btn sm v="pri" className="mt-2" onClick={() => { setDraft(distributeHidden(draft)); notify("Valor repartido en las líneas visibles. Recuerda guardar."); }}>Distribuir en líneas visibles</Btn>}
              </> : <div className="vx-muted mt-2" style={{ fontSize: 12 }}>Su valor ya está incluido en los precios visibles.</div>}
            </div>
          )}
          <div className="vx-card p-4">
            <h3 className="mb-2">Versiones</h3>
            {saved.versions.length ? saved.versions.slice().reverse().map((v: any) => (
              <div key={v.id} className="flex items-center justify-between py-1">
                <div><b>Versión {v.n}</b> <span className={`vx-badge ${v.reason === "aceptada" ? "b-green" : "b-gray"}`}>{v.reason === "aceptada" ? "Aceptada" : "Enviada"}</span>
                  <div className="vx-muted" style={{ fontSize: 12 }}>{fmtDate(v.date)} · {fmtBs(quoteTotals(v.data).total)}</div></div>
                <Btn sm icon={Eye} onClick={() => go("preview", draft.id, v.n)}>Ver</Btn>
              </div>
            )) : <div className="vx-muted" style={{ fontSize: 13 }}>Se crea una versión cada vez que marcas la cotización como enviada o aceptada.</div>}
          </div>
        </div>
      </div>

      <div className="vx-mbar no-print">
        <div className="flex-1 min-w-0"><div style={{ fontSize: 11, color: "#B9BDD6", fontWeight: 600 }}>Total que verá el cliente</div><div style={{ fontWeight: 800, fontSize: 20 }}>{fmtBs(t.total)}</div><div style={{ fontSize: 11, color: t.profit < 0 ? "#FF9C9C" : "#7FE3B0" }}>Ganancia {fmtBs(t.profit)}</div></div>
        <Btn icon={Eye} onClick={preview} aria-label="Vista previa">PDF</Btn>
        {!ro && <Btn v="pri" icon={Save} disabled={!dirty || busy} onClick={save}>Guardar</Btn>}
      </div>

      {picker && <ProductPicker onPick={addProducts} existing={products.map((l: any) => l.productId)} onClose={() => setPicker(false)} />}
      {modal === "client" && (
        <Modal title="Nuevo cliente" onClose={() => setModal(null)} footer={<><Btn onClick={() => setModal(null)}>Cancelar</Btn><Btn v="pri" disabled={!form.cname || busy} onClick={newClient}>Registrar cliente</Btn></>}>
          <div className="space-y-3">
            <Field label="Nombre o razón social"><Inp autoFocus value={form.cname || ""} onChange={(e: any) => setForm({ ...form, cname: e.target.value })} /></Field>
            <Field label="Persona de contacto"><Inp value={form.ccontact || ""} onChange={(e: any) => setForm({ ...form, ccontact: e.target.value })} /></Field>
            <Field label="Teléfono"><Inp value={form.cphone || ""} onChange={(e: any) => setForm({ ...form, cphone: e.target.value })} /></Field>
          </div>
        </Modal>
      )}
      {modal === "supplier" && (
        <Modal title="Nuevo proveedor" onClose={() => setModal(null)} footer={<><Btn onClick={() => setModal(null)}>Cancelar</Btn><Btn v="pri" disabled={!form.sname || busy} onClick={newSupplier}>Registrar proveedor</Btn></>}>
          <div className="space-y-3">
            <Field label="Nombre del proveedor"><Inp autoFocus value={form.sname || ""} onChange={(e: any) => setForm({ ...form, sname: e.target.value })} /></Field>
            <Field label="Persona de contacto"><Inp value={form.scontact || ""} onChange={(e: any) => setForm({ ...form, scontact: e.target.value })} /></Field>
            <Field label="Teléfono"><Inp value={form.sphone || ""} onChange={(e: any) => setForm({ ...form, sphone: e.target.value })} /></Field>
          </div>
        </Modal>
      )}
      {modal === "accept" && (
        <Modal title="Aceptar cotización" onClose={() => setModal(null)} footer={<><Btn onClick={() => setModal(null)}>Cancelar</Btn><Btn v="pri" icon={ThumbsUp} disabled={busy} onClick={accept}>{busy ? "Procesando…" : "Aceptar y crear proyecto"}</Btn></>}>
          <p className="mb-3">Se guardará la versión aceptada, se bloqueará la cotización y se creará el proyecto con un presupuesto de <b>{fmtBs(t.total)}</b> y una ganancia estimada de <b>{fmtBs(t.profit)}</b>. No se descuenta inventario.</p>
          <div className="space-y-3">
            <Field label="Plantilla de checklist"><Sel value={form.template || ""} onChange={(e: any) => setForm({ ...form, template: e.target.value })} options={[{ value: "", label: "Sin plantilla" }, ...db.checklistTemplates.filter((c: any) => c.active).map((c: any) => ({ value: c.id, label: c.name }))]} /></Field>
            <Field label="Fecha prevista de inicio (opcional)"><Inp type="date" value={form.start || ""} onChange={(e: any) => setForm({ ...form, start: e.target.value })} /></Field>
          </div>
        </Modal>
      )}
      {modal === "reject" && (
        <Modal title="Rechazar cotización" onClose={() => setModal(null)} footer={<><Btn onClick={() => setModal(null)}>Cancelar</Btn><Btn v="dng solid" disabled={busy} onClick={reject}>Marcar como rechazada</Btn></>}>
          <Field label="Motivo (opcional)"><textarea className="vx-in" rows={3} value={form.reason || ""} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></Field>
        </Modal>
      )}
    </div>
  );
}
