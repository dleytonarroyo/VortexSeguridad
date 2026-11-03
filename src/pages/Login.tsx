import { useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useApp, friendly } from "../data/store";
import { BrandMark, Btn, Field, Inp, PasswordInput } from "../components/ui";

const Shell = ({ children }: any) => (
  <div className="vx">
    <div className="flex items-center justify-center p-4" style={{ minHeight: "100vh", background: "radial-gradient(circle at 15% 10%, rgba(8,191,197,.35), transparent 40%), radial-gradient(circle at 85% 90%, rgba(121,40,202,.45), transparent 45%), #10142C" }}>
      <div className="vx-card p-7 w-full" style={{ maxWidth: 390 }}>
        <div className="mb-5"><BrandMark size={40} light={false} /><div className="vx-muted mt-1" style={{ fontSize: 12 }}>Gestión de instalaciones de seguridad</div></div>
        {children}
      </div>
    </div>
  </div>
);
export { Shell as AuthShell };

export default function Login() {
  const { session, profile } = useApp();
  const [mode, setMode] = useState<"login" | "forgot" | "sent">("login");
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
  const sendReset = async () => {
    const e = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { setErr("Escribe un correo válido."); return; }
    setSending(true); setErr("");
    const { error } = await supabase.auth.resetPasswordForEmail(e, { redirectTo: `${window.location.origin}/restablecer-contrasena` });
    setSending(false);
    if (error) setErr(friendly(error)); else setMode("sent");
  };

  if (mode === "sent") return (
    <Shell>
      <h2 className="mb-2">Revisa tu correo</h2>
      <p className="vx-muted" style={{ fontSize: 14 }}>Si <b>{email.trim()}</b> está registrado en Vortex, recibirás un enlace para crear una contraseña nueva. Revisa también la carpeta de spam o correo no deseado.</p>
      <p className="vx-muted" style={{ fontSize: 13 }}>El enlace vence en una hora y solo funciona una vez.</p>
      <Btn className="w-full justify-center mt-3" onClick={() => { setMode("login"); setErr(""); }}>Volver a iniciar sesión</Btn>
    </Shell>
  );

  if (mode === "forgot") return (
    <Shell>
      <h2 className="mb-2">¿Olvidaste tu contraseña?</h2>
      <p className="vx-muted mb-3" style={{ fontSize: 14 }}>Escribe tu correo y te enviaremos un enlace para crear una nueva.</p>
      <div className="space-y-3">
        <Field label="Correo electrónico"><Inp type="email" autoComplete="username" autoFocus value={email} onChange={(e: any) => setEmail(e.target.value)} onKeyDown={(e: any) => e.key === "Enter" && sendReset()} /></Field>
        {err && <div style={{ color: "var(--rec)", fontSize: 13 }}>{err}</div>}
        <Btn v="pri" className="w-full justify-center" disabled={sending} onClick={sendReset}>{sending ? "Enviando…" : "Enviar enlace"}</Btn>
        <Btn v="gh" className="w-full justify-center" onClick={() => { setMode("login"); setErr(""); }}>Volver a iniciar sesión</Btn>
      </div>
      <div className="vx-muted mt-4" style={{ fontSize: 12 }}>Si no recibes el correo, el administrador puede asignarte una contraseña nueva desde Usuarios.</div>
    </Shell>
  );

  return (
    <Shell>
      <div className="space-y-3">
        <Field label="Correo electrónico"><Inp type="email" autoComplete="username" value={email} onChange={(e: any) => setEmail(e.target.value)} /></Field>
        <Field label="Contraseña"><PasswordInput value={pw} onChange={(e: any) => setPw(e.target.value)} onKeyDown={(e: any) => e.key === "Enter" && submit()} /></Field>
        {session && profile?.missing && <div style={{ color: "var(--rec)", fontSize: 13 }}>Este usuario existe pero no tiene acceso a Vortex. Pide al administrador que lo habilite.</div>}
        {session && profile && !profile.missing && !profile.active && <div style={{ color: "var(--rec)", fontSize: 13 }}>Este usuario está desactivado.</div>}
        {err && <div style={{ color: "var(--rec)", fontSize: 13 }}>{err}</div>}
        <Btn v="pri" className="w-full justify-center" disabled={sending} onClick={submit}>{sending ? "Ingresando…" : "Iniciar sesión"}</Btn>
        <div className="text-center"><button className="vx-link" onClick={() => { setMode("forgot"); setErr(""); }}>¿Olvidaste tu contraseña?</button></div>
        {session && <Btn v="gh" className="w-full justify-center" onClick={() => supabase.auth.signOut()}>Usar otra cuenta</Btn>}
      </div>
    </Shell>
  );
}
