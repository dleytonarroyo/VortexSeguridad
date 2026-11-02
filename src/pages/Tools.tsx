import { useEffect, useState } from "react";
import { Plus, Pencil, ListChecks, Trash2, Save } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useApp, ins, upd, insMany } from "../data/store";
import { PageHead, Btn, Badge, Empty, Field, Inp, Sel, FormModal } from "../components/ui";
import { fmtDate, addDays, newId, todayLaPaz } from "../lib/format";
import { T_STATUS, ACTIVE_P } from "../lib/calc";

export function Tools() {
  const { db, run, log } = useApp();
  const [modal, setModal] = useState<any>(null);
  const today = todayLaPaz();
  const openA = (t: any) => db.toolAssignments.find((a: any) => a.toolId === t.id && !a.returnedAt);
  const toolFields = [
    { k: "name", label: "Nombre", required: true }, { k: "code", label: "Código", required: true }, { k: "brand", label: "Marca" }, { k: "model", label: "Modelo" },
    { k: "serial", label: "Número de serie" }, { k: "location", label: "Ubicación" }, { k: "acquired", label: "Fecha de adquisición", type: "date" },
    { k: "status", label: "Estado", type: "select", options: Object.entries(T_STATUS).filter(([k]) => k !== "prestada").map(([value, [label]]) => ({ value, label })) },
    { k: "notes", label: "Observaciones", type: "textarea" },
  ];
  const nextCode = `HER-${String(db.tools.length + 1).padStart(3, "0")}`;
  return (
    <div>
      <PageHead title="Herramientas" sub="Herramientas reutilizables. No se descuentan como material." actions={<Btn v="pri" icon={Plus} onClick={() => setModal({ kind: "edit", tool: null })}>Nueva herramienta</Btn>} />
      <div className="vx-card vx-scroll">{db.tools.length ? <table className="vx-tbl"><thead><tr><th>Código</th><th>Herramienta</th><th>Serie</th><th>Estado</th><th>Ubicación</th><th>Entregada a</th><th></th></tr></thead>
        <tbody>{db.tools.map((t: any) => {
          const a = openA(t);
          const late = a && a.expectedReturn && a.expectedReturn < today;
          return (
            <tr key={t.id}>
              <td style={{ fontWeight: 600 }}>{t.code}</td><td><div style={{ fontWeight: 500 }}>{t.name}</div><div className="vx-muted" style={{ fontSize: 12 }}>{t.brand} {t.model}</div></td>
              <td>{t.serial || "—"}</td><td><Badge map={T_STATUS} s={t.status} /></td><td>{t.location || "—"}</td>
              <td>{a ? <div><div>{db.installers.find((i: any) => i.id === a.installerId)?.name || "—"}{a.projectId && ` · ${db.projects.find((p: any) => p.id === a.projectId)?.code || ""}`}</div>
                <div style={{ fontSize: 12, color: late ? "var(--rec)" : "var(--muted)" }}>{late ? "Devolución atrasada: " : "Devolver el "}{fmtDate(a.expectedReturn)}</div></div> : "—"}</td>
              <td className="r"><div className="flex gap-1 justify-end">
                {t.status === "disponible" && <Btn sm onClick={() => setModal({ kind: "lend", tool: t })}>Entregar</Btn>}
                {a && <Btn sm v="pri" onClick={() => setModal({ kind: "return", tool: t, a })}>Recibir</Btn>}
                <Btn sm v="gh" icon={Pencil} aria-label="Editar" onClick={() => setModal({ kind: "edit", tool: t })} />
              </div></td>
            </tr>
          );
        })}</tbody></table> : <Empty text="Todavía no registraste herramientas." action={<Btn v="pri" icon={Plus} onClick={() => setModal({ kind: "edit", tool: null })}>Nueva herramienta</Btn>} />}</div>

      {modal?.kind === "edit" && <FormModal title={modal.tool ? "Editar herramienta" : "Nueva herramienta"} onClose={() => setModal(null)}
        initial={modal.tool || { status: "disponible", location: "Almacén", code: nextCode }}
        fields={modal.tool?.status === "prestada" ? toolFields.filter((f) => f.k !== "status") : toolFields}
        onSubmit={async (v: any) => {
          const row = { name: v.name, code: v.code, brand: v.brand || "", model: v.model || "", serial: v.serial || "", location: v.location || "", acquired: v.acquired || null, status: v.status || "disponible", notes: v.notes || "" };
          const ok = await run(async () => {
            if (modal.tool) await upd("tools", modal.tool.id, row); else await ins("tools", row);
            await log(`Herramienta ${v.name} ${modal.tool ? "actualizada" : "registrada"}.`);
          }, "Herramienta guardada", ["tools"]);
          if (ok) setModal(null);
        }} />}
      {modal?.kind === "lend" && <FormModal title={`Entregar ${modal.tool.name}`} submitLabel="Registrar entrega" onClose={() => setModal(null)}
        initial={{ installerId: db.installers.find((i: any) => i.active)?.id || "", projectId: "", assignedAt: today, expectedReturn: addDays(today, 3) }}
        onSubmit={async (v: any) => {
          const ok = await run(async () => {
            await ins("tool_assignments", { toolId: modal.tool.id, projectId: v.projectId || null, installerId: v.installerId || null, assignedAt: v.assignedAt, expectedReturn: v.expectedReturn, notes: v.notes || "" });
            await upd("tools", modal.tool.id, { status: "prestada", location: "En obra" });
            await log(`Herramienta ${modal.tool.name} entregada.`);
          }, "Entrega registrada", ["tools", "toolAssignments"]);
          if (ok) setModal(null);
        }}
        fields={[{ k: "installerId", label: "Responsable", type: "select", options: [{ value: "", label: "Yo mismo" }, ...db.installers.filter((i: any) => i.active).map((i: any) => ({ value: i.id, label: i.name }))] },
          { k: "projectId", label: "Proyecto (opcional)", type: "select", options: [{ value: "", label: "Ninguno" }, ...db.projects.filter((p: any) => ACTIVE_P.includes(p.status)).map((p: any) => ({ value: p.id, label: `${p.code} · ${p.name}` }))] },
          { k: "assignedAt", label: "Fecha de entrega", type: "date", required: true }, { k: "expectedReturn", label: "Devolución prevista", type: "date", required: true }, { k: "notes", label: "Observaciones", type: "textarea" }]} />}
      {modal?.kind === "return" && <FormModal title={`Recibir ${modal.tool.name}`} submitLabel="Registrar recepción" onClose={() => setModal(null)} initial={{ status: "disponible", returnedAt: today }}
        onSubmit={async (v: any) => {
          const ok = await run(async () => {
            await upd("tool_assignments", modal.a.id, { returnedAt: v.returnedAt, notes: v.notes || modal.a.notes || "" });
            await upd("tools", modal.tool.id, { status: v.status, location: v.status === "disponible" ? "Almacén" : modal.tool.location });
            await log(`Herramienta ${modal.tool.name} recibida (${T_STATUS[v.status][0]}).`);
          }, "Recepción registrada", ["tools", "toolAssignments"]);
          if (ok) setModal(null);
        }}
        fields={[{ k: "returnedAt", label: "Fecha de recepción", type: "date", required: true }, { k: "status", label: "Estado en que vuelve", type: "select", options: ["disponible", "en_mantenimiento", "extraviada"].map((k) => ({ value: k, label: T_STATUS[k][0] })) }, { k: "notes", label: "Observaciones", type: "textarea" }]} />}
    </div>
  );
}

export function Checklists() {
  const { db, run, log, busy } = useApp();
  const [sel, setSel] = useState<string | null>(db.checklistTemplates[0]?.id || null);
  const tpl = db.checklistTemplates.find((t: any) => t.id === sel);
  const [draft, setDraft] = useState<any>(null);
  const [newItem, setNewItem] = useState({ label: "", kind: "material" });
  useEffect(() => { setDraft(tpl ? JSON.parse(JSON.stringify(tpl)) : null); }, [sel, JSON.stringify(tpl || null)]);
  const dirty = draft && tpl && JSON.stringify(draft) !== JSON.stringify(tpl);

  const create = async () => {
    let nid = "";
    await run(async () => { const t = await ins("checklist_templates", { name: "Nueva plantilla", description: "" }); nid = t.id; await log("Plantilla de checklist creada."); }, "Plantilla creada", ["templatesRaw"]);
    if (nid) setSel(nid);
  };
  const save = () => run(async () => {
    await upd("checklist_templates", draft.id, { name: draft.name, description: draft.description, active: draft.active });
    const { error } = await supabase.from("checklist_template_items").delete().eq("template_id", draft.id);
    if (error) throw error;
    await insMany("checklist_template_items", draft.items.map((i: any, idx: number) => ({ templateId: draft.id, position: idx + 1, kind: i.kind, label: i.label })));
    await log(`Plantilla ${draft.name} actualizada.`);
  }, "Plantilla guardada", ["templatesRaw", "templateItems"]);
  const addItem = () => {
    if (!newItem.label.trim()) return;
    setDraft({ ...draft, items: [...draft.items, { id: newId(), kind: newItem.kind, label: newItem.label.trim() }] });
    setNewItem({ ...newItem, label: "" });
  };

  return (
    <div>
      <PageHead title="Checklist maestra" sub="Plantillas reutilizables. Los cambios no afectan las listas ya copiadas a proyectos." actions={<Btn v="pri" icon={Plus} onClick={create}>Nueva plantilla</Btn>} />
      <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,260px),1fr))", alignItems: "start" }}>
        <div className="vx-card p-2">
          {db.checklistTemplates.map((t: any) => (
            <button key={t.id} className={`vx-nav ${t.id === sel ? "on" : ""}`} style={t.id === sel ? {} : { color: "var(--ink)" }} onClick={() => setSel(t.id)}>
              <ListChecks size={15} />{t.name}<span style={{ marginLeft: "auto", fontSize: 12, opacity: 0.8 }}>{t.items.length}</span>
            </button>
          ))}
          {!db.checklistTemplates.length && <Empty text="Sin plantillas." />}
        </div>
        {draft && <div className="vx-card p-4" style={{ gridColumn: "span 2 / span 2" }}>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3"><h3>Editar plantilla</h3><Btn v="pri" sm icon={Save} disabled={!dirty || busy} onClick={save}>Guardar plantilla</Btn></div>
          <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
            <Field label="Nombre"><Inp value={draft.name} onChange={(e: any) => setDraft({ ...draft, name: e.target.value })} /></Field>
            <Field label="Descripción"><Inp value={draft.description} onChange={(e: any) => setDraft({ ...draft, description: e.target.value })} /></Field>
          </div>
          <label className="flex items-center gap-2 mb-4" style={{ fontSize: 13 }}><input type="checkbox" checked={!!draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />Plantilla activa (disponible al aceptar cotizaciones)</label>
          {[["material", "Materiales que debo llevar"], ["herramienta", "Herramientas que debo comprobar"]].map(([k, l]) => (
            <div key={k} className="mb-4"><h3 className="mb-1">{l}</h3>
              {draft.items.filter((i: any) => i.kind === k).map((i: any) => (
                <div key={i.id} className="flex items-center gap-2 py-1" style={{ borderBottom: "1px solid #EEEFF5" }}>
                  <input className="vx-in" value={i.label} onChange={(e) => setDraft({ ...draft, items: draft.items.map((x: any) => (x.id === i.id ? { ...x, label: e.target.value } : x)) })} />
                  <button className="vx-btn gh sm" aria-label="Quitar" onClick={() => setDraft({ ...draft, items: draft.items.filter((x: any) => x.id !== i.id) })}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          ))}
          <div className="flex flex-wrap gap-2 items-end">
            <Field label="Nuevo elemento" className="flex-1"><Inp value={newItem.label} onChange={(e: any) => setNewItem({ ...newItem, label: e.target.value })} onKeyDown={(e: any) => e.key === "Enter" && addItem()} /></Field>
            <Field label="Tipo"><Sel value={newItem.kind} onChange={(e: any) => setNewItem({ ...newItem, kind: e.target.value })} options={[{ value: "material", label: "Material" }, { value: "herramienta", label: "Herramienta" }]} /></Field>
            <Btn icon={Plus} disabled={!newItem.label.trim()} onClick={addItem}>Agregar</Btn>
          </div>
          {dirty && <div className="mt-3" style={{ color: "var(--amber)", fontSize: 13 }}>Tienes cambios sin guardar.</div>}
        </div>}
      </div>
    </div>
  );
}
