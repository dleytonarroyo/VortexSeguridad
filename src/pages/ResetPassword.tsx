import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { friendly } from "../data/store";
import { Btn, Field, PasswordInput, Spinner } from "../components/ui";
import { AuthShell } from "./Login";

/* Página a la que llega el enlace del correo "restablecer contraseña". */
export default function ResetPassword() {
  const navigate = useNavigate();
  const [state, setState] = useState<"checking" | "ready" | "invalid" | "done">("checking");
  const [linkError] = useState(() => {
    const h = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const q = new URLSearchParams(window.location.search);
    return h.get("error_description") || q.get("error_description") || "";
  });
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (!alive) return;
      if (event === "PASSWORD_RECOVERY" || (s && event === "SIGNED_IN")) setState("ready");
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      if (data.session) setState("ready");
      else setTimeout(() => alive && setState((st) => (st === "checking" ? "invalid" : st)), 2500);
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);

  const save = async () => {
    if (a.length < 8) { setErr("La contraseña debe tener al menos 8 caracteres."); return; }
    if (a !== b) { setErr("Las contraseñas no coinciden."); return; }
    setSaving(true); setErr("");
    const { error } = await supabase.auth.updateUser({ password: a });
    setSaving(false);
    if (error) { setErr(friendly(error)); return; }
    window.history.replaceState(null, "", "/restablecer-contrasena");
    setState("done");
  };

  if (state === "checking" && !linkError) return <AuthShell><Spinner text="Verificando el enlace…" /></AuthShell>;
  if (state === "invalid" || linkError) return (
    <AuthShell>
      <h2 className="mb-2">El enlace no es válido</h2>
      <p className="vx-muted" style={{ fontSize: 14 }}>Puede que haya vencido o que ya se haya usado. Solicita uno nuevo desde la pantalla de inicio de sesión con “¿Olvidaste tu contraseña?”.</p>
      <Btn v="pri" className="w-full justify-center mt-3" onClick={() => navigate("/login", { replace: true })}>Ir a iniciar sesión</Btn>
    </AuthShell>
  );
  if (state === "done") return (
    <AuthShell>
      <h2 className="mb-2">Contraseña actualizada</h2>
      <p className="vx-muted" style={{ fontSize: 14 }}>Ya puedes usar tu nueva contraseña.</p>
      <Btn v="pri" className="w-full justify-center mt-3" onClick={() => navigate("/dashboard", { replace: true })}>Entrar a Vortex</Btn>
    </AuthShell>
  );
  return (
    <AuthShell>
      <h2 className="mb-2">Crea tu nueva contraseña</h2>
      <div className="space-y-3">
        <Field label="Nueva contraseña (mínimo 8 caracteres)"><PasswordInput autoComplete="new-password" autoFocus value={a} onChange={(e: any) => setA(e.target.value)} /></Field>
        <Field label="Repite la contraseña"><PasswordInput autoComplete="new-password" value={b} onChange={(e: any) => setB(e.target.value)} onKeyDown={(e: any) => e.key === "Enter" && save()} /></Field>
        {err && <div style={{ color: "var(--rec)", fontSize: 13 }}>{err}</div>}
        <Btn v="pri" className="w-full justify-center" disabled={saving} onClick={save}>{saving ? "Guardando…" : "Guardar contraseña"}</Btn>
      </div>
    </AuthShell>
  );
}
