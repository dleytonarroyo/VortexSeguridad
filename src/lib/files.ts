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
