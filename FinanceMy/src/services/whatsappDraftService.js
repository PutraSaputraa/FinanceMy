import { auth } from '../firebase/config'

async function requestDrafts(method = 'GET', body) {
  const user = auth.currentUser
  if (!user) throw new Error('Login ke akun FinanceMy untuk melihat draf WhatsApp.')
  const token = await user.getIdToken()
  const response = await fetch('/.netlify/functions/whatsapp-drafts', {
    method,
    headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error || 'Draf WhatsApp belum dapat diproses.')
  return result
}

export const getWhatsAppDrafts = () => requestDrafts()
export const approveWhatsAppDraft = (draftId, values) => requestDrafts('POST', { action: 'approve', draftId, values })
export const dismissWhatsAppDraft = (draftId) => requestDrafts('POST', { action: 'dismiss', draftId })
