import { useTrimmed, fitBox } from "../lib/files";

/* Bloque de firma: la imagen se ajusta al ancho de la línea y queda apoyada sobre ella. */
export default function SignatureBlock({ co, width = 270 }: { co: any; width?: number }) {
  const t = useTrimmed(co?.signaturePath);
  const box = t ? fitBox(t.w, t.h, width - 20, 105) : null;
  return (
    <div style={{ width, textAlign: "center", margin: "0 auto" }}>
      {co?.signaturePath
        ? (t && box
          ? <img src={t.url} alt="Firma" style={{ width: box.w, height: box.h, display: "block", margin: "0 auto -8px", position: "relative" }} />
          : <div style={{ height: 70 }} />)
        : <div style={{ height: 50 }} />}
      <div style={{ borderTop: "1px solid #333", paddingTop: 5 }}>
        {co?.signerName && <div style={{ fontWeight: 700 }}>{co.signerName}</div>}
        {co?.signerTitle && <div>{co.signerTitle}</div>}
        {co?.signerExtra && <div style={{ whiteSpace: "pre-wrap", fontSize: 11, color: "#444" }}>{co.signerExtra}</div>}
      </div>
    </div>
  );
}
