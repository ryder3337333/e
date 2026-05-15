import { storage } from '@/src/utils/storage';

const KEY = 'mace_device_id';

function rand(): string {
  return 'd_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export async function getDeviceId(): Promise<string> {
  const existing = await storage.getItem<string>(KEY, '');
  if (existing && typeof existing === 'string' && existing.length > 0) return existing;
  const id = rand();
  await storage.setItem(KEY, id);
  return id;
}
