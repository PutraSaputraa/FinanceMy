import { addDoc, collection, deleteDoc, deleteField, doc, getDoc, onSnapshot, orderBy, query, runTransaction, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { budgetMonthKey, budgetPeriodKey } from '../utils/budgets'
import { buildRecurringPayment, recurringDueDate } from '../utils/recurring'
import { balanceChanges, transactionEffects } from '../utils/transactionBalances'

export function subscribeCollection(userId, collectionName, callback, sortField, onError) {
  const ref = collection(db, 'users', userId, collectionName)
  const q = sortField ? query(ref, orderBy(sortField, 'desc')) : ref
  return onSnapshot(q, (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), onError)
}

export async function addAccount(userId, values) {
  const balance = Number(values.initialBalance || 0)
  return addDoc(collection(db, 'users', userId, 'accounts'), {
    ...values, initialBalance: balance, currentBalance: balance, isActive: true,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  })
}

export async function setAccountActive(userId, accountId, isActive) {
  return updateDoc(doc(db, 'users', userId, 'accounts', accountId), {
    isActive,
    updatedAt: serverTimestamp(),
  })
}

export async function addBudget(userId, values) {
  return addDoc(collection(db, 'users', userId, 'budgets'), {
    ...values, amount: Number(values.amount), periodKey: budgetMonthKey(), trackingMode: 'manual', warningThreshold: 80, isActive: true,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  })
}

export async function deleteBudget(userId, budgetId) {
  return deleteDoc(doc(db, 'users', userId, 'budgets', budgetId))
}

export async function updateRecurring(userId, recurringId, values) {
  return updateDoc(doc(db, 'users', userId, 'recurringTransactions', recurringId), {
    ...values,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteRecurring(userId, recurringId) {
  return deleteDoc(doc(db, 'users', userId, 'recurringTransactions', recurringId))
}

export async function payRecurring(userId, recurringId, expectedDueDate, accountId, amount, budgetId = null) {
  const recurringRef = doc(db, 'users', userId, 'recurringTransactions', recurringId)
  const accountRef = doc(db, 'users', userId, 'accounts', accountId)
  const budgetRef = budgetId ? doc(db, 'users', userId, 'budgets', budgetId) : null
  const transactionRef = doc(db, 'users', userId, 'transactions', `recurring_${recurringId}_${expectedDueDate}`)
  const paidAt = new Date()
  return runTransaction(db, async (transaction) => {
    const recurringSnapshot = await transaction.get(recurringRef)
    const accountSnapshot = await transaction.get(accountRef)
    const existingPayment = await transaction.get(transactionRef)
    const budgetSnapshot = budgetRef ? await transaction.get(budgetRef) : null
    if (!recurringSnapshot.exists() || recurringSnapshot.data().isActive === false) throw new Error('Jadwal rutin tidak ditemukan atau sudah berhenti.')
    if (!accountSnapshot.exists()) throw new Error('Akun pembayaran tidak ditemukan.')
    if (recurringDueDate(recurringSnapshot.data()) !== expectedDueDate || existingPayment.exists()) {
      throw new Error('Periode ini sudah dibayar atau jadwalnya berubah. Muat ulang halaman.')
    }
    if (budgetRef && (!budgetSnapshot.exists() || budgetSnapshot.data().isActive === false || budgetPeriodKey(budgetSnapshot.data(), paidAt) !== budgetMonthKey(paidAt))) {
      throw new Error('Budget tidak tersedia untuk bulan pembayaran ini.')
    }
    const account = { id: accountId, ...accountSnapshot.data() }
    const payment = buildRecurringPayment(recurringId, recurringSnapshot.data(), account, amount, paidAt, budgetId)
    if (payment.transaction.type !== 'expense' && budgetId) throw new Error('Pemasukan rutin tidak menggunakan budget.')
    const delta = payment.transaction.type === 'income' ? payment.transaction.amount : -payment.transaction.amount
    transaction.update(accountRef, { currentBalance: Number(account.currentBalance) + delta, updatedAt: serverTimestamp() })
    transaction.set(transactionRef, { ...payment.transaction, transactionDate: Timestamp.fromDate(payment.transaction.transactionDate), createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
    transaction.update(recurringRef, { nextDate: payment.nextDate, lastPaidDate: payment.transaction.date, updatedAt: serverTimestamp() })
    return payment
  })
}

export async function reconcileAccount(userId, accountId, actualBalance) {
  const accountRef = doc(db, 'users', userId, 'accounts', accountId)
  const transactionRef = doc(collection(db, 'users', userId, 'transactions'))
  return runTransaction(db, async (transaction) => {
    const accountSnapshot = await transaction.get(accountRef)
    if (!accountSnapshot.exists()) throw new Error('Akun tidak ditemukan.')
    const account = accountSnapshot.data()
    if (account.isActive === false) throw new Error('Akun sudah nonaktif.')
    const previousBalance = Number(account.currentBalance)
    const difference = actualBalance - previousBalance
    if (difference === 0) return false
    transaction.update(accountRef, { currentBalance: actualBalance, updatedAt: serverTimestamp() })
    transaction.set(transactionRef, {
      title: `Penyesuaian saldo ${account.name}`,
      type: 'adjustment',
      amount: Math.abs(difference),
      adjustmentDelta: difference,
      balanceBefore: previousBalance,
      balanceAfter: actualBalance,
      accountId,
      accountName: account.name,
      categoryName: 'Penyesuaian saldo',
      transactionDate: Timestamp.fromDate(new Date()),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return true
  })
}

export async function addUserRecord(userId, collectionName, values) {
  return addDoc(collection(db, 'users', userId, collectionName), {
    ...values,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function updateGoal(userId, goalId, values) {
  return updateDoc(doc(db, 'users', userId, 'goals', goalId), {
    ...values,
    saved: deleteField(),
    updatedAt: serverTimestamp(),
  })
}

export async function deleteGoal(userId, goalId) {
  return deleteDoc(doc(db, 'users', userId, 'goals', goalId))
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
  const budgetRef = values.budgetId ? doc(db, 'users', userId, 'budgets', values.budgetId) : null
  const amount = Number(values.amount)
  const adminFee = Number(values.adminFee || 0)

  return runTransaction(db, async (transaction) => {
    const sourceSnapshot = await transaction.get(sourceRef)
    if (!sourceSnapshot.exists()) throw new Error('Akun sumber tidak ditemukan.')
    const source = sourceSnapshot.data()
    let destinationSnapshot
    if (destinationRef) destinationSnapshot = await transaction.get(destinationRef)
    const budgetSnapshot = budgetRef ? await transaction.get(budgetRef) : null
    if (budgetRef && (!budgetSnapshot.exists() || budgetSnapshot.data().isActive === false || budgetPeriodKey(budgetSnapshot.data(), values.transactionDate) !== budgetMonthKey(values.transactionDate))) {
      throw new Error('Budget tidak tersedia untuk bulan transaksi ini.')
    }
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

async function changeTransaction(userId, transactionId, values) {
  const transactionRef = doc(db, 'users', userId, 'transactions', transactionId)
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(transactionRef)
    if (!snapshot.exists()) throw new Error('Transaksi tidak ditemukan.')
    const previous = snapshot.data()
    if (values && previous.type === 'adjustment') throw new Error('Penyesuaian saldo hanya dapat dihapus.')

    const next = values ? {
      ...previous,
      ...values,
      amount: Number(values.amount),
      adminFee: Number(values.adminFee || 0),
      transactionDate: Timestamp.fromDate(values.transactionDate),
      updatedAt: serverTimestamp(),
    } : null
    if (next?.budgetId) {
      const budgetSnapshot = await transaction.get(doc(db, 'users', userId, 'budgets', next.budgetId))
      if (!budgetSnapshot.exists() || budgetSnapshot.data().isActive === false || budgetPeriodKey(budgetSnapshot.data(), values.transactionDate) !== budgetMonthKey(values.transactionDate)) {
        throw new Error('Budget tidak tersedia untuk bulan transaksi ini.')
      }
    }
    const changes = balanceChanges(previous, next)
    const nextAccountIds = new Set(transactionEffects(next).map((effect) => effect.accountId))
    const accounts = []
    for (const change of changes) {
      if (!change.accountId) throw new Error('Akun pada transaksi lama tidak dapat ditemukan.')
      const accountRef = doc(db, 'users', userId, 'accounts', change.accountId)
      const accountSnapshot = await transaction.get(accountRef)
      if (!accountSnapshot.exists()) {
        if (nextAccountIds.has(change.accountId)) throw new Error('Akun pada transaksi tidak ditemukan.')
        continue
      }
      accounts.push({ accountRef, balance: Number(accountSnapshot.data().currentBalance) + change.delta })
    }
    for (const { accountRef, balance } of accounts) {
      transaction.update(accountRef, { currentBalance: balance, updatedAt: serverTimestamp() })
    }
    if (next) transaction.update(transactionRef, next)
    else transaction.delete(transactionRef)
  })
}

export async function updateTransaction(userId, transactionId, values) {
  return changeTransaction(userId, transactionId, values)
}

export async function deleteTransaction(userId, transactionId) {
  return changeTransaction(userId, transactionId, null)
}

export async function markBillPaid(userId, billId, accountId) {
  const billRef = doc(db, 'users', userId, 'bills', billId)
  const bill = await getDoc(billRef)
  if (!bill.exists()) throw new Error('Tagihan tidak ditemukan.')
  const occurrenceKey = `${billId}_${bill.data().dueDate.toDate().toISOString().slice(0, 7)}`
  return createTransaction(userId, { type: 'expense', title: bill.data().name, amount: bill.data().amount, accountId, accountName: bill.data().accountName || 'Akun', categoryId: bill.data().categoryId || null, categoryName: bill.data().categoryName || 'Tagihan', budgetId: null, billId, occurrenceKey, transactionDate: new Date() })
}
