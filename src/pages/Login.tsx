import { useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useApp, friendly } from "../data/store";
import { BrandMark, Btn, Field, Inp } from "../components/ui";

export default function Login() {
  const { session, profile } = useApp();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [sending, setSending] = useState(false);
  if (session && profile && !profile.missing && profile.active) return <Navigate to="/dashboard" replace />;
  const submit = async () => {
    if (!email || !pw) { setErr("Escribe tu correo y tu contraseña."); return; }
    setSending(true); setErr("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
    setSending(false);
    if (error) setErr(friendly(error));
  };
  return (
    <div className="vx">
      <div className="flex items-center justify-center p-4" style={{ minHeight: "100vh", background: "radial-gradient(circle at 15% 10%, rgba(8,191,197,.35), transparent 40%), radial-gradient(circle at 85% 90%, rgba(121,40,202,.45), transparent 45%), #10142C" }}>
        <div className="vx-card p-7 w-full" style={{ maxWidth: 380 }}>
          <div className="mb-5"><BrandMark size={40} light={false} /><div className="vx-muted mt-1" style={{ fontSize: 12 }}>Gestión de instalaciones de seguridad</div></div>
          <div className="space-y-3">
            <Field label="Correo electrónico"><Inp type="email" autoComplete="username" value={email} onChange={(e: any) => setEmail(e.target.value)} /></Field>
            <Field label="Contraseña"><Inp type="password" autoComplete="current-password" value={pw} onChange={(e: any) => setPw(e.target.value)} onKeyDown={(e: any) => e.key === "Enter" && submit()} /></Field>
            {session && profile?.missing && <div style={{ color: "var(--rec)", fontSize: 13 }}>Este usuario existe pero no tiene acceso a Vortex. Pide al administrador que lo habilite.</div>}
            {session && profile && !profile.missing && !profile.active && <div style={{ color: "var(--rec)", fontSize: 13 }}>Este usuario está desactivado.</div>}
            {err && <div style={{ color: "var(--rec)", fontSize: 13 }}>{err}</div>}
            <Btn v="pri" className="w-full justify-center" disabled={sending} onClick={submit}>{sending ? "Ingresando…" : "Iniciar sesión"}</Btn>
            {session && <Btn v="gh" className="w-full justify-center" onClick={() => supabase.auth.signOut()}>Usar otra cuenta</Btn>}
          </div>
          <div className="vx-muted mt-4" style={{ fontSize: 12 }}>Si olvidaste tu contraseña, pide al administrador que te asigne una nueva desde Usuarios.</div>
        </div>
      </div>
    </div>
  );
}
