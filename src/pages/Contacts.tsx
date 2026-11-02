import { useState } from "react";
import { useParams } from "react-router-dom";
import { Plus, Pencil } from "lucide-react";
import { useApp, ins, upd } from "../data/store";
import { PageHead, Btn, Badge, Empty, Inp, Kpi, Row, FormModal } from "../components/ui";
import { fmtBs, r2, sum } from "../lib/format";
import { Q_STATUS, P_STATUS, quoteTotals, projectFin } from "../lib/calc";

function SimpleCrud({ title, sub, table, dbKey, label, fields, columns, onRow, defaults = {} }: any) {
  const { db, run, log } = useApp();
  const [edit, setEdit] = useState<any>(null);
  const [qs, setQs] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const list = db[dbKey].filter((x: any) => (showInactive || x.active !== false) && JSON.stringify(x).toLowerCase().includes(qs.toLowerCase()));
  const allFields = [...fields, { k: "active", label: "Estado", type: "checkbox", hint: "Activo (aparece en las listas para elegir)" }];
  return (
    <div>
      <PageHead title={title} sub={sub} actions={<Btn v="pri" icon={Plus} onClick={() => setEdit("new")}>Nuevo {label}</Btn>} />
      <div className="vx-card">
        <div className="p-4 pb-2 flex flex-wrap gap-3 items-center">
          <div style={{ maxWidth: 320, flex: "1 1 220px" }}><Inp placeholder="Buscar" value={qs} onChange={(e: any) => setQs(e.target.value)} /></div>
          <label className="flex items-center gap-2" style={{ fontSize: 13 }}><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />Mostrar inactivos</label>
        </div>
        <div className="vx-scroll">{list.length ? (
          <table className="vx-tbl">
            <thead><tr>{columns.map(([h, , r]: any) => <th key={h} className={r ? "r" : ""}>{h}</th>)}<th></th></tr></thead>
            <tbody>{list.map((x: any) => (
              <tr key={x.id} className={onRow ? "click" : ""} onClick={() => onRow && onRow(x)} style={x.active === false ? { opacity: 0.55 } : {}}>
                {columns.map(([h, f, r]: any) => <td key={h} className={r ? "r" : ""}>{f(x)}</td>)}
                <td className="r"><Btn sm v="gh" icon={Pencil} aria-label="Editar" onClick={(e: any) => { e.stopPropagation(); setEdit(x); }} /></td>
              </tr>
            ))}</tbody>
          </table>
        ) : <Empty text={`No hay registros. Agrega tu primer ${label}.`} />}</div>
      </div>
      {edit && <FormModal title={edit === "new" ? `Nuevo ${label}` : `Editar ${label}`} initial={edit === "new" ? { active: true, ...defaults } : edit} fields={allFields} onClose={() => setEdit(null)}
        onSubmit={async (v: any) => {
          const row: any = {};
          allFields.forEach((f: any) => (row[f.k] = f.type === "checkbox" ? !!v[f.k] : (v[f.k] ?? "")));
          const ok = await run(async () => {
            if (edit === "new") await ins(table, row); else await upd(table, edit.id, row);
            await log(`${label[0].toUpperCase() + label.slice(1)} ${v.name} ${edit === "new" ? "registrado" : "actualizado"}.`);
          }, "Datos guardados", [dbKey]);
          if (ok) setEdit(null);
        }} />}
    </div>
  );
}

const contactFields = [
  { k: "name", label: "Nombre o razón social", required: true, full: true }, { k: "contact", label: "Persona de contacto" }, { k: "phone", label: "Teléfono" },
  { k: "email", label: "Correo electrónico", type: "email" }, { k: "taxId", label: "NIT" }, { k: "address", label: "Dirección", full: true },
];

export function Clients() {
  const { db, go } = useApp();
  return <SimpleCrud title="Clientes" sub="Personas y empresas a las que cotizas" table="clients" dbKey="clients" label="cliente" onRow={(c: any) => go("cliente", c.id)}
    fields={[...contactFields, { k: "location", label: "Ubicación de la instalación", full: true }, { k: "notes", label: "Observaciones", type: "textarea" }]}
    columns={[
      ["Cliente", (c: any) => <div><div style={{ fontWeight: 600 }}>{c.name}</div><div className="vx-muted" style={{ fontSize: 12 }}>{c.contact}</div></div>],
      ["Teléfono", (c: any) => c.phone || "—"], ["NIT", (c: any) => c.taxId || "—"],
      ["Cotizaciones", (c: any) => db.quotations.filter((q: any) => q.clientId === c.id && !q.deletedAt).length, true],
      ["Proyectos", (c: any) => db.projects.filter((p: any) => p.clientId === c.id).length, true],
    ]} />;
}

export function ClientDetail() {
  const { id } = useParams();
  const { db, go } = useApp();
  const c = db.clients.find((x: any) => x.id === id);
  if (!c) return <Empty text="El cliente no existe." action={<Btn onClick={() => go("clientes")}>Volver</Btn>} />;
  const qs = db.quotations.filter((q: any) => q.clientId === c.id && !q.deletedAt);
  const ps = db.projects.filter((p: any) => p.clientId === c.id);
  return (
    <div>
      <PageHead back={{ label: "Clientes", onClick: () => go("clientes") }} title={c.name} sub={[c.contact, c.phone, c.email].filter(Boolean).join(" · ")} />
      <div className="grid gap-4 mb-5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
        <Kpi k="Total contratado" v={fmtBs(sum(ps, (p: any) => projectFin(db, p).agreed))} />
        <Kpi k="Cobrado" v={fmtBs(sum(ps, (p: any) => projectFin(db, p).collected))} tone="ok" />
        <Kpi k="Saldo pendiente" v={fmtBs(sum(ps, (p: any) => Math.max(0, projectFin(db, p).pendingCollect)))} />
      </div>
      <div className="vx-card p-4 mb-5"><Row k="Dirección" v={c.address || "—"} /><Row k="Ubicación de instalación" v={c.location || "—"} /><Row k="NIT" v={c.taxId || "—"} /><Row k="Observaciones" v={c.notes || "—"} /></div>
      <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,380px),1fr))" }}>
        <div className="vx-card vx-scroll"><h3 className="p-4 pb-2">Cotizaciones</h3>
          <table className="vx-tbl"><tbody>{qs.map((q: any) => <tr key={q.id} className="click" onClick={() => go("editor", q.id)}><td style={{ fontWeight: 600 }}>{q.number}</td><td>{q.projectName}</td><td><Badge map={Q_STATUS} s={q.status} /></td><td className="r nw">{fmtBs(quoteTotals(q).total)}</td></tr>)}</tbody></table>
          {!qs.length && <Empty text="Sin cotizaciones." />}</div>
        <div className="vx-card vx-scroll"><h3 className="p-4 pb-2">Proyectos</h3>
          <table className="vx-tbl"><tbody>{ps.map((p: any) => <tr key={p.id} className="click" onClick={() => go("proyecto", p.id)}><td style={{ fontWeight: 600 }}>{p.code}</td><td>{p.name}</td><td><Badge map={P_STATUS} s={p.status} /></td></tr>)}</tbody></table>
          {!ps.length && <Empty text="Sin proyectos." />}</div>
      </div>
    </div>
  );
}

export function Suppliers() {
  const { db } = useApp();
  return <SimpleCrud title="Proveedores" sub="Empresas a las que compras equipos y materiales" table="suppliers" dbKey="suppliers" label="proveedor"
    fields={[...contactFields, { k: "notes", label: "Observaciones", type: "textarea" }]}
    columns={[
      ["Proveedor", (s: any) => <div><div style={{ fontWeight: 600 }}>{s.name}</div><div className="vx-muted" style={{ fontSize: 12 }}>{s.contact}</div></div>],
      ["Teléfono", (s: any) => s.phone || "—"], ["Correo", (s: any) => s.email || "—"],
      ["Compras", (s: any) => db.purchases.filter((p: any) => p.supplierId === s.id).length, true],
      ["Total comprado", (s: any) => fmtBs(sum(db.purchases.filter((p: any) => p.supplierId === s.id && p.status !== "anulada"), "total")), true],
    ]} />;
}

export function Installers() {
  const { db } = useApp();
  const bal = (i: any) => {
    const pis = db.projectInstallers.filter((x: any) => x.installerId === i.id);
    const agreed = sum(pis, "agreed");
    const paid = sum(db.installerPayments.filter((x: any) => x.status !== "anulado" && pis.some((p: any) => p.id === x.projectInstallerId)), "amount");
    return { n: pis.length, agreed, paid, pending: r2(agreed - paid) };
  };
  return <SimpleCrud title="Instaladores" sub="Personas que trabajan en tus instalaciones. No tienen acceso a Vortex." table="installers" dbKey="installers" label="instalador"
    fields={[{ k: "name", label: "Nombre", required: true }, { k: "phone", label: "Teléfono" }, { k: "taxId", label: "CI o NIT" }, { k: "notes", label: "Observaciones", type: "textarea" }]}
    columns={[
      ["Instalador", (i: any) => <div style={{ fontWeight: 600 }}>{i.name}</div>], ["Teléfono", (i: any) => i.phone || "—"],
      ["Proyectos", (i: any) => bal(i).n, true], ["Acordado", (i: any) => fmtBs(bal(i).agreed), true], ["Pagado", (i: any) => fmtBs(bal(i).paid), true],
      ["Pendiente", (i: any) => <span style={{ fontWeight: 600, color: bal(i).pending > 0 ? "var(--amber)" : "var(--ok)" }}>{fmtBs(bal(i).pending)}</span>, true],
    ]} />;
}
