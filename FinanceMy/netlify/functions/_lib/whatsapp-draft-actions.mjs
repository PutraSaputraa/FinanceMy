import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { adminDb } from './firebase-admin.mjs'

export class DraftActionError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export async function dismissDraft(uid, draftId) {
  const ref = adminDb.doc(`users/${uid}/whatsappMessages/${draftId}`)
  const activeRef = adminDb.doc(`waActiveDrafts/${uid}`)
  await adminDb.runTransaction(async (transaction) => {
    const [snapshot, active] = await Promise.all([transaction.get(ref), transaction.get(activeRef)])
    if (!snapshot.exists) throw new DraftActionError(404, 'Draf tidak ditemukan.')
    if (snapshot.data().status === 'recorded') throw new DraftActionError(409, 'Transaksi ini sudah dicatat.')
    if (!['draft', 'dismissed'].includes(snapshot.data().status)) throw new DraftActionError(409, 'Draf tidak tersedia.')
    if (snapshot.data().status === 'draft') {
      transaction.update(ref, { status: 'dismissed', text: FieldValue.delete(), parsed: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() })
    }
    if (active.data()?.draftId === draftId) transaction.delete(activeRef)
  })
}

export async function recordDraft(uid, draftId, values) {
  const draftRef = adminDb.doc(`users/${uid}/whatsappMessages/${draftId}`)
  const accountRef = adminDb.doc(`users/${uid}/accounts/${values.accountId}`)
  const budgetRef = values.budgetId ? adminDb.doc(`users/${uid}/budgets/${values.budgetId}`) : null
  const transactionRef = adminDb.doc(`users/${uid}/transactions/wa_${draftId}`)
  const activeRef = adminDb.doc(`waActiveDrafts/${uid}`)
  await adminDb.runTransaction(async (transaction) => {
    const [draft, account, budget, existing, active] = await Promise.all([
      transaction.get(draftRef),
      transaction.get(accountRef),
      budgetRef ? transaction.get(budgetRef) : Promise.resolve(null),
      transaction.get(transactionRef),
      transaction.get(activeRef),
    ])
    if (!draft.exists) throw new DraftActionError(404, 'Draf tidak ditemukan.')
    if (draft.data().status === 'recorded' && existing.exists) {
      if (active.data()?.draftId === draftId) transaction.delete(activeRef)
      return
    }
    if (draft.data().status !== 'draft' || existing.exists) throw new DraftActionError(409, 'Draf sudah diproses.')
    if (!account.exists || account.data().isActive === false) throw new DraftActionError(400, 'Akun sumber dana tidak tersedia.')
    if (budgetRef) {
      const period = budget?.data()?.periodKey || budget?.data()?.createdAt?.toDate().toISOString().slice(0, 7)
      if (!budget?.exists || budget.data().isActive === false || period !== values.date.slice(0, 7)) {
        throw new DraftActionError(400, 'Budget tidak tersedia untuk bulan transaksi ini.')
      }
    }
    const balance = Number(account.data().currentBalance)
    if (!Number.isFinite(balance)) throw new DraftActionError(400, 'Saldo akun tidak valid.')
    const nextBalance = balance + (values.type === 'income' ? values.amount : -values.amount)
    if (account.data().allowNegative !== true && nextBalance < 0) throw new DraftActionError(400, 'Saldo akun tidak mencukupi.')
    transaction.update(accountRef, { currentBalance: nextBalance, updatedAt: FieldValue.serverTimestamp() })
    transaction.create(transactionRef, {
      title: values.title,
      type: values.type,
      amount: values.amount,
      accountId: values.accountId,
      accountName: account.data().name,
      account: account.data().name,
      category: values.category,
      categoryName: values.category,
      budgetId: values.budgetId,
      date: values.date,
      time: values.time,
      needType: values.type === 'expense' ? values.needType : null,
      note: values.note,
      adminFee: 0,
      transactionDate: Timestamp.fromDate(values.transactionDate),
      source: 'whatsapp',
      whatsappMessageId: draftId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    transaction.update(draftRef, { status: 'recorded', transactionId: transactionRef.id, updatedAt: FieldValue.serverTimestamp() })
    if (active.data()?.draftId === draftId) transaction.delete(activeRef)
  })
}
