/* PDF comercial de la cotización. Se carga solo cuando el usuario pulsa "Descargar PDF". */
import { Document, Page, View, Text, Image, StyleSheet, pdf } from "@react-pdf/renderer";
import { toDataUrl } from "../lib/files";
import { fmtBs, fmtDate, fmtQty } from "../lib/format";
import { lineCalc } from "../lib/calc";

const s = StyleSheet.create({
  page: { paddingBottom: 40, fontSize: 9.5, fontFamily: "Helvetica", color: "#1A1A1A" },
  pad: { paddingHorizontal: 34 },
  gbar: { height: 3, backgroundColor: "#7928CA" },
  row: { flexDirection: "row" },
  h1: { fontSize: 18, fontFamily: "Helvetica-Bold" },
  bold: { fontFamily: "Helvetica-Bold" },
  muted: { color: "#555" },
  box: { backgroundColor: "#F5F4FA", padding: 8, borderRadius: 4, width: 210 },
  th: { backgroundColor: "#F1EEF9", flexDirection: "row", paddingVertical: 5, paddingHorizontal: 4, fontFamily: "Helvetica-Bold", fontSize: 8.5 },
  tr: { flexDirection: "row", borderBottomWidth: 0.6, borderBottomColor: "#E6E6EE", paddingVertical: 5, paddingHorizontal: 4, alignItems: "center" },
  cImg: { width: 50 }, cDesc: { flex: 1, paddingRight: 6 }, cQty: { width: 60, textAlign: "right" }, cPrice: { width: 75, textAlign: "right" }, cSub: { width: 80, textAlign: "right" },
  imgBox: { width: 42, height: 42, borderWidth: 0.6, borderColor: "#E6E6EE", borderRadius: 3, alignItems: "center", justifyContent: "center" },
  footer: { position: "absolute", bottom: 18, left: 34, right: 34, textAlign: "center", fontSize: 8, color: "#777", borderTopWidth: 0.6, borderTopColor: "#E6E6EE", paddingTop: 5 },
});

function QuoteDoc({ q, co, cl, totals, images }: any) {
  const color = co?.color || "#7928CA";
  const vis = (q.items || []).filter((l: any) => l.show);
  return (
    <Document title={`Cotización ${q.number}`} author={co?.tradeName || "Vortex"}>
      <Page size="A4" style={s.page}>
        {images.header ? (
          <View>
            <Image src={images.header} style={{ width: "100%" }} />
            <View style={s.gbar} />
          </View>
        ) : (
          <View style={[s.pad, { paddingTop: 28 }]}>
            <View style={[s.row, { justifyContent: "space-between", borderBottomWidth: 2, borderBottomColor: color, paddingBottom: 10 }]}>
              <View style={[s.row, { alignItems: "center" }]}>
                {images.logo ? <Image src={images.logo} style={{ height: 46, maxWidth: 150, objectFit: "contain", marginRight: 8 }} /> : null}
                <View>
                  <Text style={[s.bold, { fontSize: 13 }]}>{co?.tradeName}</Text>
                  {co?.legalName ? <Text>{co.legalName}</Text> : null}
                  {co?.taxId ? <Text>NIT {co.taxId}</Text> : null}
                </View>
              </View>
              <View style={{ alignItems: "flex-end", fontSize: 8.5 }}>
                {[co?.address, co?.phone, co?.email, co?.web].filter(Boolean).map((x: string, i: number) => <Text key={i}>{x}</Text>)}
              </View>
            </View>
          </View>
        )}

        <View style={[s.pad, s.row, { justifyContent: "space-between", marginTop: 14 }]}>
          <View>
            <Text style={[s.h1, { color }]}>Cotización</Text>
            {images.header && co?.taxId ? <Text>NIT {co.taxId}</Text> : null}
            <Text style={s.bold}>N.º {q.number}</Text>
            <Text>Fecha: {fmtDate(q.date)}</Text>
            <Text>Válida hasta: {fmtDate(q.validUntil)}</Text>
          </View>
          <View style={s.box}>
            <Text style={s.bold}>Cliente</Text>
            <Text>{cl?.name || ""}</Text>
            {cl?.contact ? <Text>Atención: {cl.contact}</Text> : null}
            {cl?.phone ? <Text>Tel. {cl.phone}</Text> : null}
            {cl?.taxId ? <Text>NIT {cl.taxId}</Text> : null}
          </View>
        </View>

        <View style={[s.pad, { marginTop: 10 }]}>
          <Text style={s.bold}>{q.projectName}</Text>
          {q.address ? <Text>Lugar de instalación: {q.address}</Text> : null}
          {q.description ? <Text style={{ marginTop: 2 }}>{q.description}</Text> : null}
        </View>

        <View style={[s.pad, { marginTop: 10 }]}>
          <View style={s.th}>
            <Text style={s.cImg}> </Text><Text style={s.cDesc}>Descripción</Text><Text style={s.cQty}>Cant.</Text><Text style={s.cPrice}>P. unitario</Text><Text style={s.cSub}>Subtotal</Text>
          </View>
          {vis.map((l: any) => {
            const c = lineCalc(l);
            return (
              <View key={l.id} style={s.tr} wrap={false}>
                <View style={s.cImg}>
                  {l.kind === "producto" ? (
                    <View style={s.imgBox}>{images.items[l.id] ? <Image src={images.items[l.id]} style={{ width: 40, height: 40, objectFit: "contain" }} /> : null}</View>
                  ) : null}
                </View>
                <View style={s.cDesc}>
                  <Text style={s.bold}>{l.name}</Text>
                  {l.description ? <Text style={[s.muted, { fontSize: 8 }]}>{l.description}</Text> : null}
                  {c.disc > 0 ? <Text style={{ fontSize: 8, color: "#1F8A55" }}>Descuento: - {fmtBs(c.disc)}</Text> : null}
                </View>
                <Text style={s.cQty}>{fmtQty(l.qty)} {l.unit !== "servicio" ? l.unit : ""}</Text>
                <Text style={s.cPrice}>{fmtBs(l.price)}</Text>
                <Text style={[s.cSub, s.bold]}>{fmtBs(c.total)}</Text>
              </View>
            );
          })}
        </View>

        <View style={[s.pad, { alignItems: "flex-end", marginTop: 8 }]} wrap={false}>
          <View style={{ width: 220 }}>
            <View style={[s.row, { justifyContent: "space-between", paddingVertical: 2 }]}><Text>Subtotal</Text><Text>{fmtBs(totals.base)}</Text></View>
            {totals.gdisc > 0 ? <View style={[s.row, { justifyContent: "space-between", paddingVertical: 2 }]}><Text>Descuento</Text><Text>- {fmtBs(totals.gdisc)}</Text></View> : null}
            <View style={[s.row, { justifyContent: "space-between", borderTopWidth: 1.5, borderTopColor: color, paddingTop: 5, marginTop: 3 }]}>
              <Text style={[s.bold, { fontSize: 12 }]}>Total</Text><Text style={[s.bold, { fontSize: 12 }]}>{fmtBs(totals.total)}</Text>
            </View>
          </View>
        </View>

        {q.terms ? <View style={[s.pad, { marginTop: 12 }]} wrap={false}><Text style={s.bold}>Condiciones de pago</Text><Text>{q.terms}</Text></View> : null}
        {q.commercialNotes ? <View style={[s.pad, { marginTop: 8 }]} wrap={false}><Text style={s.bold}>Observaciones</Text><Text>{q.commercialNotes}</Text></View> : null}
        {images.showSig ? (
          <View style={{ alignItems: "center", marginTop: 34 }} wrap={false}>
            <View style={{ width: 200, alignItems: "center" }}>
              {images.signature ? <Image src={images.signature} style={{ height: 62, maxWidth: 180, objectFit: "contain" }} /> : <View style={{ height: 46 }} />}
              <View style={{ borderTopWidth: 0.8, borderTopColor: "#333", width: 200, paddingTop: 4, alignItems: "center" }}>
                {co?.signerName ? <Text style={s.bold}>{co.signerName}</Text> : null}
                {co?.signerTitle ? <Text>{co.signerTitle}</Text> : null}
                {co?.signerExtra ? <Text style={[s.muted, { fontSize: 8.5, textAlign: "center" }]}>{co.signerExtra}</Text> : null}
              </View>
            </View>
          </View>
        ) : null}
        {co?.footer ? <Text style={s.footer} fixed>{co.footer}</Text> : null}
      </Page>
    </Document>
  );
}

const safeName = (t: string) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

/** Genera el PDF y devuelve el archivo listo para descargar o compartir. */
export async function buildQuotePdf({ q, co, cl, totals }: any): Promise<File> {
  const vis = (q.items || []).filter((l: any) => l.show && l.kind === "producto" && l.imagePath);
  const showSig = q.showSignature !== false && !!co && !!(co.signaturePath || co.signerName);
  const [header, logo, signature, ...itemImgs] = await Promise.all([
    toDataUrl(co?.headerPath), co?.headerPath ? Promise.resolve(null) : toDataUrl(co?.logoPath),
    showSig ? toDataUrl(co?.signaturePath) : Promise.resolve(null), ...vis.map((l: any) => toDataUrl(l.imagePath)),
  ]);
  const items: Record<string, string> = {};
  vis.forEach((l: any, i: number) => { if (itemImgs[i]) items[l.id] = itemImgs[i] as string; });
  const blob = await pdf(<QuoteDoc q={q} co={co} cl={cl} totals={totals} images={{ header, logo, items, signature, showSig }} />).toBlob();
  const name = ["Cotizacion", q.number, safeName(cl?.name)].filter(Boolean).join("-") + ".pdf";
  return new File([blob], name, { type: "application/pdf" });
}

export async function downloadQuotePdf(args: any) {
  const file = await buildQuotePdf(args);
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/** En el celular abre el menú para enviar el PDF por WhatsApp, correo, etc. */
export async function shareQuotePdf(args: any) {
  const file = await buildQuotePdf(args);
  const nav: any = navigator;
  if (nav.canShare && nav.canShare({ files: [file] })) {
    await nav.share({ files: [file], title: `Cotización ${args.q.number}` });
    return true;
  }
  return false;
}
