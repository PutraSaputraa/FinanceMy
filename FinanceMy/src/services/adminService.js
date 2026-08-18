import { auth } from '../firebase/config'

async function adminRequest(method = 'GET', body) {
  const user = auth.currentUser
  if (!user) throw new Error('Sesi admin telah berakhir.')
  const token = await user.getIdToken()
  const response = await fetch('/.netlify/functions/admin-users', {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error || 'Operasi admin gagal.')
  return result
}

export const listAdminUsers = () => adminRequest()
export const createAdminUser = (values) => adminRequest('POST', { action: 'create', ...values })
export const setAdminUserStatus = (uid, status) => adminRequest('PATCH', { action: 'set-status', uid, status })
export const sendAdminPasswordReset = (uid) => adminRequest('POST', { action: 'reset-password', uid })
