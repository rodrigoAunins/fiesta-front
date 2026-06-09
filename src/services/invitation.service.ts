import api from '../api/axios';
import type { InvitationDesign } from '../components/invitation-editor/types';

const BASE = '/invitations';

export interface WorkspaceGuest {
  id: string;
  name: string;
  status: 'confirmed' | 'pending' | 'present' | 'absent';
  gender: 'female' | 'male' | 'other';
  food: string;
  age?: number | null;
  ageGroup: 'child' | 'adult' | 'senior';
  companions: number;
  companionsData: WorkspaceCompanion[];
  table: string;
  phone: string;
  email?: string;
  inviteCode: string;
  note?: string;
  side: 'left' | 'right';
  registrationSource: 'manual' | 'import' | 'public';
  reviewStatus: 'approved' | 'pending_review' | 'rejected';
  reviewedAt?: string | null;
  reviewedByUserId?: string | null;
  rejectionReason?: string;
}

export interface WorkspaceCompanion {
  id: string;
  name: string;
  status?: 'confirmed' | 'pending' | 'present' | 'absent';
  gender: 'female' | 'male' | 'other';
  food: string;
  age?: number | null;
  ageGroup: 'child' | 'adult' | 'senior';
  email?: string;
  phone?: string;
}

export interface InvitationSummary {
  id: string;
  name: string;
  published: boolean;
  status: 'draft' | 'published';
  publicSlug: string | null;
  publicUrl: string | null;
  publishedAt?: string | null;
  eventName?: string | null;
  updatedAt: string;
  design: InvitationDesign;
}

function normalizeInvitation(raw: any): InvitationSummary {
  const published = Boolean(raw?.published || raw?.status === 'published');
  const publicSlug = raw?.publicSlug || null;

  return {
    id: String(raw?.id || raw?.design?.id || ''),
    name: raw?.name || raw?.design?.name || 'Nueva invitacion',
    published,
    status: published ? 'published' : 'draft',
    publicSlug,
    publicUrl: published && publicSlug ? `/i/${publicSlug}` : null,
    publishedAt: raw?.publishedAt || null,
    eventName: raw?.eventName || null,
    updatedAt: raw?.updatedAt || raw?.design?.metadata?.updatedAt || new Date().toISOString(),
    design: raw?.design,
  };
}

export async function listInvitations(workspaceId: string): Promise<InvitationSummary[]> {
  const res = await api.get(`${BASE}/workspace/${workspaceId}`);
  return Array.isArray(res.data) ? res.data.map(normalizeInvitation) : [];
}

export async function getInvitationDesign(id: string): Promise<InvitationDesign | null> {
  const res = await api.get(`${BASE}/${id}`);
  return res.data?.design || null;
}

export async function createInvitationDesign(workspaceId: string, design: InvitationDesign): Promise<{ id: string }> {
  const res = await api.post(`${BASE}/${workspaceId}`, { design });
  return res.data;
}

export async function saveInvitationDesign(id: string, design: InvitationDesign): Promise<void> {
  await api.put(`${BASE}/${id}`, { design });
}

export async function deleteInvitation(id: string): Promise<void> {
  await api.delete(`${BASE}/${id}`);
}

export async function publishInvitation(id: string, published: boolean): Promise<{ publicSlug: string; published: boolean }> {
  const res = await api.post(`${BASE}/${id}/publish`, { published });
  return res.data;
}

export async function uploadInvitationImage(workspaceId: string, file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post(`${BASE}/${workspaceId}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  const url = res.data.url;
  if (typeof url === 'string' && url.startsWith('/uploads')) {
    const apiBase = String(api.defaults.baseURL || window.location.origin).replace(/\/api\/?$/, '');
    return `${apiBase}${url}`;
  }
  return url;
}

export async function getPublicInvitation(slug: string): Promise<InvitationDesign | null> {
  const res = await api.get(`${BASE}/public/${slug}`);
  const design = res.data?.design;
  if (!design) return null;

  return {
    ...design,
    metadata: {
      ...(design.metadata || {}),
      workspaceId: design.metadata?.workspaceId || res.data?.workspaceId,
    },
  };
}

export async function listWorkspaceGuests(workspaceId: string): Promise<WorkspaceGuest[]> {
  const res = await api.get(`${BASE}/workspace/${workspaceId}/guests`);
  return Array.isArray(res.data?.guests) ? res.data.guests : [];
}

export async function saveWorkspaceGuests(workspaceId: string, guests: WorkspaceGuest[]): Promise<WorkspaceGuest[]> {
  const res = await api.put(`${BASE}/workspace/${workspaceId}/guests`, { guests });
  return Array.isArray(res.data?.guests) ? res.data.guests : [];
}

export async function reviewWorkspaceGuest(
  workspaceId: string,
  guestId: string,
  reviewStatus: 'approved' | 'rejected',
  rejectionReason?: string,
): Promise<WorkspaceGuest> {
  const res = await api.post(`${BASE}/workspace/${workspaceId}/guests/${guestId}/review`, {
    reviewStatus,
    rejectionReason,
  });
  return res.data?.guest;
}

export async function submitPublicInvitationRsvp(
  slug: string,
  payload: {
    guestToken?: string;
    name?: string;
    email?: string;
    phone?: string;
    gender?: 'female' | 'male' | 'other';
    food?: string;
    age?: number | null;
    ageGroup?: 'child' | 'adult' | 'senior';
    confirmCompanions?: boolean;
    companionsData?: WorkspaceCompanion[];
  },
): Promise<WorkspaceGuest> {
  const res = await api.post(`${BASE}/public/${slug}/rsvp`, payload);
  return res.data?.guest;
}
