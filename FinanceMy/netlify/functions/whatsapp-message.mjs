import { createHash } from 'node:crypto'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { adminDb, response as jsonResponse } from './_lib/firebase-admin.mjs'
import { matchesConnectorKey, validPhone, validSenderId } from './_lib/whatsapp-pairing.mjs'
import { parseWhatsAppDraft } from './_lib/whatsapp-draft.mjs'

function response(status, body) {
  const result = jsonResponse(status, body)
  result.headers.set('cache-control', 'no-store')
  return result
}

function messageBody(body) {
  const id = typeof body?.id === 'string' ? body.id.trim() : ''
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  if (!id || id.length > 300 || !validSenderId(body?.senderId) || !validPhone(body?.phone ?? null)
      || body?.type !== 'chat' || !text || text.length > 2000) return null
  return { id, text, senderId: body.senderId, phone: body.phone ?? null }
}

async function linkedUser(senderId, phone) {
  const sender = await adminDb.doc(`waSenderLinks/${senderId}`).get()
  const phoneLink = !sender.exists && phone ? await adminDb.doc(`waPhoneLinks/${phone}`).get() : null
  const uid = sender.data()?.uid || phoneLink?.data()?.uid
  if (!uid) return null
  const [connection, user] = await Promise.all([
    adminDb.doc(`waConnections/${uid}`).get(),
    adminDb.doc(`users/${uid}`).get(),
  ])
  if (!connection.exists || !user.exists || user.data()?.status === 'disabled') return null
  if (connection.data().senderId !== senderId && (!phone || connection.data().phone !== phone)) return null
  return uid
}

function jakartaDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

async function parseWithKenari(text) {
  const key = process.env.KENARI_API_KEY
  if (!key) throw new Error('KENARI_API_KEY belum dikonfigurasi')
  const today = jakartaDate()
  const result = await fetch('https://kenari.id/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: process.env.KENARI_MODEL || 'step-3-7-flash:free',
      stream: false,
      temperature: 0,
      max_tokens: 300,
      messages: [
        { role: 'system', content: `Ubah satu pesan WhatsApp menjadi draf transaksi keuangan pribadi. Hari ini ${today} zona Asia/Jakarta. Balas hanya objek JSON. Jika pesan bukan catatan transaksi yang jelas, balas {"kind":"ignore"}. Jika transaksi, isi field kind="transaction", type="expense" atau "income", title=nama singkat, amount=nominal rupiah angka atau null, category=kategori, date=tanggal YYYY-MM-DD, accountHint=nama sumber dana jika disebut atau string kosong. Kategori expense: Makan & Minum, Transportasi, Belanja, Kebutuhan Rumah, Tagihan, Langganan, Hiburan, Pengeluaran Lainnya. Kategori income: Gaji, Freelance, Bonus, Refund, Pemasukan lainnya. Jangan mengarang nominal, tanggal, atau sumber dana. Jika nominal tidak jelas, tetap buat transaction dengan amount null agar pengguna mengisi. Transfer antar akun, pertanyaan, dan perintah bukan transaksi; balas ignore.` },
        { role: 'user', content: text },
      ],
    }),
    signal: AbortSignal.timeout(25000),
  })
  if (!result.ok) throw new Error(`Kenari HTTP ${result.status}`)
  const data = await result.json()
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) throw new Error('Respons Kenari kosong')
  return parseWhatsAppDraft(content, today)
}

export default async (request) => {
  if (!matchesConnectorKey(request.headers.get('x-financemy-connector-key'), process.env.WA_CONNECTOR_KEY)) {
    return response(401, { error: 'Konektor tidak dikenal.' })
  }
  if (request.method !== 'POST') return response(405, { error: 'Metode tidak didukung.' })
  let body
  try { body = await request.json() } catch { return response(400, { error: 'Body JSON tidak valid.' }) }
  const message = messageBody(body)
  if (!message) return response(400, { error: 'Pesan WhatsApp tidak valid.' })

  try {
    const uid = await linkedUser(message.senderId, message.phone)
    if (!uid) return response(202, { status: 'unlinked' })
    const ref = adminDb.doc(`users/${uid}/whatsappMessages/${createHash('sha256').update(message.id).digest('hex')}`)
    const now = Date.now()
    let state = 'processing'
    await adminDb.runTransaction(async (transaction) => {
      state = 'processing'
      const snapshot = await transaction.get(ref)
      const data = snapshot.data()
      if (['draft', 'ignored', 'dismissed', 'recorded'].includes(data?.status)) {
        state = data.status
        return
      }
      if (data?.status === 'processing' && data.leaseUntil?.toMillis() > now) {
        state = 'busy'
        return
      }
      const update = { status: 'processing', leaseUntil: Timestamp.fromMillis(now + 35_000), updatedAt: FieldValue.serverTimestamp() }
      if (snapshot.exists) transaction.update(ref, update)
      else transaction.create(ref, { ...update, text: message.text, senderId: message.senderId, phone: message.phone, receivedAt: FieldValue.serverTimestamp(), source: 'whatsapp' })
    })
    if (state === 'busy') return response(503, { status: 'busy' })
    if (state !== 'processing') return response(200, { status: state })

    try {
      const draft = await parseWithKenari(message.text)
      await ref.update({ status: draft.status, parsed: draft.parsed, text: draft.status === 'ignored' ? FieldValue.delete() : message.text, leaseUntil: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() })
      return response(200, { status: draft.status })
    } catch (error) {
      console.error('Gagal memproses pesan WhatsApp:', error.message)
      await ref.update({ status: 'received', leaseUntil: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() })
      return response(503, { error: 'Pemrosesan AI belum tersedia. Pesan akan dicoba lagi.' })
    }
  } catch (error) {
    console.error('Gagal menyimpan pesan WhatsApp:', error.message)
    return response(500, { error: 'Pesan WhatsApp belum dapat disimpan.' })
  }
}
