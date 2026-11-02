import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { configOk } from "./lib/supabase";
import { AppProvider, useApp } from "./data/store";
import Layout from "./components/Layout";
import { Spinner } from "./components/ui";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import { Quotations, Trash } from "./pages/Quotations";
import QuoteEditor from "./pages/QuoteEditor";
import QuotePreview from "./pages/QuotePreview";
import { Projects, ProjectDetail } from "./pages/Projects";
import { Stock, Movements, Purchases } from "./pages/Inventory";
import Catalog from "./pages/Catalog";
import { Tools, Checklists } from "./pages/Tools";
import { Clients, ClientDetail, Suppliers, Installers } from "./pages/Contacts";
import Finance from "./pages/Finance";
import Companies from "./pages/Companies";
import SettingsPage from "./pages/Settings";
import UsersPage from "./pages/Users";

function ConfigMissing() {
  return (
    <div className="vx" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div className="vx-card p-7" style={{ maxWidth: 520 }}>
        <h1 className="mb-2">Falta conectar Supabase</h1>
        <p>La aplicación no encuentra las dos variables de conexión. En Netlify ve a <b>Site configuration → Environment variables</b> y agrega:</p>
        <p><code>VITE_SUPABASE_URL</code> con la Project URL y <code>VITE_SUPABASE_ANON_KEY</code> con la clave pública.</p>
        <p>Después ve a <b>Deploys → Trigger deploy → Deploy site</b> para volver a publicar.</p>
      </div>
    </div>
  );
}

function Protected({ children, admin }: { children: any; admin?: boolean }) {
  const { authReady, session, profile, isAdmin } = useApp();
  const loc = useLocation();
  if (!authReady || (session && !profile)) return <div className="vx" style={{ minHeight: "100vh" }}><Spinner text="Verificando sesión…" /></div>;
  if (!session || !profile || profile.missing || !profile.active) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (admin && !isAdmin) return <Navigate to="/dashboard" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  if (!configOk) return <ConfigMissing />;
  return (
    <AppProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
        <Route path="/cotizaciones" element={<Protected><Quotations /></Protected>} />
        <Route path="/cotizaciones/papelera" element={<Protected><Trash /></Protected>} />
        <Route path="/cotizaciones/:id" element={<Protected><QuoteEditor /></Protected>} />
        <Route path="/cotizaciones/:id/vista-previa" element={<Protected><QuotePreview /></Protected>} />
        <Route path="/proyectos" element={<Protected><Projects /></Protected>} />
        <Route path="/proyectos/:id" element={<Protected><ProjectDetail /></Protected>} />
        <Route path="/almacen" element={<Protected><Stock /></Protected>} />
        <Route path="/almacen/movimientos" element={<Protected><Movements /></Protected>} />
        <Route path="/almacen/compras" element={<Protected><Purchases /></Protected>} />
        <Route path="/movimientos" element={<Navigate to="/almacen/movimientos" replace />} />
        <Route path="/compras" element={<Navigate to="/almacen/compras" replace />} />
        <Route path="/catalogo" element={<Protected><Catalog /></Protected>} />
        <Route path="/herramientas" element={<Protected><Tools /></Protected>} />
        <Route path="/checklist" element={<Protected><Checklists /></Protected>} />
        <Route path="/clientes" element={<Protected><Clients /></Protected>} />
        <Route path="/clientes/:id" element={<Protected><ClientDetail /></Protected>} />
        <Route path="/proveedores" element={<Protected><Suppliers /></Protected>} />
        <Route path="/instaladores" element={<Protected><Installers /></Protected>} />
        <Route path="/finanzas" element={<Protected><Finance /></Protected>} />
        <Route path="/empresas" element={<Protected><Companies /></Protected>} />
        <Route path="/configuracion" element={<Protected><SettingsPage /></Protected>} />
        <Route path="/usuarios" element={<Protected admin><UsersPage /></Protected>} />
        <Route path="*" element={<Protected><div className="vx-card p-6"><h1>Página no encontrada</h1></div></Protected>} />
      </Routes>
    </AppProvider>
  );
}
