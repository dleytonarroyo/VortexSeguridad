import { useState } from "react";
import { UserPlus, Pencil, KeyRound } from "lucide-react";
import { useApp, rpc } from "../data/store";
import { PageHead, Btn, Empty, FormModal } from "../components/ui";
import { fmtDate } from "../lib/format";

export default function UsersPage() {
  const { db, run, session, refreshProfile } = useApp();
  const [modal, setModal] = useState<any>(null);
  const users = db.profiles || [];
  const roleOpts = [{ value: "operador", label: "Operador (usa todos los módulos)" }, { value: "admin", label: "Administrador (además gestiona usuarios y configuración)" }];
  const after = async () => { await refreshProfile(); };
  return (
    <div>
      <PageHead title="Usuarios" sub="Personas que pueden entrar a Vortex" actions={<Btn v="pri" icon={UserPlus} onClick={() => setModal({ kind: "new" })}>Crear usuario</Btn>} />
      <div className="vx-card vx-scroll">{users.length ? <table className="vx-tbl">
        <thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th><th>Creado</th><th></th></tr></thead>
        <tbody>{users.map((u: any) => (
          <tr key={u.id} style={u.active ? {} : { opacity: 0.55 }}>
            <td><div style={{ fontWeight: 600 }}>{u.fullName || "Sin nombre"}{u.id === session?.user.id && <span className="vx-muted"> (tú)</span>}</div><div className="vx-muted" style={{ fontSize: 12 }}>{u.email}</div></td>
            <td>{u.role === "admin" ? <span className="vx-badge b-purple">Administrador</span> : <span className="vx-badge b-blue">Operador</span>}</td>
            <td>{u.active ? <span className="vx-badge b-green">Activo</span> : <span className="vx-badge b-gray">Desactivado</span>}</td>
            <td>{fmtDate(u.createdAt)}</td>
            <td className="r"><div className="flex gap-1 justify-end">
              <Btn sm icon={Pencil} onClick={() => setModal({ kind: "edit", user: u })}>Editar</Btn>
              <Btn sm icon={KeyRound} onClick={() => setModal({ kind: "pw", user: u })}>Contraseña</Btn>
            </div></td>
          </tr>
        ))}</tbody></table> : <Empty text="No hay usuarios." />}</div>
      <div className="vx-muted mt-3" style={{ fontSize: 12 }}>Los usuarios desactivados no pueden iniciar sesión, pero sus registros se conservan.</div>

      {modal?.kind === "new" && <FormModal title="Crear usuario" submitLabel="Crear usuario" onClose={() => setModal(null)} initial={{ role: "operador" }}
        note="La persona podrá entrar de inmediato con este correo y contraseña. Compártelos de forma privada."
        onSubmit={async (v: any) => {
          if (String(v.password).length < 8) return "La contraseña debe tener al menos 8 caracteres.";
          const ok = await run(async () => { await rpc("admin_create_user", { p_email: v.email, p_password: v.password, p_full_name: v.fullName || "", p_role: v.role }); await after(); }, "Usuario creado", ["audit"]);
          if (ok) setModal(null);
        }}
        fields={[{ k: "fullName", label: "Nombre", required: true }, { k: "email", label: "Correo electrónico", type: "email", required: true }, { k: "password", label: "Contraseña (mínimo 8 caracteres)", type: "text", required: true }, { k: "role", label: "Rol", type: "select", options: roleOpts, full: true }]} />}
      {modal?.kind === "edit" && <FormModal title={`Editar ${modal.user.email}`} onClose={() => setModal(null)} initial={{ fullName: modal.user.fullName, role: modal.user.role, active: modal.user.active }}
        onSubmit={async (v: any) => {
          const ok = await run(async () => { await rpc("admin_update_user", { p_user: modal.user.id, p_full_name: v.fullName || "", p_role: v.role, p_active: !!v.active }); await after(); }, "Usuario actualizado", ["audit"]);
          if (ok) setModal(null);
        }}
        fields={[{ k: "fullName", label: "Nombre" }, { k: "role", label: "Rol", type: "select", options: roleOpts, full: true }, { k: "active", label: "Estado", type: "checkbox", hint: "Puede iniciar sesión" }]} />}
      {modal?.kind === "pw" && <FormModal title={`Nueva contraseña para ${modal.user.email}`} submitLabel="Cambiar contraseña" onClose={() => setModal(null)}
        onSubmit={async (v: any) => {
          if (String(v.password || "").length < 8) return "La contraseña debe tener al menos 8 caracteres.";
          const ok = await run(async () => { await rpc("admin_reset_password", { p_user: modal.user.id, p_password: v.password }); }, "Contraseña actualizada", ["audit"]);
          if (ok) setModal(null);
        }}
        fields={[{ k: "password", label: "Nueva contraseña (mínimo 8 caracteres)", type: "text", required: true, full: true }]} />}
    </div>
  );
}
