/* Conversión de nombres de columnas: la base usa snake_case y la app camelCase. */
const toCamel = (k: string) => k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
const toSnake = (k: string) => k.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());
const NULL_IF_EMPTY = /(Id|Date|date|At|Start|End|Until|Return|acquired|Path)$/;

export const camelize = (row: any): any => {
  if (!row || typeof row !== "object") return row;
  const o: any = {};
  for (const k of Object.keys(row)) {
    const v = row[k];
    // Las columnas numeric llegan como número; se dejan tal cual.
    o[toCamel(k)] = v;
  }
  return o;
};

export const snakify = (obj: any): any => {
  const o: any = {};
  for (const k of Object.keys(obj)) {
    let v = obj[k];
    if (v === undefined) continue;
    if (v === "" && NULL_IF_EMPTY.test(k)) v = null;
    o[toSnake(k)] = v;
  }
  return o;
};
