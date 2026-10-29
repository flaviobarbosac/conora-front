import { apiFetch, apiFormData, apiGetBlob } from '../client'
import { json } from './helpers'
import type {
  Member,
  FamilyProfile,
  UserPreferencesInput,
  FamilyOwnerTransfer,
  FamilyInvite,
  FamilyInvitePreview,
  FamilyGroupResponse,
  UpdateProfileInput,
} from './types'
export const membersApi = {
  list: () => apiFetch<Member[]>('/members'),
  create: (name: string) => apiFetch<Member>('/members', json('POST', { name, isActive: true })),
  update: (id: string, name: string, isActive: boolean) =>
    apiFetch<Member>(`/members/${id}`, json('PUT', { name, isActive })),
  remove: (id: string) => apiFetch<void>(`/members/${id}`, json('DELETE')),
}

export const familyApi = {
  profile: () => apiFetch<FamilyProfile>('/family/profile'),
  updateProfile: (input: string | UpdateProfileInput) => {
    const body = typeof input === 'string' ? { name: input } : input
    return apiFetch<FamilyProfile>('/family/profile', json('PUT', body))
  },
  updatePreferences: (input: UserPreferencesInput) =>
    apiFetch<FamilyProfile>('/family/preferences', json('PUT', input)),
  completeOnboarding: () => apiFetch<FamilyProfile>('/family/onboarding/complete', json('POST')),
  acknowledgeContract: () => apiFetch<FamilyProfile>('/family/profile/contract-acknowledgment', json('POST')),
  uploadPhoto: (file: Blob, fileName = 'photo.jpg') => {
    const form = new FormData()
    form.append('file', file, fileName)
    return apiFormData<FamilyProfile>('/family/profile/photo', form)
  },
  deletePhoto: () => apiFetch<FamilyProfile>('/family/profile/photo', json('DELETE')),
  photoBlob: () => apiGetBlob('/family/profile/photo'),
  group: () => apiFetch<FamilyGroupResponse>('/family/group'),
  invite: (email: string) => apiFetch<FamilyInvite>('/family/invites', json('POST', { email })),
  createQrInvite: () =>
    apiFetch<{ id: string; token: string; expiresAt: string; joinUrl: string }>('/family/invites/qr', json('POST')),
  cancelInvite: (id: string) => apiFetch<void>(`/family/invites/${id}`, json('DELETE')),
  previewInvite: (token: string) =>
    apiFetch<FamilyInvitePreview>(`/family/invites/${token}/preview`, { auth: false }),
  acceptInvite: (token: string) => apiFetch<FamilyGroupResponse>(`/family/invites/${token}/accept`, json('POST')),
  leave: () => apiFetch<void>('/family/leave', json('POST')),
  removeMember: (usuarioId: string) => apiFetch<void>(`/family/members/${usuarioId}`, json('DELETE')),
  requestOwnerTransfer: (toUsuarioId: string) =>
    apiFetch<FamilyOwnerTransfer>('/family/owner-transfer', json('POST', { toUsuarioId })),
  cancelOwnerTransfer: () => apiFetch<void>('/family/owner-transfer', json('DELETE')),
  acceptOwnerTransfer: (token: string) =>
    apiFetch<FamilyGroupResponse>(`/family/owner-transfer/${token}/accept`, json('POST')),
  confirmStoreCancelled: () => apiFetch<void>('/family/owner-transfer/store-cancelled', json('POST')),
  readNotice: (id: string) => apiFetch<void>(`/family/notices/${id}/read`, json('POST')),
}
