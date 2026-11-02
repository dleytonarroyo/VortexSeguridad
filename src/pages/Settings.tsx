import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Save, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useApp, upd, friendly } from "../data/store";
import { PageHead, Btn, Field, Inp, Row, Tabs } from "../components/ui";
import { fmtBs, fmtPct, fmtDateTime, num } from "../lib/format";
import { suggested, marginOf } from "../lib/calc";

function CatEditor({ k, title }: { k: string; title: string }) {
  const { db, run, isAdmin } = useApp();
  const [val, setVal] = useState("");
  const list: string[] = db.settings[k] || [];
  const col = k === "productCategories" ? "productCategories" : "expenseCategories";
  const save = (next: string[]) => run(async () => { await upd("app_settings", 1, { [col]: next }); }, "Categorías actualizadas", ["settingsRows"]);
  return (
    <div className="vx-card p-4"><h3 className="mb-2">{title}</h3>
      {list.map((c) => (
        <div key={c} className="flex items-center justify-between py-1" style={{ borderBottom: "1px solid #EEEFF5" }}>
          <span>{c}</span>{isAdmin && <button className="vx-btn gh sm" aria-label={`Quitar ${c}`} onClick={() => save(list.filter((x) => x !== c))}><X size={13} /></button>}
        </div>
      ))}
      {isAdmin && <div className="flex gap-2 mt-3">
        <Inp placeholder="Nueva categoría" value={val} onChange={(e: any) => setVal(e.target.value)} />
        <Btn icon={Plus} disabled={!val.trim() || list.includes(val.trim())} onClick={() => { save([...list, val.trim()]); setVal(""); }}>Agregar</Btn>
      </div>}
    </div>
  );
}

export default function SettingsPage() {
  const { db, run, log, isAdmin, profile, notify } = useApp();
  const [sp, setSp] = useSearchParams();
  const tab = sp.get("tab") || "general";
  const [g, setG] = useState<any>(null);
  const [pw, setPw] = useState({ a: "", b: "" });
  useEffect(() => { setG({ defaultMarkup: db.settings.defaultMarkup, validityDays: db.settings.validityDays, paymentTerms: db.settings.paymentTerms }); }, [db.settings.defaultMarkup, db.settings.validityDays, db.settings.paymentTerms]);
  const changePw = async () => {
    if (pw.a.length < 8) { notify("La contraseña debe tener al menos 8 caracteres.", "error"); return; }
    if (pw.a !== pw.b) { notify("Las contraseñas no coinciden.", "error"); return; }
    const { error } = await supabase.auth.updateUser({ password: pw.a });
    if (error) notify(friendly(error), "error"); else { notify("Contraseña actualizada"); setPw({ a: "", b: "" }); }
  };
  return (
    <div>
      <PageHead title="Configuración" />
      <Tabs value={tab} onChange={(t: string) => setSp({ tab: t }, { replace: true })} tabs={[["general", "General y precios"], ["categorias", "Categorías"], ["cuenta", "Mi cuenta"], ["historial", "Historial de cambios"]]} />
      {tab === "general" && g && <div className="vx-card p-5" style={{ maxWidth: 640 }}>
        {!isAdmin && <div className="vx-muted mb-3" style={{ fontSize: 13 }}>Solo un administrador puede cambiar estos valores.</div>}
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
          <Field label="Incremento general sobre el costo (%)"><Inp type="number" disabled={!isAdmin} value={g.defaultMarkup} onChange={(e: any) => setG({ ...g, defaultMarkup: e.target.value })} /></Field>
          <Field label="Validez de cotizaciones (días)"><Inp type="number" disabled={!isAdmin} value={g.validityDays} onChange={(e: any) => setG({ ...g, validityDays: e.target.value })} /></Field>
        </div>
        <Field label="Condiciones de pago por defecto" className="mt-3"><textarea className="vx-in" rows={2} disabled={!isAdmin} value={g.paymentTerms} onChange={(e) => setG({ ...g, paymentTerms: e.target.value })} /></Field>
        <div className="vx-muted mt-2" style={{ fontSize: 12 }}>El incremento general se aplica a los productos que no tienen uno propio. Ejemplo: costo Bs 200 con {num(g.defaultMarkup)} % = precio sugerido {fmtBs(suggested(200, num(g.defaultMarkup)))}, margen {fmtPct(marginOf(suggested(200, num(g.defaultMarkup)), 200))}.</div>
        {isAdmin && <Btn v="pri" icon={Save} className="mt-4" onClick={() => run(async () => {
          await upd("app_settings", 1, { defaultMarkup: num(g.defaultMarkup), validityDays: Math.max(1, Math.round(num(g.validityDays))), paymentTerms: g.paymentTerms });
          await log("Configuración general actualizada.");
        }, "Configuración guardada", ["settingsRows"])}>Guardar cambios</Btn>}
      </div>}
      {tab === "categorias" && <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,320px),1fr))" }}>
        <CatEditor k="productCategories" title="Categorías de productos" /><CatEditor k="expenseCategories" title="Categorías de gastos" />
      </div>}
      {tab === "cuenta" && <div className="vx-card p-5" style={{ maxWidth: 520 }}>
        <Row k="Usuario" v={profile?.email} /><Row k="Nombre" v={profile?.fullName || "—"} /><Row k="Rol" v={profile?.role === "admin" ? "Administrador" : "Operador"} />
        <h3 className="mt-4 mb-2">Cambiar mi contraseña</h3>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
          <Field label="Nueva contraseña"><Inp type="password" autoComplete="new-password" value={pw.a} onChange={(e: any) => setPw({ ...pw, a: e.target.value })} /></Field>
          <Field label="Repite la contraseña"><Inp type="password" autoComplete="new-password" value={pw.b} onChange={(e: any) => setPw({ ...pw, b: e.target.value })} /></Field>
        </div>
        <Btn v="pri" className="mt-3" disabled={!pw.a} onClick={changePw}>Actualizar contraseña</Btn>
      </div>}
      {tab === "historial" && <div className="vx-card p-4">
        {db.audit.map((a: any) => (
          <div key={a.id} className="flex flex-wrap gap-x-4 py-2" style={{ borderBottom: "1px solid #EEEFF5" }}>
            <span className="vx-muted" style={{ fontSize: 12, minWidth: 150 }}>{fmtDateTime(a.at)}<br />{a.userEmail}</span><span style={{ flex: 1, minWidth: 200 }}>{a.text}</span>
          </div>
        ))}
        {!db.audit.length && <div className="vx-muted">Todavía no hay cambios registrados.</div>}
      </div>}
    </div>
  );
}
