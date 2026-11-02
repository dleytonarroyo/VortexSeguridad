import { useState } from "react";
import { Plus, Search, Trash2, RotateCcw } from "lucide-react";
import { useApp, ins, rpc, del, upd } from "../data/store";
import { PageHead, Btn, Badge, Empty, Modal, Field, Inp } from "../components/ui";
import { fmtBs, fmtDate, addDays, todayLaPaz } from "../lib/format";
import { Q_STATUS, quoteTotals, isExpired } from "../lib/calc";
import { removeFiles } from "../lib/files";

export function Quotations() {
  const { db, go, run, log, notify } = useApp();
  const [f, setF] = useState("todas");
  const [qs, setQs] = useState("");
  const list = db.quotations
    .filter((q: any) => !q.deletedAt && (f === "todas" || q.status === f))
    .filter((q: any) => {
      const c = db.clients.find((x: any) => x.id === q.clientId);
      return !qs || `${q.number} ${q.projectName} ${c?.name || ""}`.toLowerCase().includes(qs.toLowerCase());
    })
    .sort((a: any, b: any) => (b.date + b.number).localeCompare(a.date + a.number));
  const trashCount = db.quotations.filter((q: any) => q.deletedAt).length;

  const create = async () => {
    const c = db.companies.find((x: any) => x.active);
    if (!c) { notify("Primero registra una empresa emisora activa.", "error"); go("empresas"); return; }
    let id = "";
    const ok = await run(async () => {
      const today = todayLaPaz();
      const number = await rpc("next_document_number", { p_prefix: c.prefix });
      const q = await ins("quotations", {
        number, companyId: c.id, clientId: null, date: today, validUntil: addDays(today, db.settings.validityDays),
        terms: c.terms || db.settings.paymentTerms, status: "borrador",
      });
      id = q.id;
      await log(`Cotización ${number} creada como borrador.`);
    }, undefined, ["quotationsRaw"]);
    if (ok && id) go("editor", id);
  };

  return (
    <div>
      <PageHead title="Cotizaciones" sub="Propuestas comerciales para tus clientes"
        actions={<><Btn icon={Trash2} onClick={() => go("papelera")}>Papelera ({trashCount})</Btn><Btn v="pri" icon={Plus} onClick={create}>Nueva cotización</Btn></>} />
      <div className="vx-card">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-3">
          <div className="flex gap-1 vx-scroll">
            {[["todas", "Todas"], ["borrador", "Borradores"], ["enviada", "Pendientes"], ["aceptada", "Aceptadas"], ["rechazada", "Rechazadas"]].map(([k, l]) =>
              <button key={k} className={`vx-tab ${f === k ? "on" : ""}`} onClick={() => setF(k)}>{l}</button>)}
          </div>
          <div style={{ position: "relative", width: 280, maxWidth: "100%" }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: 12, color: "var(--muted)" }} />
            <input className="vx-in" style={{ paddingLeft: 30 }} placeholder="Buscar número, cliente o proyecto" value={qs} onChange={(e) => setQs(e.target.value)} />
          </div>
        </div>
        {list.length > 0 && <div className="vx-only-mob p-3 space-y-2">{list.map((q: any) => {
          const c = db.clients.find((x: any) => x.id === q.clientId);
          return (
            <button key={q.id} className="vx-lcard w-full text-left" style={{ fontFamily: "inherit", cursor: "pointer", display: "block" }} onClick={() => go("editor", q.id)}>
              <div className="flex justify-between gap-2"><b>{q.number}</b><Badge map={Q_STATUS} s={q.status} /></div>
              <div className="mt-1" style={{ fontWeight: 500 }}>{c?.name || "Sin cliente"}</div>
              <div className="vx-muted" style={{ fontSize: 12 }}>{q.projectName || "Sin nombre de proyecto"}</div>
              <div className="flex justify-between items-end mt-2"><span className="vx-muted" style={{ fontSize: 12 }}>{fmtDate(q.date)}{isExpired(q) ? " · Vencida" : ""}</span><span style={{ fontWeight: 800, fontSize: 16 }}>{fmtBs(quoteTotals(q).total)}</span></div>
            </button>
          );
        })}</div>}
        <div className={`vx-scroll mt-2 ${list.length ? "vx-only-desk" : ""}`}>
          {list.length ? (
            <table className="vx-tbl">
              <thead><tr><th>Número</th><th>Cliente y proyecto</th><th>Empresa</th><th>Fecha</th><th>Validez</th><th className="r">Total</th><th>Estado</th></tr></thead>
              <tbody>{list.map((q: any) => {
                const c = db.clients.find((x: any) => x.id === q.clientId);
                const co = db.companies.find((x: any) => x.id === q.companyId);
                return (
                  <tr key={q.id} className="click" onClick={() => go("editor", q.id)}>
                    <td style={{ fontWeight: 600 }}>{q.number}</td>
                    <td><div style={{ fontWeight: 500 }}>{c?.name || "Sin cliente"}</div><div className="vx-muted" style={{ fontSize: 12 }}>{q.projectName || "Sin nombre de proyecto"}</div></td>
                    <td>{co?.tradeName}</td><td>{fmtDate(q.date)}</td>
                    <td>{fmtDate(q.validUntil)} {isExpired(q) && <span className="vx-badge b-red">Vencida</span>}</td>
                    <td className="r nw" style={{ fontWeight: 600 }}>{fmtBs(quoteTotals(q).total)}</td>
                    <td><Badge map={Q_STATUS} s={q.status} /></td>
                  </tr>
                );
              })}</tbody>
            </table>
          ) : <Empty text={db.quotations.length ? "No hay cotizaciones con este filtro." : "Todavía no tienes cotizaciones."} action={<Btn v="pri" icon={Plus} onClick={create}>Nueva cotización</Btn>} />}
        </div>
      </div>
    </div>
  );
}

export function Trash() {
  const { db, go, run, log } = useApp();
  const [target, setTarget] = useState<any>(null);
  const [confirm, setConfirm] = useState("");
  const list = db.quotations.filter((q: any) => q.deletedAt);

  const restore = (q: any) => run(async () => { await upd("quotations", q.id, { deletedAt: null }); await log(`Cotización ${q.number} recuperada de la papelera.`); }, "Cotización recuperada", ["quotationsRaw"]);

  const purge = async () => {
    const q = target;
    const own = [...q.items.map((i: any) => i.imagePath)].filter((p: string) => p && p.startsWith(`quotations/${q.id}/`));
    const others = JSON.stringify([
      db.quotations.filter((x: any) => x.id !== q.id).map((x: any) => [x.items, x.versions]),
      db.projects.map((p: any) => p.items),
    ]);
    const unused = own.filter((p: string) => !others.includes(p));
    const ok = await run(async () => {
      await del("quotations", q.id);
      await log(`Cotización ${q.number} eliminada definitivamente.`);
      try { await removeFiles(unused); } catch { /* las imágenes huérfanas no impiden el borrado */ }
    }, "Cotización eliminada definitivamente", ["quotationsRaw", "quotationItems", "versions"]);
    if (ok) { setTarget(null); setConfirm(""); }
  };

  return (
    <div>
      <PageHead back={{ label: "Cotizaciones", onClick: () => go("cotizaciones") }} title="Papelera de cotizaciones" sub="Recupera una cotización o elimínala para siempre." />
      <div className="vx-card vx-scroll">
        {list.length ? (
          <table className="vx-tbl">
            <thead><tr><th>Número</th><th>Cliente y proyecto</th><th>Estado</th><th>En la papelera desde</th><th className="r">Total</th><th></th></tr></thead>
            <tbody>{list.map((q: any) => (
              <tr key={q.id}>
                <td style={{ fontWeight: 600 }}>{q.number}</td>
                <td>{db.clients.find((c: any) => c.id === q.clientId)?.name || "Sin cliente"}<div className="vx-muted" style={{ fontSize: 12 }}>{q.projectName}</div></td>
                <td><Badge map={Q_STATUS} s={q.status} /></td><td>{fmtDate(q.deletedAt)}</td><td className="r nw">{fmtBs(quoteTotals(q).total)}</td>
                <td className="r"><div className="flex gap-2 justify-end flex-wrap">
                  <Btn sm icon={RotateCcw} onClick={() => restore(q)}>Recuperar</Btn>
                  <Btn sm v="dng" icon={Trash2} onClick={() => { setTarget(q); setConfirm(""); }}>Eliminar definitivamente</Btn>
                </div></td>
              </tr>
            ))}</tbody>
          </table>
        ) : <Empty text="La papelera está vacía." />}
      </div>
      {target && (
        <Modal title="Eliminar definitivamente" onClose={() => setTarget(null)}
          footer={<><Btn onClick={() => setTarget(null)}>Cancelar</Btn><Btn v="dng solid" disabled={confirm.trim() !== target.number} onClick={purge}>Eliminar para siempre</Btn></>}>
          <p className="mb-3">Se borrarán la cotización <b>{target.number}</b>, sus líneas, sus versiones y sus imágenes propias. Esta acción no se puede deshacer.</p>
          <Field label={`Escribe ${target.number} para confirmar`}><Inp value={confirm} onChange={(e: any) => setConfirm(e.target.value)} /></Field>
        </Modal>
      )}
    </div>
  );
}
