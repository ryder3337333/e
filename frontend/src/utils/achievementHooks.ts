import { api } from '../api';
import type { Achievement } from '../achievements';

/**
 * Calls the backend to evaluate achievements after an action.
 * Returns newly-unlocked achievements so the caller can show toasts.
 */
export async function checkAchievements(): Promise<Achievement[]> {
  try {
    const newly = await api<Achievement[]>('/achievements/check', { method: 'POST', body: {} });
    return Array.isArray(newly) ? newly : [];
  } catch {
    return [];
  }
}

export async function reportQuickdraw(ms: number): Promise<Achievement[]> {
  try {
    const newly = await api<Achievement[]>('/achievements/quickdraw', { method: 'POST', body: { ms } });
    return Array.isArray(newly) ? newly : [];
  } catch {
    return [];
  }
}
