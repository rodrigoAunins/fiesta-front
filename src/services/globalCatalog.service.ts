import api from '../api/axios';

export type GlobalCatalogItemKind = 'provider' | 'service';

export interface GlobalCatalogItem {
  id: string;
  kind: GlobalCatalogItemKind;
  name: string;
  category: string | null;
  description: string | null;
  phone: string | null;
  whatsapp: string | null;
  imageUrl: string | null;
  isActive: boolean;
  orderIndex: number;
  createdAt?: string;
  updatedAt?: string;
}

function normalizeCatalogItem(raw: any): GlobalCatalogItem {
  return {
    id: String(raw?.id || ''),
    kind: raw?.kind === 'service' ? 'service' : 'provider',
    name: String(raw?.name || '').trim(),
    category: String(raw?.category || '').trim() || null,
    description: String(raw?.description || '').trim() || null,
    phone: String(raw?.phone || '').trim() || null,
    whatsapp: String(raw?.whatsapp || '').trim() || null,
    imageUrl: String(raw?.imageUrl || '').trim() || null,
    isActive: raw?.isActive !== false,
    orderIndex: Number.isFinite(Number(raw?.orderIndex)) ? Number(raw.orderIndex) : 0,
    createdAt: raw?.createdAt || null,
    updatedAt: raw?.updatedAt || null,
  };
}

export async function listGlobalCatalog(): Promise<GlobalCatalogItem[]> {
  const res = await api.get('/admin/catalog');
  return Array.isArray(res.data) ? res.data.map(normalizeCatalogItem) : [];
}

export async function createGlobalCatalogItem(payload: Omit<GlobalCatalogItem, 'id'>): Promise<GlobalCatalogItem> {
  const res = await api.post('/admin/catalog', payload);
  return normalizeCatalogItem(res.data);
}

export async function updateGlobalCatalogItem(id: string, payload: Omit<GlobalCatalogItem, 'id'>): Promise<GlobalCatalogItem> {
  const res = await api.put(`/admin/catalog/${id}`, payload);
  return normalizeCatalogItem(res.data);
}

export async function deleteGlobalCatalogItem(id: string): Promise<void> {
  await api.delete(`/admin/catalog/${id}`);
}