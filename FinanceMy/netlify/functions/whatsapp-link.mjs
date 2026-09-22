import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { adminAuth, adminDb, response as jsonResponse } from './_lib/firebase-admin.mjs'
import { createPairingCode, hashPairingCode, matchesConnectorKey, validPairingCode, validPhone, validSenderId } from './_lib/whatsapp-pairing.mjs'

const codeLifetimeMs = 10 * 60 * 1000
const issueCooldownMs = 30 * 1000

function response(status, body) {
  const result = jsonResponse(status, body)
  result.headers.set('cache-control', 'no-store')
  return result
}

class RequestError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

async function readJson(request) {
  try { return await request.json() } catch { return null }
}

async function requireUser(request) {
  const authorization = request.headers.get('authorization') || ''
  if (!authorization.startsWith('Bearer ')) throw new RequestError(401, 'Silakan login kembali.')
  let token
  try {
    token = await adminAuth.verifyIdToken(authorization.slice(7), true)
  } catch {
    throw new RequestError(401, 'Sesi tidak valid atau sudah berakhir.')
  }
  const profile = await adminDb.doc(`users/${token.uid}`).get()
  if (profile.data()?.status === 'disabled') throw new RequestError(403, 'Akun tidak aktif.')
  if (profile.exists) return { uid: token.uid, profileExists: true }

  const authUser = await adminAuth.getUser(token.uid)
  if (authUser.disabled) throw new RequestError(403, 'Akun tidak aktif.')
  return { uid: token.uid, profileExists: false, authUser }
}

async function ensureProfile(uid, authUser) {
  const ref = adminDb.doc(`users/${uid}`)
  await adminDb.runTransaction(async (transaction) => {
    const profile = await transaction.get(ref)
    if (profile.exists) {
      if (profile.data()?.status === 'disabled') throw new RequestError(403, 'Akun tidak aktif.')
      return
    }
    transaction.create(ref, {
      name: authUser.displayName || authUser.email?.split('@')[0] || 'Pengguna',
      email: authUser.email || '',
      status: 'active',
      currency: 'IDR',
      budgetStartDay: 1,
      onboardingCompleted: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
  })
}

function connectionBody(snapshot) {
  if (!snapshot.exists) return { connected: false }
  const data = snapshot.data()
  return {
    connected: true,
    phone: data.phone || null,
    linkedAt: data.linkedAt?.toDate().toISOString() || null,
  }
}

async function createCode(uid) {
  const connectionRef = adminDb.doc(`waConnections/${uid}`)
  const pendingRef = adminDb.doc(`waPendingByUser/${uid}`)
  const code = createPairingCode()
  const hash = hashPairingCode(code)
  const codeRef = adminDb.doc(`waPairingCodes/${hash}`)
  const now = Date.now()

  await adminDb.runTransaction(async (transaction) => {
    const [connection, pending] = await Promise.all([
      transaction.get(connectionRef), transaction.get(pendingRef),
    ])
    if (connection.exists) throw new RequestError(409, 'WhatsApp sudah terhubung. Putuskan dahulu untuk mengganti nomor.')
    if (pending.exists && pending.data().createdAt?.toMillis() > now - issueCooldownMs) {
      throw new RequestError(429, 'Tunggu sebentar sebelum membuat kode baru.')
    }
    if (pending.exists && pending.data().hash) {
      transaction.delete(adminDb.doc(`waPairingCodes/${pending.data().hash}`))
    }
    transaction.set(codeRef, {
      uid,
      createdAt: Timestamp.fromMillis(now),
      expiresAt: Timestamp.fromMillis(now + codeLifetimeMs),
    })
    transaction.set(pendingRef, { hash, createdAt: Timestamp.fromMillis(now) })
  })

  return response(201, { code, expiresAt: new Date(now + codeLifetimeMs).toISOString() })
}

async function disconnect(uid) {
  const connectionRef = adminDb.doc(`waConnections/${uid}`)
  const pendingRef = adminDb.doc(`waPendingByUser/${uid}`)
  const activeDraftRef = adminDb.doc(`waActiveDrafts/${uid}`)
  await adminDb.runTransaction(async (transaction) => {
    const [connection, pending, activeDraft] = await Promise.all([
      transaction.get(connectionRef), transaction.get(pendingRef), transaction.get(activeDraftRef),
    ])
    if (connection.exists) {
      const { senderId, phone } = connection.data()
      const senderRef = adminDb.doc(`waSenderLinks/${senderId}`)
      const phoneRef = phone ? adminDb.doc(`waPhoneLinks/${phone}`) : null
      const [sender, phoneLink] = await Promise.all([
        transaction.get(senderRef),
        phoneRef ? transaction.get(phoneRef) : Promise.resolve(null),
      ])
      transaction.delete(connectionRef)
      if (sender.data()?.uid === uid) transaction.delete(senderRef)
      if (phoneLink?.data()?.uid === uid) transaction.delete(phoneRef)
    }
    if (pending.exists) {
      if (pending.data().hash) transaction.delete(adminDb.doc(`waPairingCodes/${pending.data().hash}`))
      transaction.delete(pendingRef)
    }
    if (activeDraft.exists) transaction.delete(activeDraftRef)
  })
  return response(200, { connected: false })
}

async function claim(body) {
  const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : ''
  const senderId = body?.senderId
  const phone = body?.phone ?? null
  if (!validPairingCode(code) || !validSenderId(senderId) || !validPhone(phone)) {
    throw new RequestError(400, 'Data pasangan WhatsApp tidak valid.')
  }

  const codeRef = adminDb.doc(`waPairingCodes/${hashPairingCode(code)}`)
  const senderRef = adminDb.doc(`waSenderLinks/${senderId}`)
  const phoneRef = phone ? adminDb.doc(`waPhoneLinks/${phone}`) : null
  const now = Date.now()
  const linkedAt = Timestamp.fromMillis(now)

  await adminDb.runTransaction(async (transaction) => {
    const pairing = await transaction.get(codeRef)
    if (!pairing.exists || pairing.data().expiresAt?.toMillis() <= now) {
      throw new RequestError(410, 'Kode tidak tersedia atau sudah kedaluwarsa.')
    }
    const uid = pairing.data().uid
    const userRef = adminDb.doc(`users/${uid}`)
    const connectionRef = adminDb.doc(`waConnections/${uid}`)
    const pendingRef = adminDb.doc(`waPendingByUser/${uid}`)
    const [user, connection, pending, sender, phoneLink] = await Promise.all([
      transaction.get(userRef),
      transaction.get(connectionRef),
      transaction.get(pendingRef),
      transaction.get(senderRef),
      phoneRef ? transaction.get(phoneRef) : Promise.resolve(null),
    ])
    if (!user.exists || user.data()?.status === 'disabled') throw new RequestError(403, 'Akun tidak aktif.')
    if (pending.data()?.hash !== codeRef.id) throw new RequestError(410, 'Kode sudah diganti.')
    if (connection.exists) throw new RequestError(409, 'Akun sudah terhubung ke WhatsApp.')
    if (sender.exists && sender.data().uid !== uid) {
      throw new RequestError(409, 'Chat ini sudah terhubung ke akun lain.')
    }
    if (phoneLink?.exists && phoneLink.data().uid !== uid) {
      throw new RequestError(409, 'Nomor ini sudah terhubung ke akun lain.')
    }

    transaction.set(connectionRef, { senderId, phone, linkedAt })
    transaction.set(senderRef, { uid, phone, linkedAt })
    if (phoneRef) transaction.set(phoneRef, { uid, senderId, linkedAt })
    transaction.delete(codeRef)
    transaction.delete(pendingRef)
  })

  return response(200, { connected: true })
}

export default async (request) => {
  try {
    if (request.headers.has('x-financemy-connector-key')) {
      if (!matchesConnectorKey(request.headers.get('x-financemy-connector-key'), process.env.WA_CONNECTOR_KEY)) {
        return response(401, { error: 'Konektor tidak dikenal.' })
      }
      if (request.method !== 'POST') return response(405, { error: 'Metode tidak didukung.' })
      return await claim(await readJson(request))
    }

    const { uid, profileExists, authUser } = await requireUser(request)
    if (request.method === 'GET') {
      return response(200, connectionBody(await adminDb.doc(`waConnections/${uid}`).get()))
    }
    if (request.method === 'POST') {
      if (!profileExists) await ensureProfile(uid, authUser)
      return await createCode(uid)
    }
    if (request.method === 'DELETE') return await disconnect(uid)
    return response(405, { error: 'Metode tidak didukung.' })
  } catch (error) {
    if (error instanceof RequestError) return response(error.status, { error: error.message })
    console.error('Gagal memproses pasangan WhatsApp:', error)
    return response(500, { error: 'Layanan WhatsApp belum dapat memproses permintaan.' })
  }
}
