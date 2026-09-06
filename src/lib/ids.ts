/** معرّفات قصيرة آمنة للمسارات: بادئة + 12 حرفاً عشوائياً (base36) */
export function newId(prefix: string): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  let s = '';
  for (const b of bytes) s += b.toString(36).padStart(2, '0');
  return `${prefix}_${s.slice(0, 12)}`;
}
