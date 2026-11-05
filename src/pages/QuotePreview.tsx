import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Download, Printer, Camera, Share2 } from "lucide-react";
import { useApp } from "../data/store";
import { PageHead, Btn, Empty, Img } from "../components/ui";
import { fmtBs, fmtDate, fmtQty } from "../lib/format";
import { quoteTotals, lineCalc, orderedItems, paperOf } from "../lib/calc";
import { useFileUrl } from "../lib/files";
import SignatureBlock from "../components/Signature";

const LineImage = ({ path }: { path?: string | null }) => {
  const url = useFileUrl(path);
  return <div className="img">{url ? <img src={url} alt="" /> : <Camera size={22} />}</div>;
};

export default function QuotePreview() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const { db, go, notify } = useApp();
  const [making, setMaking] = useState(false);
  const q0 = db.quotations.find((q: any) => q.id === id);
  if (!q0) return <Empty text="La cotización no existe." action={<Btn onClick={() => go("cotizaciones")}>Volver</Btn>} />;
  const vn = Number(sp.get("v") || 0);
  const ver = vn ? q0.versions.find((v: any) => v.n === vn) : null;
  const q = ver ? ver.data : q0;
  const co = ver ? ver.company || db.companies.find((c: any) => c.id === q.companyId) : db.companies.find((c: any) => c.id === q.companyId);
  const cl = ver ? ver.client || db.clients.find((c: any) => c.id === q.clientId) : db.clients.find((c: any) => c.id === q.clientId);
  const t = quoteTotals(q);
  const vis = orderedItems(q.items || []).filter((l: any) => l.show && l.kind !== "costo");
  const paper = paperOf(q);
  const color = co?.color || "#7928CA";
  const showSig = q.showSignature !== false && !!co && !!(co.signaturePath || co.signerName);

  const canShare = typeof navigator !== "undefined" && !!(navigator as any).share && !!(navigator as any).canShare;
  const makePdf = async (mode: "download" | "share") => {
    setMaking(true);
    try {
      const mod = await import("../pdf/QuotePdf");
      const args = { q, co, cl, totals: t };
      if (mode === "share") {
        const shared = await mod.shareQuotePdf(args);
        if (!shared) await mod.downloadQuotePdf(args);
      } else await mod.downloadQuotePdf(args);
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (e?.name === "AbortError") return; // el usuario cerró el menú de compartir
      if (/dynamically imported module|Loading chunk|Importing a module script failed/i.test(msg)) {
        notify("Se publicó una versión nueva de Vortex. Recargando…");
        setTimeout(() => window.location.reload(), 1200);
        return;
      }
      console.error(e);
      notify("No se pudo generar el PDF. Usa el botón Imprimir y elige “Guardar como PDF”.", "error");
    } finally {
      setMaking(false);
    }
  };

  return (
    <div>
      <div className="no-print">
        <PageHead back={{ label: "Volver a la cotización", onClick: () => go("editor", q0.id) }} title="Vista previa del PDF"
          sub={ver ? `Documento de la versión ${ver.n} (${ver.reason}), tal como quedó guardado.` : "Datos actuales de la cotización. Las versiones enviadas o aceptadas se abren desde el panel Versiones."}
          actions={<>
            <Btn v="pri" icon={Download} disabled={making} onClick={() => makePdf("download")}>{making ? "Generando PDF…" : "Descargar PDF"}</Btn>
            {canShare && <Btn icon={Share2} disabled={making} onClick={() => makePdf("share")}>Compartir</Btn>}
            <Btn icon={Printer} onClick={() => window.print()}>Imprimir</Btn>
          </>} />
        <div className="vx-muted mb-3" style={{ fontSize: 12 }}>Papel: <b>{paper.label}</b> (se cambia en los datos de la cotización). Los costos, márgenes, notas internas y conceptos ocultos nunca llegan al documento.</div>
      </div>
      <style>{`@media print{@page{size:${paper.css};margin:10mm}}`}</style>
      <div className="vx-pdf" style={{ maxWidth: paper.px }}>
        {co?.headerPath ? <>
          <Img path={co.headerPath} alt={co.tradeName} style={{ width: "100%", display: "block" }} />
          <div style={{ height: 4, background: "linear-gradient(90deg,#08BFC5,#7928CA)" }} />
        </> : (
          <div className="pad" style={{ paddingTop: 36 }}>
            <div className="flex justify-between gap-6" style={{ borderBottom: `3px solid ${color}`, paddingBottom: 16 }}>
              <div className="flex items-center gap-3">
                {co?.logoPath ? <Img path={co.logoPath} style={{ maxHeight: 64, maxWidth: 190, objectFit: "contain" }} />
                  : <div style={{ width: 64, height: 64, borderRadius: 8, background: color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 20 }}>{co?.prefix}</div>}
                <div><div style={{ fontWeight: 800, fontSize: 18 }}>{co?.tradeName}</div>{co?.legalName && <div>{co.legalName}</div>}{co?.taxId && <div>NIT {co.taxId}</div>}</div>
              </div>
              <div className="text-right" style={{ fontSize: 11, lineHeight: 1.6 }}><div>{co?.address}</div><div>{co?.phone}</div><div>{co?.email}</div>{co?.web && <div>{co.web}</div>}</div>
            </div>
          </div>
        )}
        <div className="pad">
          <div className="flex justify-between mt-5 gap-6 flex-wrap">
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color }}>Cotización</div>
              {co?.headerPath && co?.taxId && <div>NIT {co.taxId}</div>}
              <div style={{ fontWeight: 700 }}>N.º {q.number}</div>
              <div>Fecha: {fmtDate(q.date)}</div>
              <div>Válida hasta: {fmtDate(q.validUntil)}</div>
            </div>
            <div style={{ background: "#F5F4FA", padding: "10px 14px", borderRadius: 6, minWidth: 240 }}>
              <div style={{ fontWeight: 700, marginBottom: 2 }}>Cliente</div>
              <div>{cl?.name}</div>{cl?.contact && <div>Atención: {cl.contact}</div>}{cl?.phone && <div>Tel. {cl.phone}</div>}{cl?.taxId && <div>NIT {cl.taxId}</div>}
            </div>
          </div>
          <div className="mt-4"><div style={{ fontWeight: 700 }}>{q.projectName}</div>{q.address && <div>Lugar de instalación: {q.address}</div>}{q.description && <div className="mt-1">{q.description}</div>}</div>
          <div className="vx-scroll">
            <table className="mt-4">
              <thead><tr><th style={{ width: 34 }}>N.º</th><th style={{ width: 66 }}></th><th>Descripción</th><th style={{ textAlign: "right" }}>Cant.</th><th style={{ textAlign: "right" }}>P. unitario</th><th style={{ textAlign: "right" }}>Subtotal</th></tr></thead>
              <tbody>{vis.map((l: any, idx: number) => {
                const c = lineCalc(l);
                return (
                  <tr key={l.id} style={{ breakInside: "avoid" }}>
                    <td style={{ fontWeight: 700, color: "#555" }}>{idx + 1}</td>
                    <td>{l.kind === "producto" && <LineImage path={l.imagePath} />}</td>
                    <td><div style={{ fontWeight: 600 }}>{l.name}</div>{l.description && <div style={{ color: "#555", fontSize: 11 }}>{l.description}</div>}{c.disc > 0 && <div style={{ fontSize: 11, color: "#1F8A55" }}>Descuento: - {fmtBs(c.disc)}</div>}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{fmtQty(l.qty)} {l.unit !== "servicio" ? l.unit : ""}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{fmtBs(l.price)}</td>
                    <td style={{ textAlign: "right", fontWeight: 600, whiteSpace: "nowrap" }}>{fmtBs(c.total)}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
          <div className="flex justify-end mt-3"><div style={{ minWidth: 260 }}>
            <div className="flex justify-between py-1"><span>Subtotal</span><span>{fmtBs(t.base)}</span></div>
            {t.gdisc > 0 && <div className="flex justify-between py-1"><span>Descuento</span><span>- {fmtBs(t.gdisc)}</span></div>}
            <div className="flex justify-between py-2 mt-1" style={{ borderTop: `2px solid ${color}`, fontWeight: 800, fontSize: 15 }}><span>Total</span><span>{fmtBs(t.total)}</span></div>
          </div></div>
          {q.terms && <div className="mt-4"><div style={{ fontWeight: 700 }}>Condiciones de pago</div><div style={{ whiteSpace: "pre-wrap" }}>{q.terms}</div></div>}
          {q.commercialNotes && <div className="mt-3"><div style={{ fontWeight: 700 }}>Observaciones</div><div style={{ whiteSpace: "pre-wrap" }}>{q.commercialNotes}</div></div>}
          {showSig && (
            <div style={{ marginTop: 18, breakInside: "avoid", pageBreakInside: "avoid" }}>
              <SignatureBlock co={co} />
            </div>
          )}
          {co?.footer && <div className="mt-6 pt-3 text-center" style={{ borderTop: "1px solid #E6EAED", fontSize: 11, color: "#666" }}>{co.footer}</div>}
        </div>
      </div>
    </div>
  );
}
