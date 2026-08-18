import { randomBytes } from 'node:crypto'
import { FieldValue } from 'firebase-admin/firestore'
import { adminAuth, adminDb, requireAdmin, response } from './_lib/firebase-admin.mjs'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function readJson(request) {
  try {
    return await request.json()
  } catch {
    return null
  }
}

async function listUsers() {
  const users = []
  let pageToken
  do {
    const page = await adminAuth.listUsers(1000, pageToken)
    users.push(...page.users)
    pageToken = page.pageToken
  } while (pageToken)

  const refs = users.map((user) => adminDb.doc(`users/${user.uid}`))
  const docs = refs.length ? await adminDb.getAll(...refs) : []
  const profiles = new Map(docs.map((snapshot) => [snapshot.id, snapshot.data() || {}]))

  return users.map((user) => {
    const profile = profiles.get(user.uid) || {}
    return {
      uid: user.uid,
      name: profile.name || user.displayName || '',
      email: user.email || profile.email || '',
      status: user.disabled || profile.status === 'disabled' ? 'disabled' : 'active',
      createdAt: user.metadata.creationTime || null,
      lastSignInAt: user.metadata.lastSignInTime || null,
      isAdmin: user.customClaims?.admin === true,
    }
  }).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
}

async function createUser(body) {
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (name.length < 2 || name.length > 120) return response(400, { error: 'Nama harus terdiri dari 2–120 karakter.' })
  if (!EMAIL_PATTERN.test(email) || email.length > 254) return response(400, { error: 'Alamat email tidak valid.' })

  let user
  try {
    user = await adminAuth.createUser({
      displayName: name,
      email,
      emailVerified: false,
      password: randomBytes(48).toString('base64url'),
      disabled: false,
    })
    await adminDb.doc(`users/${user.uid}`).set({
      name,
      email,
      status: 'active',
      currency: 'IDR',
      budgetStartDay: 1,
      nextIncomeDate: null,
      onboardingCompleted: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
  } catch (error) {
    if (user) await adminAuth.deleteUser(user.uid).catch(() => {})
    if (error.code === 'auth/email-already-exists') return response(409, { error: 'Email ini sudah terdaftar.' })
    throw error
  }

  return response(201, { message: 'Pengguna berhasil dibuat.', email })
}

async function setStatus(body, adminUid) {
  const uid = typeof body?.uid === 'string' ? body.uid.trim() : ''
  const status = body?.status
  if (!uid || !['active', 'disabled'].includes(status)) return response(400, { error: 'UID atau status tidak valid.' })
  if (uid === adminUid && status === 'disabled') return response(400, { error: 'Admin tidak dapat menonaktifkan akunnya sendiri.' })

  const target = await adminAuth.getUser(uid)
  if (target.customClaims?.admin === true && status === 'disabled') {
    return response(400, { error: 'Akun admin tidak dapat dinonaktifkan dari halaman ini.' })
  }
  await adminAuth.updateUser(uid, { disabled: status === 'disabled' })
  await adminDb.doc(`users/${uid}`).set({ status, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
  await adminAuth.revokeRefreshTokens(uid)
  return response(200, { message: status === 'active' ? 'Pengguna diaktifkan kembali.' : 'Pengguna dinonaktifkan.' })
}

async function resetPassword(body) {
  const uid = typeof body?.uid === 'string' ? body.uid.trim() : ''
  if (!uid) return response(400, { error: 'UID pengguna diperlukan.' })
  const user = await adminAuth.getUser(uid)
  if (!user.email) return response(400, { error: 'Pengguna tidak memiliki alamat email.' })
  if (user.disabled) return response(400, { error: 'Aktifkan pengguna sebelum mengirim reset password.' })
  return response(200, { email: user.email })
}

export default async (request) => {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error

  try {
    if (request.method === 'GET') return response(200, { users: await listUsers() })
    const body = await readJson(request)
    if (!body) return response(400, { error: 'Body JSON tidak valid.' })
    if (request.method === 'POST' && body.action === 'create') return createUser(body)
    if (request.method === 'POST' && body.action === 'reset-password') return resetPassword(body)
    if (request.method === 'PATCH' && body.action === 'set-status') return setStatus(body, auth.token.uid)
    return response(405, { error: 'Metode atau aksi tidak didukung.' })
  } catch (error) {
    if (error.code === 'auth/user-not-found') return response(404, { error: 'Pengguna tidak ditemukan.' })
    return response(500, { error: 'Operasi admin gagal. Periksa konfigurasi server dan coba lagi.' })
  }
}
