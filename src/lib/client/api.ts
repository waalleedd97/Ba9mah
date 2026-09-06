export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface Options extends Omit<RequestInit, 'body'> {
  json?: unknown;
  body?: BodyInit | null;
}

/** طلب JSON موحّد: يرمي ApiError برسالة السيرفر ويحوّل للدخول عند 401 */
export async function api<T = unknown>(url: string, opts: Options = {}): Promise<T> {
  const { json, headers, ...rest } = opts;
  const res = await fetch(url, {
    ...rest,
    headers: { ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(headers ?? {}) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  // 401 من غير مسارات الدخول = انتهت الجلسة → تحويل كامل لصفحة الدخول
  if (res.status === 401 && !url.startsWith('/api/auth/')) {
    // خارج شجرة React (لا router هنا) — تحويل كامل مقصود لتصفير الحالة
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    if (typeof window !== 'undefined') window.location.href = '/login';
    throw new ApiError(401, 'unauthorized', 'انتهت الجلسة، سجّل الدخول من جديد');
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'error', data.message ?? `خطأ ${res.status}`);
  return data as T;
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'خطأ غير متوقع';
}

/** يقرأ ملفاً كـ data URL */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('تعذر قراءة الملف'));
    r.readAsDataURL(file);
  });
}
