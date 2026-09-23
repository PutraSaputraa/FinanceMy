import { createHash } from 'node:crypto'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { adminDb, response as jsonResponse } from './_lib/firebase-admin.mjs'
import { answerFinanceQuery, parseAssistantIntent } from './_lib/finance-assistant.mjs'
import { dismissDraft, DraftActionError, recordDraft } from './_lib/whatsapp-draft-actions.mjs'
import { chatCommand, chatTransactionValues, draftConfirmation, simpleRevision } from './_lib/whatsapp-chat.mjs'
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

function jakartaTime() {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())
}

async function kenariCompletion(messages) {
  const key = process.env.KENARI_API_KEY
  if (!key) throw new Error('KENARI_API_KEY belum dikonfigurasi')
  const result = await fetch('https://kenari.id/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: process.env.KENARI_MODEL || 'step-3-7-flash:free',
      stream: false,
      temperature: 0,
      max_tokens: 300,
      messages,
    }),
    signal: AbortSignal.timeout(25000),
  })
  if (!result.ok) throw new Error(`Kenari HTTP ${result.status}`)
  const data = await result.json()
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) throw new Error('Respons Kenari kosong')
  return content
}

async function parseWithKenari(text) {
  const today = jakartaDate()
  const content = await kenariCompletion([
    { role: 'system', content: `Kenali maksud satu pesan WhatsApp untuk FinanceMy. Hari ini ${today} zona Asia/Jakarta. Balas hanya satu objek JSON tanpa markdown.

Jika pengguna menyatakan transaksi baru yang benar-benar terjadi, balas {"kind":"transaction","type":"expense|income","title":"nama singkat","amount":angka rupiah atau null,"category":"kategori","date":"YYYY-MM-DD","accountHint":"nama akun atau kosong","budgetHint":"nama budget atau kosong"}. Kategori expense: Makan & Minum, Transportasi, Belanja, Kebutuhan Rumah, Tagihan, Langganan, Hiburan, Pengeluaran Lainnya. Kategori income: Gaji, Freelance, Bonus, Refund, Pemasukan lainnya. Jangan mengarang nominal, akun, budget, atau tanggal. Jika tanggal tidak disebut, pakai hari ini. Transfer antar akun belum didukung.

Jika pengguna meminta informasi, ringkasan, atau saran berdasarkan data akun FinanceMy miliknya, balas {"kind":"finance_query","topics":[...],"mode":"list|summary|advice","periodStart":"YYYY-MM-DD atau null","periodEnd":"YYYY-MM-DD atau null","transactionType":"all|expense|income|transfer","category":"atau kosong","account":"atau kosong","search":"nama yang dicari atau kosong"}. Topik yang diizinkan: overview, accounts, budgets, debts, receivables, installments, recurring, goals, transactions. Pilih maksimal 4 topik. Gunakan accounts untuk saldo, budgets untuk budget bulan berjalan, debts untuk utang, receivables untuk piutang, installments untuk cicilan, recurring untuk transaksi rutin, goals untuk target, transactions untuk riwayat/pemasukan/pengeluaran, dan overview untuk kondisi keuangan umum. Untuk pertanyaan transaksi, terjemahkan keterangan waktu relatif menjadi periodStart dan periodEnd. Untuk nama budget, utang, jadwal, atau target tertentu, masukkan namanya pada search. Untuk transaksi tertentu, gunakan category, account, atau search.

Jika tidak berkaitan dengan pencatatan atau data keuangan FinanceMy, balas {"kind":"unsupported"}. Pertanyaan tidak boleh dianggap sebagai transaksi.` },
    { role: 'user', content: text },
  ])
  return parseAssistantIntent(content, today)
}

async function reviseWithKenari(parsed, revision) {
  const content = await kenariCompletion([
    { role: 'system', content: `Ubah draf transaksi berdasarkan revisi pengguna. Balas hanya objek JSON lengkap dengan kind="transaction", type, title, amount, category, date, accountHint, budgetHint. Pertahankan semua field lama yang tidak diminta berubah. Nominal harus angka rupiah. Jika pengguna berkata tanpa budget, budgetHint harus string kosong. Jangan mengarang informasi baru. Draf lama: ${JSON.stringify(parsed)}` },
    { role: 'user', content: revision },
  ])
  const draft = parseWhatsAppDraft(content, parsed.date)
  if (draft.status !== 'draft' || !draft.parsed.title) throw new Error('Revisi belum dapat dipahami')
  return draft.parsed
}

async function choices(uid) {
  const [accounts, budgets] = await Promise.all([
    adminDb.collection(`users/${uid}/accounts`).get(),
    adminDb.collection(`users/${uid}/budgets`).get(),
  ])
  return {
    accounts: accounts.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    budgets: budgets.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
  }
}

async function financeData(uid, plan) {
  const required = new Set()
  const dependencies = {
    overview: ['accounts', 'transactions', 'budgets', 'debts', 'installments'],
    accounts: ['accounts'],
    budgets: ['transactions', 'budgets'],
    debts: ['debts'],
    receivables: ['receivables'],
    installments: ['installments'],
    recurring: ['recurringTransactions'],
    goals: ['goals'],
    transactions: ['transactions'],
  }
  for (const topic of plan.topics) dependencies[topic]?.forEach((name) => required.add(name))
  const names = [...required]
  const snapshots = await Promise.all(names.map((name) => {
    const collection = adminDb.collection(`users/${uid}/${name}`)
    return name === 'transactions' ? collection.limit(1000).get() : collection.get()
  }))
  const result = Object.fromEntries(Object.values(dependencies).flat().map((name) => [name, []]))
  for (const [index, name] of names.entries()) result[name] = snapshots[index].docs.map((doc) => ({ id: doc.id, ...doc.data() }))
  return result
}

async function finish(ref, status, reply) {
  await ref.update({ status, reply: reply || FieldValue.delete(), parsed: FieldValue.delete(), text: FieldValue.delete(), leaseUntil: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() })
  return response(200, { status, ...(reply ? { reply } : {}) })
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
    const activeRef = adminDb.doc(`waActiveDrafts/${uid}`)
    const command = chatCommand(message.text)
    const now = Date.now()
    let state = 'processing'
    let previousReply = null
    let targetDraftId = null
    await adminDb.runTransaction(async (transaction) => {
      state = 'processing'
      previousReply = null
      targetDraftId = null
      const [snapshot, active] = await Promise.all([transaction.get(ref), transaction.get(activeRef)])
      const data = snapshot.data()
      if (['draft', 'ignored', 'dismissed', 'recorded', 'handled'].includes(data?.status)) {
        state = data.status
        previousReply = data.reply || null
        return
      }
      if (data?.status === 'processing' && data.leaseUntil?.toMillis() > now) {
        state = 'busy'
        return
      }
      targetDraftId = data?.targetDraftId || active.data()?.draftId || null
      const update = { status: 'processing', leaseUntil: Timestamp.fromMillis(now + 35_000), updatedAt: FieldValue.serverTimestamp() }
      if (targetDraftId) update.targetDraftId = targetDraftId
      if (snapshot.exists) transaction.update(ref, update)
      else transaction.create(ref, { ...update, text: message.text, senderId: message.senderId, phone: message.phone, receivedAt: FieldValue.serverTimestamp(), source: 'whatsapp' })
    })
    if (state === 'busy') return response(503, { status: 'busy' })
    if (state !== 'processing') return response(200, { status: state, ...(previousReply ? { reply: previousReply } : {}) })

    try {
      const draftRef = targetDraftId ? adminDb.doc(`users/${uid}/whatsappMessages/${targetDraftId}`) : null
      const activeDraft = draftRef ? await draftRef.get() : null
      const activeStatus = activeDraft?.data()?.status

      if (command.kind !== 'other' && !targetDraftId) {
        return finish(ref, 'handled', 'Belum ada draf aktif. Kirim catatan pengeluaran atau pemasukan terlebih dahulu.')
      }
      if (command.kind === 'submit' && activeStatus === 'recorded') {
        return finish(ref, 'handled', 'Transaksi ini sudah tercatat di FinanceMy.')
      }
      if (command.kind === 'cancel' && activeStatus === 'dismissed') {
        return finish(ref, 'handled', 'Draf sudah dibatalkan.')
      }
      if (command.kind !== 'other' && activeStatus !== 'draft') {
        return finish(ref, 'handled', 'Draf ini sudah selesai. Kirim catatan baru untuk membuat draf berikutnya.')
      }
      if (command.kind === 'cancel') {
        await dismissDraft(uid, targetDraftId)
        return finish(ref, 'handled', 'Draf dibatalkan. Saldo tidak berubah.')
      }
      if (command.kind === 'submit') {
        const { accounts, budgets } = await choices(uid)
        const prepared = chatTransactionValues(activeDraft.data().parsed, accounts, budgets, jakartaTime())
        if (prepared.error) return finish(ref, 'handled', prepared.error)
        try {
          await recordDraft(uid, targetDraftId, prepared.values)
        } catch (error) {
          if (error instanceof DraftActionError && error.status < 500) return finish(ref, 'handled', error.message)
          throw error
        }
        return finish(ref, 'handled', `Transaksi ${activeDraft.data().parsed.title} sebesar Rp${new Intl.NumberFormat('id-ID').format(activeDraft.data().parsed.amount)} berhasil dicatat di FinanceMy.`)
      }
      if (command.kind === 'revise') {
        if (!command.text) return finish(ref, 'handled', 'Tulis perubahannya setelah REVISI. Contoh: REVISI nominal 30000 atau REVISI akun BCA.')
        const parsed = simpleRevision(activeDraft.data().parsed, command.text)
          || await reviseWithKenari(activeDraft.data().parsed, command.text)
        const { accounts, budgets } = await choices(uid)
        const reply = draftConfirmation(parsed, accounts, budgets)
        await adminDb.runTransaction(async (transaction) => {
          const current = await transaction.get(draftRef)
          if (current.data()?.status !== 'draft') throw new DraftActionError(409, 'Draf sudah selesai.')
          transaction.update(draftRef, { parsed, reply, updatedAt: FieldValue.serverTimestamp() })
        })
        return finish(ref, 'handled', reply)
      }

      const intent = await parseWithKenari(message.text)
      if (intent.kind === 'finance_query') {
        const data = await financeData(uid, intent.plan)
        return finish(ref, 'handled', answerFinanceQuery(intent.plan, data, jakartaDate()))
      }
      if (intent.kind === 'unsupported') {
        const draftReminder = activeStatus === 'draft' ? ' Draf transaksimu masih tersimpan; balas SUBMIT, REVISI, atau BATAL untuk melanjutkan.' : ''
        return finish(ref, 'handled', `Aku dapat membantu mencatat transaksi dan menjawab data FinanceMy seperti saldo, budget, utang, piutang, cicilan, transaksi rutin, riwayat transaksi, dan target keuangan.${draftReminder}`)
      }
      if (activeStatus === 'draft') {
        return finish(ref, 'handled', 'Masih ada draf yang menunggu keputusan. Balas SUBMIT, REVISI diikuti perubahan, atau BATAL sebelum mengirim transaksi baru.')
      }

      const draft = intent.draft
      const { accounts, budgets } = await choices(uid)
      const reply = draftConfirmation(draft.parsed, accounts, budgets)
      await adminDb.runTransaction(async (transaction) => {
        await transaction.get(activeRef)
        transaction.update(ref, { status: 'draft', parsed: draft.parsed, reply, leaseUntil: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() })
        transaction.set(activeRef, { draftId: ref.id, updatedAt: FieldValue.serverTimestamp() })
      })
      return response(200, { status: 'draft', reply })
    } catch (error) {
      if (error instanceof DraftActionError && error.status < 500) return finish(ref, 'handled', error.message)
      console.error('Gagal memproses pesan WhatsApp:', error.message)
      await ref.update({ status: 'received', leaseUntil: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() })
      return response(503, { error: 'Pemrosesan AI belum tersedia. Pesan akan dicoba lagi.' })
    }
  } catch (error) {
    console.error('Gagal menyimpan pesan WhatsApp:', error.message)
    return response(500, { error: 'Pesan WhatsApp belum dapat disimpan.' })
  }
}
