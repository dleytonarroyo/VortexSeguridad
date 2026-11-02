import { Component, type ReactNode } from "react";

/* Si una pantalla falla, muestra un aviso en lugar de dejar la página en blanco. */
export default class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: any }> {
  state = { error: null as any };
  static getDerivedStateFromError(error: any) { return { error }; }
  componentDidCatch(error: any) { console.error(error); }
  componentDidUpdate(prev: any) { if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null }); }
  render() {
    if (!this.state.error) return this.props.children;
    const isUpdate = /dynamically imported module|Loading chunk|Importing a module script failed/i.test(String(this.state.error?.message || ""));
    return (
      <div className="vx-card p-5" style={{ borderColor: "#EBC3C3" }}>
        <h2 className="mb-2">{isUpdate ? "Hay una versión nueva de Vortex" : "Algo salió mal en esta pantalla"}</h2>
        <div className="vx-muted mb-3">{isUpdate ? "Recarga la página para usar la versión más reciente." : "Tus datos están a salvo. Recarga la página; si el problema continúa, anota qué estabas haciendo."}</div>
        <button className="vx-btn pri" onClick={() => window.location.reload()}>Recargar página</button>
      </div>
    );
  }
}
