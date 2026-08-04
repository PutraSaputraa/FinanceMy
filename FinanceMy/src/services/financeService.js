import { addDoc, collection, doc, getDoc, onSnapshot, orderBy, query, runTransaction, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore'
import { db } from '../firebase/config'

export function subscribeCollection(userId, collectionName, callback, sortField) {
  const ref = collection(db, 'users', userId, collectionName)
  const q = sortField ? query(ref, orderBy(sortField, 'desc')) : ref
  return onSnapshot(q, (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))))
}

export async function addAccount(userId, values) {
  const balance = Number(values.initialBalance || 0)
  return addDoc(collection(db, 'users', userId, 'accounts'), {
    ...values, initialBalance: balance, currentBalance: balance, isActive: true,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  })
}

export async function addBudget(userId, values) {
  return addDoc(collection(db, 'users', userId, 'budgets'), {
    ...values, amount: Number(values.amount), warningThreshold: 80, isActive: true,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  })
}

export async function completeOnboarding(userId, values) {
  return updateDoc(doc(db, 'users', userId), {
    name: values.name,
    currency: values.currency,
    budgetStartDay: Number(values.budgetStartDay),
    onboardingCompleted: true,
    updatedAt: serverTimestamp(),
  })
}

export async function createTransaction(userId, values) {
  const transactionRef = doc(collection(db, 'users', userId, 'transactions'))
  const sourceRef = doc(db, 'users', userId, 'accounts', values.accountId)
  const destinationRef = values.destinationAccountId
    ? doc(db, 'users', userId, 'accounts', values.destinationAccountId) : null
  const amount = Number(values.amount)
  const adminFee = Number(values.adminFee || 0)

  return runTransaction(db, async (transaction) => {
    const sourceSnapshot = await transaction.get(sourceRef)
    if (!sourceSnapshot.exists()) throw new Error('Akun sumber tidak ditemukan.')
    const source = sourceSnapshot.data()
    let destinationSnapshot
    if (destinationRef) destinationSnapshot = await transaction.get(destinationRef)
    let delta = values.type === 'income' || values.type === 'refund' ? amount : -amount
    if (values.type === 'transfer') delta = -(amount + adminFee)
    if (!source.allowNegative && source.currentBalance + delta < 0) throw new Error('Saldo akun tidak mencukupi.')
    transaction.update(sourceRef, { currentBalance: source.currentBalance + delta, updatedAt: serverTimestamp() })
    if (values.type === 'transfer') {
      if (!destinationSnapshot?.exists()) throw new Error('Akun tujuan tidak ditemukan.')
      if (sourceRef.path === destinationRef.path) throw new Error('Akun sumber dan tujuan harus berbeda.')
      transaction.update(destinationRef, { currentBalance: destinationSnapshot.data().currentBalance + amount, updatedAt: serverTimestamp() })
    }
    transaction.set(transactionRef, {
      ...values, amount, adminFee,
      transactionDate: values.transactionDate instanceof Date ? Timestamp.fromDate(values.transactionDate) : values.transactionDate,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    })
  })
}

export async function markBillPaid(userId, billId, accountId) {
  const billRef = doc(db, 'users', userId, 'bills', billId)
  const bill = await getDoc(billRef)
  if (!bill.exists()) throw new Error('Tagihan tidak ditemukan.')
  const occurrenceKey = `${billId}_${bill.data().dueDate.toDate().toISOString().slice(0, 7)}`
  return createTransaction(userId, { type: 'expense', title: bill.data().name, amount: bill.data().amount, accountId, categoryId: bill.data().categoryId, billId, occurrenceKey })
}
