import { adminAuth, adminDb, response as jsonResponse } from './_lib/firebase-admin.mjs'
import { dismissDraft, DraftActionError, recordDraft } from './_lib/whatsapp-draft-actions.mjs'
import { userCategories } from './_lib/user-categories.mjs'

class RequestError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function response(status, body) {
  const result = jsonResponse(status, body)
  result.headers.set('cache-control', 'no-store')
  return result
}

async function owner(request) {
  const header = request.headers.get('authorization') || ''
  if (!header.startsWith('Bearer ')) throw new RequestError(401, 'Silakan login kembali.')
  let token
  try { token = await adminAuth.verifyIdToken(header.slice(7), true) }
  catch { throw new RequestError(401, 'Sesi tidak valid atau sudah berakhir.') }
  const user = await adminDb.doc(`users/${token.uid}`).get()
  if (!user.exists || user.data()?.status === 'disabled') throw new RequestError(403, 'Akun tidak aktif.')
  return token.uid
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T12:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function validTime(value) { return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) }
function validId(value) { return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value) }

function transactionInput(body, choices, retained) {
  const values = body?.values
  const type = values?.type
  const title = typeof values?.title === 'string' ? values.title.trim() : ''
  const amount = Number(values?.amount)
  const accountId = values?.accountId
  const category = values?.category
  const budgetId = values?.budgetId || null
  const date = values?.date
  const time = values?.time
  const needType = values?.needType || 'kebutuhan'
  const note = typeof values?.note === 'string' ? values.note.trim() : ''
  const categories = [...(choices[type] || []), ...(retained?.type === type ? [retained.category] : [])]
  if (!['income', 'expense'].includes(type) || !title || title.length > 120
      || !Number.isSafeInteger(amount) || amount <= 0 || amount > 1_000_000_000_000
      || !validId(accountId) || !categories.includes(category)
      || (budgetId && (!validId(budgetId) || type !== 'expense'))
      || !validDate(date) || !validTime(time)
      || !['wajib', 'kebutuhan', 'keinginan', 'tidak-terduga'].includes(needType)
      || note.length > 1000) throw new RequestError(400, 'Data transaksi belum lengkap atau tidak valid.')
  const transactionDate = new Date(`${date}T${time}:00+07:00`)
  if (Number.isNaN(transactionDate.getTime())) throw new RequestError(400, 'Tanggal transaksi tidak valid.')
  return { type, title, amount, accountId, category, budgetId, date, time, needType, note, transactionDate }
}

async function listDrafts(uid) {
  const snapshot = await adminDb.collection(`users/${uid}/whatsappMessages`).where('status', '==', 'draft').limit(50).get()
  const drafts = snapshot.docs.map((doc) => ({
    id: doc.id,
    text: doc.data().text || '',
    parsed: doc.data().parsed || null,
    receivedAt: doc.data().receivedAt?.toDate().toISOString() || null,
  })).sort((a, b) => String(b.receivedAt).localeCompare(String(a.receivedAt)))
  return response(200, { drafts })
}

async function dismiss(uid, draftId) {
  await dismissDraft(uid, draftId)
  return response(200, { status: 'dismissed' })
}

async function approve(uid, draftId, values) {
  await recordDraft(uid, draftId, values)
  return response(200, { status: 'recorded' })
}

export default async (request) => {
  try {
    const uid = await owner(request)
    if (request.method === 'GET') return await listDrafts(uid)
    if (request.method !== 'POST') return response(405, { error: 'Metode tidak didukung.' })
    let body
    try { body = await request.json() } catch { throw new RequestError(400, 'Body JSON tidak valid.') }
    const draftId = body?.draftId
    if (typeof draftId !== 'string' || !/^[a-f0-9]{64}$/.test(draftId)) throw new RequestError(400, 'ID draf tidak valid.')
    if (body.action === 'dismiss') return await dismiss(uid, draftId)
    if (body.action === 'approve') {
      const [categories, draft] = await Promise.all([userCategories(adminDb, uid), adminDb.doc(`users/${uid}/whatsappMessages/${draftId}`).get()])
      return await approve(uid, draftId, transactionInput(body, categories, draft.data()?.parsed))
    }
    return response(400, { error: 'Aksi tidak dikenal.' })
  } catch (error) {
    if (error instanceof RequestError || error instanceof DraftActionError) return response(error.status, { error: error.message })
    console.error('Gagal memproses draf WhatsApp:', error.message)
    return response(500, { error: 'Draf WhatsApp belum dapat diproses.' })
  }
}
