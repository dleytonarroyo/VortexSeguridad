import { useState, type ReactNode } from "react";
import { Camera, X, ArrowLeft, Paperclip } from "lucide-react";
import { useFileUrl, openFile } from "../lib/files";
import { useApp } from "../data/store";

export const Btn = ({ v = "", sm, icon: Icon, children, className = "", ...rest }: any) => (
  <button type="button" className={`vx-btn ${v} ${sm ? "sm" : ""} ${className}`} {...rest}>
    {Icon && <Icon size={sm ? 13 : 15} />}
    {children}
  </button>
);

export const Field = ({ label, children, className = "" }: { label: ReactNode; children: ReactNode; className?: string }) => (
  <label className={`block ${className}`}>
    <span className="vx-lbl">{label}</span>
    {children}
  </label>
);

export const Inp = (p: any) => <input className={`vx-in ${p.type === "number" ? "num" : ""}`} {...p} />;

export const Sel = ({ options, ...p }: any) => (
  <select className="vx-in" {...p}>
    {options.map((o: any) =>
      typeof o === "string" ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>
    )}
  </select>
);

export const Badge = ({ map, s }: { map: Record<string, [string, string]>; s: string }) => {
  const [t, c] = map[s] || [s, "b-gray"];
  return (
    <span className={`vx-badge ${c}`}>
      {s === "en_ejecucion" && <span className="rec" />}
      {t}
    </span>
  );
};

export const Photo = ({ path, size = 44 }: { path?: string | null; size?: number }) => {
  const url = useFileUrl(path);
  return (
    <div className="vx-photo" style={{ width: size, height: size }}>
      {url ? <img src={url} alt="" /> : <Camera size={size * 0.42} />}
    </div>
  );
};

export const Img = ({ path, style, alt = "" }: { path?: string | null; style?: any; alt?: string }) => {
  const url = useFileUrl(path);
  return url ? <img src={url} alt={alt} style={style} /> : null;
};

export const Modal = ({ title, onClose, children, footer, wide }: any) => (
  <div className="vx-modal-bg" onClick={onClose}>
    <div className="vx-modal" style={wide ? { maxWidth: 820 } : {}} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--line)" }}>
        <h2>{title}</h2>
        <button className="vx-btn gh sm" onClick={onClose} aria-label="Cerrar"><X size={16} /></button>
      </div>
      <div className="px-5 py-4">{children}</div>
      {footer && <div className="flex justify-end gap-2 px-5 py-3 flex-wrap" style={{ borderTop: "1px solid var(--line)" }}>{footer}</div>}
    </div>
  </div>
);

export const PageHead = ({ title, sub, actions, back }: any) => (
  <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
    <div style={{ minWidth: 0 }}>
      {back && <button className="vx-btn gh sm mb-1" style={{ paddingLeft: 0 }} onClick={back.onClick}><ArrowLeft size={14} />{back.label}</button>}
      <h1>{title}</h1>
      {sub && <div className="vx-muted mt-1">{sub}</div>}
    </div>
    {actions && <div className="vx-actions">{actions}</div>}
  </div>
);

export const Kpi = ({ k, v, hint, tone }: any) => (
  <div className="vx-card vx-kpi p-4">
    <div className="k">{k}</div>
    <div className="v mt-1" style={tone ? { color: `var(--${tone})` } : {}}>{v}</div>
    {hint && <div className="vx-muted mt-1" style={{ fontSize: 12 }}>{hint}</div>}
  </div>
);

export const Empty = ({ text, action }: any) => (
  <div className="text-center py-10 px-4 vx-muted">
    <div className="mb-3">{text}</div>
    {action}
  </div>
);

export const Tabs = ({ tabs, value, onChange }: any) => (
  <div className="flex gap-1 mb-4 vx-scroll" style={{ borderBottom: "1px solid var(--line)" }}>
    {tabs.map(([k, l]: any) => <button key={k} className={`vx-tab ${value === k ? "on" : ""}`} onClick={() => onChange(k)}>{l}</button>)}
  </div>
);

export const Row = ({ k, v, strong, tone }: any) => (
  <div className="flex justify-between gap-3 py-1" style={strong ? { fontWeight: 700 } : {}}>
    <span className={strong ? "" : "vx-muted"}>{k}</span>
    <span style={{ textAlign: "right", ...(tone ? { color: `var(--${tone})` } : {}) }}>{v}</span>
  </div>
);

export const toneOf = (n: number) => (n < 0 ? "rec" : n > 0 ? "ok" : undefined);

export const Spinner = ({ text }: { text?: string }) => (
  <div className="flex flex-col items-center justify-center gap-3 py-16 vx-muted"><div className="vx-spin" />{text}</div>
);

export const BrandMark = ({ size = 30, light = true }: { size?: number; light?: boolean }) => (
  <div className="flex items-center gap-2">
    <img src="/brand/iso.png" alt="" width={size} height={size * 0.85} style={{ objectFit: "contain" }} />
    <div style={{ fontWeight: 800, fontSize: size * 0.62, letterSpacing: ".06em", color: light ? "#fff" : "var(--ink)" }}>VORTEX</div>
  </div>
);

export const ReceiptLink = ({ path }: { path?: string | null }) =>
  path ? <button className="vx-link" style={{ fontSize: 12 }} onClick={() => openFile(path)}><Paperclip size={12} /> Comprobante</button> : null;

/* Formulario genérico en ventana. Los campos tipo "file" devuelven el archivo elegido. */
export function FormModal({ title, fields, initial = {}, onSubmit, onClose, submitLabel = "Guardar", note, wide }: any) {
  const { busy } = useApp();
  const [v, setV] = useState<any>(initial);
  const [err, setErr] = useState("");
  const submit = async () => {
    const missing = fields.filter((f: any) => f.required && (!f.when || f.when(v)) && (v[f.k] === undefined || v[f.k] === "" || v[f.k] === null));
    if (missing.length) { setErr(`Completa: ${missing.map((f: any) => f.label.toLowerCase()).join(", ")}.`); return; }
    setErr("");
    const r = await onSubmit(v);
    if (typeof r === "string") setErr(r);
  };
  return (
    <Modal title={title} onClose={onClose} wide={wide} footer={<><Btn onClick={onClose}>Cancelar</Btn><Btn v="pri" disabled={busy} onClick={submit}>{busy ? "Guardando…" : submitLabel}</Btn></>}>
      {note && <div className="mb-3 vx-muted" style={{ fontSize: 13 }}>{note}</div>}
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
        {fields.filter((f: any) => !f.when || f.when(v)).map((f: any) => (
          <Field key={f.k} label={f.label + (f.required ? " *" : "")} className={f.full || f.type === "textarea" ? "col-span-full" : ""}>
            {f.type === "select" ? (
              <Sel value={v[f.k] ?? ""} onChange={(e: any) => setV({ ...v, [f.k]: e.target.value })} options={f.options} />
            ) : f.type === "textarea" ? (
              <textarea className="vx-in" rows={2} value={v[f.k] ?? ""} onChange={(e) => setV({ ...v, [f.k]: e.target.value })} />
            ) : f.type === "checkbox" ? (
              <label className="flex items-center gap-2 py-2"><input type="checkbox" checked={!!v[f.k]} onChange={(e) => setV({ ...v, [f.k]: e.target.checked })} />{f.hint}</label>
            ) : f.type === "file" ? (
              <input className="vx-in" type="file" accept={f.accept || "image/png,image/jpeg,application/pdf"} onChange={(e) => setV({ ...v, [f.k]: e.target.files?.[0] || null })} />
            ) : (
              <Inp type={f.type || "text"} min={f.type === "number" ? "0" : undefined} step={f.type === "number" ? "any" : undefined}
                inputMode={f.type === "number" ? "decimal" : undefined} value={v[f.k] ?? ""} onChange={(e: any) => setV({ ...v, [f.k]: e.target.value })} />
            )}
          </Field>
        ))}
      </div>
      {err && <div className="mt-3" style={{ color: "var(--rec)", fontSize: 13 }}>{err}</div>}
    </Modal>
  );
}
