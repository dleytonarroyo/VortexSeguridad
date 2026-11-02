/* Sesión, carga de datos desde Supabase y utilidades compartidas por todas las páginas. */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { camelize, snakify } from "../lib/case";

/* Tablas que se cargan: clave en la app → [tabla, orden] */
const TABLES: Record<string, [string, string, boolean?]> = {
  settingsRows: ["app_settings", "id"],
  companies: ["companies", "trade_name"],
  clients: ["clients", "name"],
  suppliers: ["suppliers", "name"],
  installers: ["installers", "name"],
  products: ["products", "name"],
  priceHistory: ["product_price_history", "at", true],
  movements: ["inventory_movements", "date"],
  purchasesRaw: ["purchases", "date", true],
  purchaseItems: ["purchase_items", "id"],
  quotationsRaw: ["quotations", "date", true],
  quotationItems: ["quotation_items", "position"],
  versions: ["quotation_versions", "n"],
  projectsRaw: ["projects", "code", true],
  projectItems: ["project_items", "position"],
  checklistItems: ["project_checklist_items", "position"],
  projectInstallers: ["project_installers", "id"],
  installerPayments: ["installer_payments", "date"],
  payments: ["payments", "date"],
  expenses: ["expenses", "date"],
  tools: ["tools", "code"],
  toolAssignments: ["tool_assignments", "assigned_at"],
  templatesRaw: ["checklist_templates", "name"],
  templateItems: ["checklist_template_items", "position"],
  audit: ["audit_logs", "at", true],
};

async function fetchAll(table: string, order: string, desc?: boolean) {
  const out: any[] = [];
  const limit = table === "audit_logs" ? 400 : Infinity;
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select("*").order(order, { ascending: !desc }).range(from, from + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000 || out.length >= limit) break;
  }
  return out.map(camelize);
}

/* ---------- Mensajes de error comprensibles ---------- */
export function friendly(e: any): string {
  const msg = String(e?.message || e || "");
  const code = e?.code;
  if (code === "23505") return "Ya existe un registro con ese mismo dato (por ejemplo, el mismo código, SKU o prefijo).";
  if (code === "23503") return "No se puede completar porque este registro está relacionado con otros datos.";
  if (code === "23514") return "Algún valor no es válido. Revisa los montos, cantidades y estados.";
  if (code === "42501" || /row-level security/i.test(msg)) return "No tienes permiso para realizar esta acción.";
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.";
  if (/Invalid login credentials/i.test(msg)) return "Correo o contraseña incorrectos.";
  if (/banned/i.test(msg)) return "Este usuario está desactivado.";
  if (/JWT|token/i.test(msg)) return "Tu sesión expiró. Vuelve a iniciar sesión.";
  return msg || "Ocurrió un error inesperado.";
}

/* ---------- Acceso a datos ---------- */
export async function ins(table: string, obj: any) {
  const { data, error } = await supabase.from(table).insert(snakify(obj)).select().single();
  if (error) throw error;
  return camelize(data);
}
export async function insMany(table: string, rows: any[]) {
  if (!rows.length) return;
  const { error } = await supabase.from(table).insert(rows.map(snakify));
  if (error) throw error;
}
export async function upd(table: string, id: string | number, patch: any) {
  const { error } = await supabase.from(table).update(snakify(patch)).eq("id", id);
  if (error) throw error;
}
export async function del(table: string, id: string) {
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw error;
}
export async function rpc(fn: string, args: any) {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data;
}

/* ---------- Rutas de la aplicación ---------- */
export const pathFor = (page: string, id?: string | null, tab?: string | number | null): string => {
  switch (page) {
    case "editor": return `/cotizaciones/${id}`;
    case "preview": return `/cotizaciones/${id}/vista-previa${tab ? `?v=${tab}` : ""}`;
    case "papelera": return "/cotizaciones/papelera";
    case "proyecto": return `/proyectos/${id}${tab ? `?tab=${tab}` : ""}`;
    case "movimientos": return "/almacen/movimientos";
    case "compras": return `/almacen/compras${tab ? `?proyecto=${tab}` : ""}`;
    case "cliente": return `/clientes/${id}`;
    default: return `/${page}`;
  }
};

type Ctx = {
  session: Session | null;
  profile: any;
  isAdmin: boolean;
  authReady: boolean;
  db: any;
  loading: boolean;
  loadError: string | null;
  busy: boolean;
  reload: (keys?: string[]) => Promise<void>;
  notify: (text: string, kind?: "ok" | "error") => void;
  go: (page: string, id?: string | null, tab?: string | number | null, opts?: { force?: boolean }) => void;
  setLeaveGuard: (on: boolean) => void;
  run: (fn: () => Promise<any>, okMsg?: string, keys?: string[]) => Promise<boolean>;
  log: (text: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};
const AppCtx = createContext<Ctx>(null as any);
export const useApp = () => useContext(AppCtx);

export function AppProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);
  const [raw, setRaw] = useState<any>(null);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; kind: string } | null>(null);
  const toastTimer = useRef<any>(null);
  const guardRef = useRef(false);
  const lastLoad = useRef(0);

  const notify = useCallback((text: string, kind: "ok" | "error" = "ok") => {
    setToast({ text, kind });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), kind === "error" ? 6000 : 2800);
  }, []);

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!s) { setProfile(null); return; }
    const { data } = await supabase.from("profiles").select("*").eq("id", s.user.id).maybeSingle();
    setProfile(data ? camelize(data) : { missing: true, email: s.user.email });
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadProfile(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") loadProfile(s);
      if (event === "SIGNED_OUT") { setRaw(null); setProfiles([]); }
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const isAdmin = profile?.role === "admin" && profile?.active;
  const canUse = !!(profile && !profile.missing && profile.active);

  const reload = useCallback(async (keys?: string[]) => {
    const list = keys && keys.length ? keys : Object.keys(TABLES);
    try {
      const results = await Promise.all(list.map((k) => fetchAll(TABLES[k][0], TABLES[k][1], TABLES[k][2])));
      setRaw((prev: any) => {
        const next = { ...(prev || {}) };
        list.forEach((k, i) => (next[k] = results[i]));
        return next;
      });
      setLoadError(null);
      lastLoad.current = Date.now();
    } catch (e: any) {
      // Si ya hay datos en pantalla, una falla de red al refrescar no bloquea la aplicación.
      setRaw((prev: any) => { if (!prev) setLoadError(friendly(e)); return prev; });
    }
  }, []);

  const loadProfiles = useCallback(async () => {
    const { data } = await supabase.from("profiles").select("*").order("email");
    setProfiles((data || []).map(camelize));
  }, []);

  useEffect(() => {
    if (!canUse) return;
    setLoading(true);
    Promise.all([reload(), loadProfiles()]).finally(() => setLoading(false));
  }, [canUse, reload, loadProfiles]);

  /* Al volver a la aplicación (por ejemplo desde otra pestaña o desde WhatsApp) se actualizan los datos */
  useEffect(() => {
    if (!canUse) return;
    const onVis = () => {
      if (document.visibilityState === "visible" && Date.now() - lastLoad.current > 60000) { reload(); loadProfiles(); }
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => { document.removeEventListener("visibilitychange", onVis); window.removeEventListener("focus", onVis); };
  }, [canUse, reload, loadProfiles]);

  /* Aviso al cerrar o recargar la pestaña con cambios sin guardar */
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (guardRef.current) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, []);

  /* Arma las estructuras que usan las pantallas */
  const db = useMemo(() => {
    if (!raw) return null;
    const by = (rows: any[], key: string) => {
      const m: Record<string, any[]> = {};
      (rows || []).forEach((r) => (m[r[key]] = m[r[key]] || []).push(r));
      return m;
    };
    const qi = by(raw.quotationItems, "quotationId");
    const qv = by(raw.versions, "quotationId");
    const pi = by(raw.projectItems, "projectId");
    const pu = by(raw.purchaseItems, "purchaseId");
    const ti = by(raw.templateItems, "templateId");
    const ci = by(raw.checklistItems, "projectId");
    const s = (raw.settingsRows || [])[0] || {};
    return {
      ...raw,
      settings: {
        defaultMarkup: Number(s.defaultMarkup ?? 40), validityDays: Number(s.validityDays ?? 15), paymentTerms: s.paymentTerms || "",
        productCategories: s.productCategories || [], expenseCategories: s.expenseCategories || [],
      },
      quotations: (raw.quotationsRaw || []).map((q: any) => ({ ...q, items: qi[q.id] || [], versions: qv[q.id] || [] })),
      projects: (raw.projectsRaw || []).map((p: any) => ({ ...p, items: pi[p.id] || [] })),
      purchases: (raw.purchasesRaw || []).map((p: any) => ({ ...p, items: pu[p.id] || [] })),
      checklistTemplates: (raw.templatesRaw || []).map((t: any) => ({ ...t, items: ti[t.id] || [] })),
      projectChecklists: ci,
      profiles,
    };
  }, [raw, profiles]);

  const log = useCallback(async (text: string) => {
    try { await supabase.from("audit_logs").insert({ text, user_email: session?.user?.email || "" }); } catch { /* sin efecto */ }
  }, [session]);

  const run = useCallback(async (fn: () => Promise<any>, okMsg?: string, keys?: string[]) => {
    setBusy(true);
    try {
      await fn();
      await reload(keys && keys.length ? [...keys, "audit"] : undefined);
      if (okMsg) notify(okMsg);
      return true;
    } catch (e: any) {
      notify(friendly(e), "error");
      return false;
    } finally {
      setBusy(false);
    }
  }, [reload, notify]);

  const go = useCallback((page: string, id?: string | null, tab?: string | number | null, opts?: { force?: boolean }) => {
    if (guardRef.current && !opts?.force && !window.confirm("Tienes cambios sin guardar. ¿Quieres salir sin guardarlos?")) return;
    guardRef.current = false;
    navigate(pathFor(page, id, tab));
    try { window.scrollTo(0, 0); } catch { /* sin efecto */ }
  }, [navigate]);

  const signOut = useCallback(async () => {
    if (guardRef.current && !window.confirm("Tienes cambios sin guardar. ¿Quieres cerrar sesión de todos modos?")) return;
    guardRef.current = false;
    await supabase.auth.signOut();
    navigate("/login");
  }, [navigate]);

  const value: Ctx = {
    session, profile, isAdmin, authReady, db, loading, loadError, busy, reload, notify, go, run, log, signOut,
    setLeaveGuard: (on: boolean) => { guardRef.current = on; },
    refreshProfile: async () => { await loadProfile(session); await loadProfiles(); },
  };

  return (
    <AppCtx.Provider value={value}>
      {children}
      {toast && <div className={`vx-toast no-print ${toast.kind === "error" ? "err" : ""}`} role="status">{toast.text}</div>}
    </AppCtx.Provider>
  );
}
