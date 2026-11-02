import { useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import {
  LayoutDashboard, FileText, FolderKanban, Package, Boxes, Wrench, ListChecks, Users, Building2, Truck,
  HardHat, Wallet, Settings, LogOut, Menu, ShoppingCart, History, ShieldCheck,
} from "lucide-react";
import { useApp } from "../data/store";
import { BrandMark, Spinner, Btn } from "./ui";
import ErrorBoundary from "./ErrorBoundary";

const NAV: [string, [string, string, any, boolean?][]][] = [
  ["Operación", [["dashboard", "Dashboard", LayoutDashboard], ["cotizaciones", "Cotizaciones", FileText], ["proyectos", "Proyectos", FolderKanban]]],
  ["Almacén", [["almacen", "Existencias", Boxes], ["movimientos", "Movimientos", History], ["compras", "Compras", ShoppingCart], ["catalogo", "Catálogo", Package], ["herramientas", "Herramientas", Wrench], ["checklist", "Checklist", ListChecks]]],
  ["Contactos", [["clientes", "Clientes", Users], ["proveedores", "Proveedores", Truck], ["instaladores", "Instaladores", HardHat]]],
  ["Gestión", [["finanzas", "Finanzas", Wallet], ["empresas", "Empresas emisoras", Building2], ["usuarios", "Usuarios", ShieldCheck, true], ["configuracion", "Configuración", Settings]]],
];

const activeFromPath = (p: string) => {
  if (p.startsWith("/almacen/movimientos")) return "movimientos";
  if (p.startsWith("/almacen/compras")) return "compras";
  const seg = p.split("/")[1] || "dashboard";
  return seg;
};

export default function Layout({ children }: { children: ReactNode }) {
  const { go, signOut, profile, isAdmin, loading, loadError, reload, db } = useApp();
  const { pathname } = useLocation();
  const [menu, setMenu] = useState(false);
  const active = activeFromPath(pathname);
  const nav = (k: string) => { setMenu(false); go(k); };

  const Side = (
    <nav className="vx-side h-full flex flex-col" style={{ width: 236 }}>
      <div className="flex items-center gap-2 px-4 py-4"><BrandMark /></div>
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {NAV.map(([g, items]) => (
          <div key={g}>
            <div className="grp">{g}</div>
            {items.filter(([, , , adminOnly]) => !adminOnly || isAdmin).map(([k, l, I]) => (
              <button key={k} className={`vx-nav ${active === k ? "on" : ""}`} onClick={() => nav(k)}><I size={16} />{l}</button>
            ))}
          </div>
        ))}
      </div>
      <div className="px-2 pb-3" style={{ borderTop: "1px solid var(--steel2)" }}>
        <div className="px-3 pt-3 pb-1" style={{ fontSize: 12, color: "var(--steel3)", overflow: "hidden", textOverflow: "ellipsis" }}>
          {profile?.email} · {profile?.role === "admin" ? "Administrador" : "Operador"}
        </div>
        <button className="vx-nav" onClick={signOut}><LogOut size={16} />Cerrar sesión</button>
      </div>
    </nav>
  );

  return (
    <div className="vx">
      <div className="flex" style={{ minHeight: "100vh" }}>
        <div className="hidden lg:block no-print" style={{ position: "sticky", top: 0, height: "100vh" }}>{Side}</div>
        {menu && (
          <div className="lg:hidden fixed inset-0 flex no-print" style={{ zIndex: 65 }}>
            <div className="h-full">{Side}</div>
            <div className="flex-1" style={{ background: "rgba(0,0,0,.4)" }} onClick={() => setMenu(false)} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="lg:hidden flex items-center gap-2 px-2 py-2 no-print" style={{ background: "var(--steel)", color: "#fff", position: "sticky", top: 0, zIndex: 40 }}>
            <button className="vx-btn gh sm" style={{ color: "#fff" }} onClick={() => setMenu(true)} aria-label="Abrir menú"><Menu size={22} /></button>
            <BrandMark size={28} />
          </div>
          <div className="vx-gbar no-print" style={{ borderRadius: 0, height: 3 }} />
          <main className={`vx-main p-4 md:p-7 ${/^\/cotizaciones\/(?!papelera)[^/]+$/.test(pathname) ? "has-mbar" : ""}`} style={{ maxWidth: 1320, margin: "0 auto" }}>
            {loadError ? (
              <div className="vx-card p-5" style={{ borderColor: "#EBC3C3" }}>
                <h2 className="mb-2">No se pudieron cargar los datos</h2>
                <div className="vx-muted mb-3">{loadError}</div>
                <Btn v="pri" onClick={() => reload()}>Reintentar</Btn>
              </div>
            ) : loading || !db ? <Spinner text="Cargando datos…" /> : <ErrorBoundary resetKey={pathname}>{children}</ErrorBoundary>}
          </main>
        </div>
      </div>
      <nav className="vx-bnav no-print" aria-label="Navegación principal">
        {[["dashboard", "Inicio", LayoutDashboard], ["cotizaciones", "Cotizaciones", FileText], ["proyectos", "Proyectos", FolderKanban], ["almacen", "Almacén", Boxes]].map(([k, l, I]: any) => (
          <button key={k} className={active === k ? "on" : ""} onClick={() => nav(k)}><I size={21} />{l}</button>
        ))}
        <button onClick={() => setMenu(true)}><Menu size={21} />Más</button>
      </nav>
    </div>
  );
}
