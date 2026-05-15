import { storage } from './utils/storage';

export const API_URL = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;
export const TOKEN_KEY = 'mace_token';

export type ApiError = { status: number; message: string };

export async function api<T = any>(
  path: string,
  opts: { method?: string; body?: any; auth?: boolean } = {}
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const authOn = opts.auth !== false;
  if (authOn) {
    const token = await storage.getItem<string>(TOKEN_KEY, '');
    if (token && typeof token === 'string') headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method || 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let data: any = null;
  const text = await res.text();
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = (data && data.detail) ? data.detail : `HTTP ${res.status}`;
    throw { status: res.status, message: typeof msg === 'string' ? msg : 'Request failed' } as ApiError;
  }
  return data as T;
}
