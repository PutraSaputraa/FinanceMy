import { auth } from '../firebase/config'

async function requestWhatsAppLink(method = 'GET') {
  const user = auth.currentUser
  if (!user) throw new Error('Login ke akun FinanceMy untuk menghubungkan WhatsApp.')
  const token = await user.getIdToken()
  const response = await fetch('/.netlify/functions/whatsapp-link', {
    method,
    headers: { authorization: `Bearer ${token}` },
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error || 'Gagal menghubungkan WhatsApp.')
  return result
}

export const getWhatsAppConnection = () => requestWhatsAppLink()
export const createWhatsAppPairingCode = () => requestWhatsAppLink('POST')
export const disconnectWhatsApp = () => requestWhatsAppLink('DELETE')
