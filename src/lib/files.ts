/* Imágenes y comprobantes en el bucket privado "vortex". Los archivos nunca se sobrescriben. */
import { useEffect, useState } from "react";
import { supabase, BUCKET } from "./supabase";
import { newId } from "./format";

const cache = new Map<string, { url: string; exp: number }>();
const isStatic = (p: string) => p.startsWith("/") || p.startsWith("data:") || p.startsWith("blob:") || p.startsWith("http");

/** Devuelve una dirección temporal para mostrar un archivo privado. */
export async function getFileUrl(path?: string | null): Promise<string | null> {
  if (!path) return null;
  if (isStatic(path)) return path;
  const hit = cache.get(path);
  if (hit && hit.exp > Date.now()) return hit.url;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error || !data) return null;
  cache.set(path, { url: data.signedUrl, exp: Date.now() + 50 * 60 * 1000 });
  return data.signedUrl;
}

export function useFileUrl(path?: string | null) {
  const [url, setUrl] = useState<string | null>(() => (path && isStatic(path) ? path : cache.get(path || "")?.url || null));
  useEffect(() => {
    let alive = true;
    if (!path) { setUrl(null); return; }
    getFileUrl(path).then((u) => alive && setUrl(u));
    return () => { alive = false; };
  }, [path]);
  return url;
}

/** Reduce el tamaño de una foto antes de subirla (JPG o PNG). */
async function compress(file: File, maxW: number, keepPng: boolean): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("No se pudo leer la imagen."));
      i.src = url;
    });
    const scale = Math.min(1, maxW / img.width);
    const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d")!;
    const png = keepPng && file.type === "image/png";
    if (!png) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); }
    ctx.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob>((res) => c.toBlob((b) => res(b || file), png ? "image/png" : "image/jpeg", 0.85));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Sube una imagen a la carpeta indicada y devuelve su ruta. */
export async function uploadImage(file: File, folder: string, opts: { maxW?: number; keepPng?: boolean } = {}): Promise<string> {
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
  if (!file.type.startsWith("image/") && !allowed.includes(file.type)) throw new Error("Solo se permiten imágenes JPG o PNG.");
  const blob = await compress(file, opts.maxW || 1400, !!opts.keepPng);
  const ext = blob.type === "image/png" ? "png" : "jpg";
  const path = `${folder}/${newId()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, upsert: false });
  if (error) throw error;
  return path;
}

/** Sube un comprobante (foto o PDF). */
export async function uploadReceipt(file: File, folder: string): Promise<string> {
  if (file.type === "application/pdf") {
    if (file.size > 10 * 1024 * 1024) throw new Error("El PDF no puede superar 10 MB.");
    const path = `${folder}/${newId()}.pdf`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: "application/pdf", upsert: false });
    if (error) throw error;
    return path;
  }
  return uploadImage(file, folder, { maxW: 1800 });
}

export async function openFile(path: string) {
  const url = await getFileUrl(path);
  if (url) window.open(url, "_blank", "noopener");
}

export async function removeFiles(paths: string[]) {
  const list = paths.filter((p) => p && !isStatic(p));
  if (list.length) await supabase.storage.from(BUCKET).remove(list);
}

/** Convierte una imagen (privada o pública) en datos incrustables para el PDF. */
export async function toDataUrl(path?: string | null): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith("data:")) return path;
  try {
    let blob: Blob;
    if (isStatic(path)) {
      const r = await fetch(path);
      if (!r.ok) return null;
      blob = await r.blob();
    } else {
      const { data, error } = await supabase.storage.from(BUCKET).download(path);
      if (error || !data) return null;
      blob = data;
    }
    return await new Promise<string>((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result));
      fr.onerror = () => rej(fr.error);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/* ---------- Firma: recorta los bordes vacíos para que ocupe bien la línea ---------- */
export type Trimmed = { url: string; w: number; h: number };

/** Quita los márgenes transparentes (o blancos) alrededor de una imagen. */
export async function trimImage(dataUrl: string): Promise<Trimmed> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("No se pudo leer la imagen."));
    i.src = dataUrl;
  });
  const W = img.naturalWidth, H = img.naturalHeight;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, W, H).data;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const empty = d[i + 3] < 20 || (d[i] > 240 && d[i + 1] > 240 && d[i + 2] > 240);
      if (!empty) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
  }
  if (x1 < 0) return { url: dataUrl, w: W, h: H };
  const pad = 4;
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(W - 1, x1 + pad); y1 = Math.min(H - 1, y1 + pad);
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const o = document.createElement("canvas");
  o.width = w; o.height = h;
  o.getContext("2d")!.drawImage(c, x0, y0, w, h, 0, 0, w, h);
  return { url: o.toDataURL("image/png"), w, h };
}

/** Calcula el tamaño para que la imagen quepa en un espacio sin deformarse. */
export const fitBox = (w: number, h: number, maxW: number, maxH: number) => {
  const k = Math.min(maxW / w, maxH / h);
  return { w: Math.round(w * k), h: Math.round(h * k) };
};

const trimCache = new Map<string, Trimmed>();
/** Carga la imagen de una firma ya recortada (sirve también para firmas subidas antes). */
export async function loadTrimmed(path?: string | null): Promise<Trimmed | null> {
  if (!path) return null;
  if (trimCache.has(path)) return trimCache.get(path)!;
  const data = await toDataUrl(path);
  if (!data) return null;
  try {
    const t = await trimImage(data);
    trimCache.set(path, t);
    return t;
  } catch {
    return null;
  }
}

export function useTrimmed(path?: string | null) {
  const [t, setT] = useState<Trimmed | null>(() => (path ? trimCache.get(path) || null : null));
  useEffect(() => {
    let alive = true;
    if (!path) { setT(null); return; }
    loadTrimmed(path).then((r) => alive && setT(r));
    return () => { alive = false; };
  }, [path]);
  return t;
}

/** Sube la firma ya recortada y en PNG para conservar la transparencia. */
export async function uploadSignature(file: File, folder: string): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("La firma debe ser una imagen PNG o JPG.");
  const raw = await new Promise<string>((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result));
    fr.onerror = () => rej(fr.error);
    fr.readAsDataURL(file);
  });
  const t = await trimImage(raw);
  // Limita el tamaño máximo para que el archivo sea liviano.
  const { w, h } = fitBox(t.w, t.h, 1000, 400);
  const img = await new Promise<HTMLImageElement>((res) => { const i = new Image(); i.onload = () => res(i); i.src = t.url; });
  const c = document.createElement("canvas");
  c.width = Math.min(w, t.w); c.height = Math.min(h, t.h);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise<Blob>((res) => c.toBlob((b) => res(b!), "image/png"));
  const path = `${folder}/${newId()}.png`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/png", upsert: false });
  if (error) throw error;
  return path;
}
