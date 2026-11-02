import { useRef, useState } from "react";
import { Plus, Camera, Pencil } from "lucide-react";
import { useApp, ins, upd } from "../data/store";
import { PageHead, Btn, Row, Img, FormModal } from "../components/ui";
import { uploadImage } from "../lib/files";

export default function Companies() {
  const { db, run, log, notify } = useApp();
  const [edit, setEdit] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<any>(null);
  const pick = (id: string, field: string) => { setTarget({ id, field }); fileRef.current?.click(); };
  const onFile = async (e: any) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !target) return;
    await run(async () => {
      notify("Subiendo imagen…");
      const path = await uploadImage(f, `companies/${target.id}`, { maxW: target.field === "headerPath" ? 2200 : 900, keepPng: true });
      await upd("companies", target.id, { [target.field]: path });
      await log(target.field === "logoPath" ? "Logo de empresa actualizado." : "Encabezado de cotización actualizado.");
    }, target.field === "logoPath" ? "Logo actualizado" : "Encabezado actualizado", ["companies"]);
  };
  const fields = [
    { k: "tradeName", label: "Nombre comercial", required: true }, { k: "legalName", label: "Razón social" }, { k: "taxId", label: "NIT" },
    { k: "prefix", label: "Prefijo de cotizaciones (ej. VTX)", required: true }, { k: "phone", label: "Teléfono" }, { k: "email", label: "Correo", type: "email" },
    { k: "web", label: "Sitio web" }, { k: "contact", label: "Contacto" }, { k: "color", label: "Color del documento", type: "color" },
    { k: "address", label: "Dirección", full: true }, { k: "terms", label: "Condiciones de pago por defecto", type: "textarea" },
    { k: "footer", label: "Pie de página del PDF", type: "textarea" }, { k: "active", label: "Estado", type: "checkbox", hint: "Disponible para nuevas cotizaciones" },
  ];
  return (
    <div>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={onFile} />
      <PageHead title="Empresas emisoras" sub="Marcas con las que presentas tus cotizaciones" actions={<Btn v="pri" icon={Plus} onClick={() => setEdit("new")}>Nueva empresa</Btn>} />
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,380px),1fr))" }}>
        {db.companies.map((c: any) => (
          <div key={c.id} className="vx-card" style={{ overflow: "hidden", opacity: c.active ? 1 : 0.6 }}>
            <div style={{ height: 4, background: c.color || "var(--grad)" }} />
            <div className="p-5">
              <div className="flex items-center gap-3 mb-3">
                {c.logoPath ? <Img path={c.logoPath} style={{ width: 150, height: 52, objectFit: "contain", objectPosition: "left center" }} />
                  : <div style={{ width: 56, height: 56, borderRadius: 10, background: c.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>{c.prefix}</div>}
                <div className="min-w-0"><h2>{c.tradeName}</h2><div className="vx-muted" style={{ fontSize: 12 }}>{c.legalName || "Sin razón social"}{c.taxId && ` · NIT ${c.taxId}`}</div></div>
              </div>
              <Row k="Prefijo de numeración" v={c.prefix} /><Row k="Teléfono" v={c.phone || "—"} /><Row k="Correo" v={c.email || "—"} />{c.web && <Row k="Sitio web" v={c.web} />}
              <Row k="Cotizaciones" v={db.quotations.filter((q: any) => q.companyId === c.id && !q.deletedAt).length} />
              <div className="mt-3"><span className="vx-lbl">Encabezado del PDF</span>
                {c.headerPath ? <Img path={c.headerPath} alt="Encabezado" style={{ width: "100%", borderRadius: 8, border: "1px solid var(--line)" }} />
                  : <div className="vx-muted" style={{ fontSize: 12, border: "1px dashed var(--line)", borderRadius: 8, padding: 12 }}>Sin encabezado: el PDF usará el logo y los datos de la empresa.</div>}
              </div>
              <div className="flex gap-2 mt-3 flex-wrap">
                <Btn sm icon={Camera} onClick={() => pick(c.id, "logoPath")}>{c.logoPath ? "Reemplazar logo" : "Subir logo"}</Btn>
                <Btn sm icon={Camera} onClick={() => pick(c.id, "headerPath")}>{c.headerPath ? "Reemplazar encabezado" : "Subir encabezado"}</Btn>
                {c.headerPath && <Btn sm v="gh" onClick={() => run(async () => { await upd("companies", c.id, { headerPath: null }); }, "Encabezado quitado", ["companies"])}>Quitar encabezado</Btn>}
                <Btn sm icon={Pencil} onClick={() => setEdit(c)}>Editar datos</Btn>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="vx-muted mt-4" style={{ fontSize: 12 }}>Las cotizaciones ya enviadas conservan el encabezado, el logo y los datos que tenía la empresa en ese momento. Para el encabezado usa una imagen horizontal (por ejemplo 2000 × 360 píxeles).</div>
      {edit && <FormModal title={edit === "new" ? "Nueva empresa emisora" : "Editar empresa"} wide initial={edit === "new" ? { color: "#7928CA", active: true } : edit} onClose={() => setEdit(null)} fields={fields}
        onSubmit={async (v: any) => {
          const prefix = String(v.prefix || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
          if (!prefix) return "El prefijo solo puede tener letras y números.";
          if (db.companies.some((c: any) => c.prefix === prefix && c.id !== v.id)) return "Ese prefijo ya lo usa otra empresa.";
          const row = { tradeName: v.tradeName, legalName: v.legalName || "", taxId: v.taxId || "", prefix, phone: v.phone || "", email: v.email || "", web: v.web || "", contact: v.contact || "", color: v.color || "#7928CA", address: v.address || "", terms: v.terms || "", footer: v.footer || "", active: !!v.active };
          const ok = await run(async () => {
            if (edit === "new") await ins("companies", row); else await upd("companies", edit.id, row);
            await log(`Empresa ${v.tradeName} guardada.`);
          }, "Empresa guardada", ["companies"]);
          if (ok) setEdit(null);
        }} />}
    </div>
  );
}
