import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

function serviceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Konfigurasi Firebase Admin belum lengkap.')
  }
  return { projectId, clientEmail, privateKey }
}

const app = getApps()[0] || initializeApp({ credential: cert(serviceAccount()) })

export const adminAuth = getAuth(app)
export const adminDb = getFirestore(app)

export async function requireAdmin(request) {
  const authorization = request.headers.get('authorization') || ''
  if (!authorization.startsWith('Bearer ')) {
    return { error: response(401, { error: 'Sesi admin diperlukan.' }) }
  }

  try {
    const token = await adminAuth.verifyIdToken(authorization.slice(7), true)
    if (token.admin !== true) return { error: response(403, { error: 'Akun ini bukan admin.' }) }
    return { token }
  } catch {
    return { error: response(401, { error: 'Sesi admin tidak valid atau sudah berakhir.' }) }
  }
}

export function response(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}
