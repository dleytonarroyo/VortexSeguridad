import { useRef, useState } from "react";
import { Plus, Camera } from "lucide-react";
import { useApp, ins, upd } from "../data/store";
import { PageHead, Btn, Empty, Field, Inp, Sel, Photo, Modal } from "../components/ui";
import { fmtBs, fmtPct, fmtDateTime, fmtQty, num, r2, newId } from "../lib/format";
import { suggested, markupOf, marginOf, productMarkup, productPrice, stockOf } from "../lib/calc";
import { uploadImage } from "../lib/files";

function ProductModal({ product, onClose }: any) {
  const { db, run, log, notify, busy } = useApp();
  const s = db.settings;
  const [v, setV] = useState<any>(product ? { ...product } : {
    id: newId(), sku: "", name: "", category: s.productCategories[0] || "", brand: "", model: "", unit: "unidad", itemType: "equipo",
    refCost: 0, avgCost: 0, markup: null, pricingMode: "incremento", manualPrice: 0, minStock: 0, supplierId: "", description: "",
    imagePath: null, active: true, trackInventory: true, notes: "",
  });
  const [err, setErr] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const mk = productMarkup(v, s);
  const sug = suggested(num(v.refCost), num(mk));
  const final = v.pricingMode === "manual" ? num(v.manualPrice) : sug;
  const set = (patch: any) => setV({ ...v, ...patch });
  const onFile = async (e: any) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setUploading(true);
    try { set({ imagePath: await uploadImage(f, `products/${v.id}`) }); }
    catch (er: any) { notify(er?.message || "No se pudo subir la foto.", "error"); }
    finally { setUploading(false); }
  };
  const save = async () => {
    if (!String(v.name).trim() || !String(v.sku).trim()) { setErr("Escribe el nombre y el SKU o código."); return; }
    if (db.products.some((p: any) => p.sku.trim().toLowerCase() === v.sku.trim().toLowerCase() && p.id !== v.id)) { setErr("Ya existe un producto con ese SKU."); return; }
    if (v.pricingMode === "manual" && num(v.manualPrice) <= 0) { setErr("Escribe el precio manual."); return; }
    setErr("");
    const row = {
      sku: v.sku.trim(), name: v.name.trim(), category: v.category || "", brand: v.brand || "", model: v.model || "", unit: v.unit, itemType: v.itemType,
      refCost: r2(num(v.refCost)), markup: v.markup === "" || v.markup === null || v.markup === undefined ? null : num(v.markup), pricingMode: v.pricingMode,
      manualPrice: r2(num(v.manualPrice)), minStock: num(v.minStock), supplierId: v.supplierId || null, description: v.description || "",
      imagePath: v.imagePath || null, active: !!v.active, trackInventory: !!v.trackInventory, notes: v.notes || "",
    };
    const ok = await run(async () => {
      if (product) await upd("products", v.id, row);
      else await ins("products", { ...row, id: v.id, avgCost: r2(num(v.refCost)) });
      await log(`Producto ${row.name} ${product ? "actualizado" : "creado"}.`);
    }, product ? "Producto actualizado" : "Producto creado", ["products", "priceHistory"]);
    if (ok) onClose();
  };
  const hist = db.priceHistory.filter((h: any) => h.productId === v.id).slice(0, 10);
  return (
    <Modal title={product ? "Editar producto" : "Nuevo producto"} wide onClose={onClose}
      footer={<><Btn onClick={onClose}>Cancelar</Btn><Btn v="pri" disabled={busy || uploading} onClick={save}>{product ? "Guardar cambios" : "Crear producto"}</Btn></>}>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={onFile} />
      <div className="flex gap-4 flex-wrap">
        <div><Photo path={v.imagePath} size={110} />
          <div className="flex flex-col gap-1 mt-2">
            <Btn sm icon={Camera} disabled={uploading} onClick={() => fileRef.current?.click()}>{uploading ? "Subiendo…" : v.imagePath ? "Reemplazar foto" : "Subir foto"}</Btn>
            {v.imagePath && <Btn sm v="gh" onClick={() => set({ imagePath: null })}>Quitar foto</Btn>}
          </div></div>
        <div className="flex-1 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", minWidth: 240 }}>
          <Field label="Nombre *"><Inp value={v.name} onChange={(e: any) => set({ name: e.target.value })} /></Field>
          <Field label="SKU o código *"><Inp value={v.sku} onChange={(e: any) => set({ sku: e.target.value })} /></Field>
          <Field label="Categoría"><Sel value={v.category} onChange={(e: any) => set({ category: e.target.value })} options={[...new Set([...(s.productCategories || []), v.category].filter(Boolean))] as string[]} /></Field>
          <Field label="Marca"><Inp value={v.brand} onChange={(e: any) => set({ brand: e.target.value })} /></Field>
          <Field label="Modelo"><Inp value={v.model} onChange={(e: any) => set({ model: e.target.value })} /></Field>
          <Field label="Unidad de medida"><Sel value={v.unit} onChange={(e: any) => set({ unit: e.target.value })} options={["unidad", "metro", "rollo", "caja", "par", "juego", "paquete"]} /></Field>
          <Field label="Tipo"><Sel value={v.itemType} onChange={(e: any) => set({ itemType: e.target.value })} options={[{ value: "equipo", label: "Equipo" }, { value: "material", label: "Material" }, { value: "consumible", label: "Consumible" }]} /></Field>
          <Field label="Proveedor"><Sel value={v.supplierId || ""} onChange={(e: any) => set({ supplierId: e.target.value })} options={[{ value: "", label: "Ninguno" }, ...db.suppliers.map((x: any) => ({ value: x.id, label: x.name }))]} /></Field>
          <Field label="Stock mínimo"><Inp type="number" value={v.minStock} onChange={(e: any) => set({ minStock: e.target.value })} /></Field>
        </div>
      </div>
      <Field label="Descripción (aparece en la cotización)" className="mt-3"><textarea className="vx-in" rows={2} value={v.description} onChange={(e) => set({ description: e.target.value })} /></Field>
      <div className="vx-card p-4 mt-4" style={{ background: "#FAF8FE" }}>
        <h3 className="mb-3">Precio</h3>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))" }}>
          <Field label="Costo de referencia (Bs)"><Inp type="number" value={v.refCost} onChange={(e: any) => set({ refCost: e.target.value })} /></Field>
          <Field label={`Incremento (vacío = general ${s.defaultMarkup} %)`}><Inp type="number" value={v.markup ?? ""} onChange={(e: any) => set({ markup: e.target.value === "" ? null : e.target.value })} /></Field>
          <Field label="Modo de precio"><Sel value={v.pricingMode} onChange={(e: any) => set({ pricingMode: e.target.value })} options={[{ value: "incremento", label: "Según incremento" }, { value: "manual", label: "Precio manual" }]} /></Field>
          {v.pricingMode === "manual" && <Field label="Precio manual (Bs)"><Inp type="number" value={v.manualPrice} onChange={(e: any) => set({ manualPrice: e.target.value })} /></Field>}
        </div>
        <div className="grid gap-3 mt-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))" }}>
          <div><div className="vx-lbl">Precio sugerido</div><b>{fmtBs(sug)}</b></div>
          <div><div className="vx-lbl">Precio de venta</div><b style={{ fontSize: 17 }}>{fmtBs(final)}</b></div>
          <div><div className="vx-lbl">Incremento sobre costo</div><b>{fmtPct(markupOf(final, num(v.refCost)))}</b></div>
          <div><div className="vx-lbl">Margen sobre venta</div><b>{fmtPct(marginOf(final, num(v.refCost)))}</b></div>
          {product && <div><div className="vx-lbl">Costo promedio del stock</div><b>{fmtBs(v.avgCost)}</b></div>}
        </div>
        <div className="vx-muted mt-2" style={{ fontSize: 12 }}>Cambiar estos valores no modifica cotizaciones ni proyectos ya creados.</div>
      </div>
      <div className="flex gap-5 mt-3 flex-wrap" style={{ fontSize: 13 }}>
        <label className="flex items-center gap-2"><input type="checkbox" checked={!!v.active} onChange={(e) => set({ active: e.target.checked })} />Producto activo</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={!!v.trackInventory} onChange={(e) => set({ trackInventory: e.target.checked })} />Controlar inventario</label>
      </div>
      {hist.length > 0 && <div className="mt-4"><h3 className="mb-1">Historial de precios</h3>{hist.map((h: any) => <div key={h.id} className="vx-muted" style={{ fontSize: 12 }}>{fmtDateTime(h.at)} · {h.field}: {h.fromValue} → {h.toValue}</div>)}</div>}
      {err && <div className="mt-3" style={{ color: "var(--rec)" }}>{err}</div>}
    </Modal>
  );
}

export default function Catalog() {
  const { db } = useApp();
  const [qs, setQs] = useState("");
  const [cat, setCat] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const list = db.products.filter((p: any) => (showInactive || p.active) && (!cat || p.category === cat) && `${p.name} ${p.sku} ${p.brand}`.toLowerCase().includes(qs.toLowerCase()));
  return (
    <div>
      <PageHead title="Catálogo de productos" sub="Equipos, materiales y consumibles con su costo y precio" actions={<Btn v="pri" icon={Plus} onClick={() => setEdit("new")}>Nuevo producto</Btn>} />
      <div className="vx-card p-4 mb-4 flex flex-wrap items-end gap-3">
        <Field label="Buscar"><Inp placeholder="Nombre, SKU o marca" value={qs} onChange={(e: any) => setQs(e.target.value)} /></Field>
        <Field label="Categoría"><Sel value={cat} onChange={(e: any) => setCat(e.target.value)} options={[{ value: "", label: "Todas" }, ...db.settings.productCategories]} /></Field>
        <label className="flex items-center gap-2 pb-2" style={{ fontSize: 13 }}><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />Mostrar inactivos</label>
      </div>
      {list.length > 0 && <div className="vx-only-mob space-y-2">{list.map((p: any) => (
        <button key={p.id} className="vx-lcard w-full text-left flex gap-3 items-center" style={{ fontFamily: "inherit", cursor: "pointer" }} onClick={() => setEdit(p)}>
          <Photo path={p.imagePath} size={52} />
          <div className="flex-1 min-w-0"><div style={{ fontWeight: 600 }}>{p.name}</div><div className="vx-muted" style={{ fontSize: 12 }}>{p.sku} · Stock {p.trackInventory ? fmtQty(stockOf(db, p.id)) : "—"}</div></div>
          <b>{fmtBs(productPrice(p, db.settings))}</b>
        </button>
      ))}</div>}
      <div className={`vx-card vx-scroll ${list.length ? "vx-only-desk" : ""}`}>{list.length ? <table className="vx-tbl"><thead><tr><th>Producto</th><th>Categoría</th><th className="r">Costo</th><th className="r">Incremento</th><th className="r">Precio de venta</th><th className="r">Margen</th><th className="r">Stock</th><th>Estado</th></tr></thead>
        <tbody>{list.map((p: any) => {
          const price = productPrice(p, db.settings);
          const st = stockOf(db, p.id);
          return (
            <tr key={p.id} className="click" onClick={() => setEdit(p)}>
              <td><div className="flex items-center gap-2"><Photo path={p.imagePath} size={38} /><div><div style={{ fontWeight: 600 }}>{p.name}</div><div className="vx-muted" style={{ fontSize: 12 }}>{p.sku} · {p.brand} {p.model}</div></div></div></td>
              <td>{p.category}</td><td className="r nw">{fmtBs(p.refCost)}</td>
              <td className="r">{p.pricingMode === "manual" ? <span className="vx-badge b-amber">Manual</span> : `${productMarkup(p, db.settings)} %`}</td>
              <td className="r nw" style={{ fontWeight: 600 }}>{fmtBs(price)}</td><td className="r">{fmtPct(marginOf(price, num(p.refCost)))}</td>
              <td className="r" style={{ color: p.trackInventory && st <= num(p.minStock) ? "var(--rec)" : undefined }}>{p.trackInventory ? `${fmtQty(st)} ${p.unit}` : "—"}</td>
              <td>{p.active ? <span className="vx-badge b-green">Activo</span> : <span className="vx-badge b-gray">Inactivo</span>}</td>
            </tr>
          );
        })}</tbody></table> : <Empty text={db.products.length ? "No hay productos con este filtro." : "Tu catálogo está vacío. Agrega tu primer producto."} action={<Btn v="pri" icon={Plus} onClick={() => setEdit("new")}>Nuevo producto</Btn>} />}</div>
      {edit && <ProductModal product={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}
