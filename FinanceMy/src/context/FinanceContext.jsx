import { createContext, useContext, useEffect, useState } from 'react'
import { addDays, format } from 'date-fns'
import { demoAccounts, demoBudgets, demoDebtRecords, demoGoals, demoTransactions, upcomingBills } from '../constants/demoData'
import { useAuth } from './AuthContext'
import { addAccount, addBudget, addUserRecord, createTransaction, deleteBudget, deleteRecurring as deleteRecurringRecord, deleteTransaction, markBillPaid, payRecurring as payRecurringRecord, reconcileAccount, setAccountActive, subscribeCollection, updateRecurring as saveRecurringRecord, updateTransaction } from '../services/financeService'
import { budgetMonthKey, monthlyBudgets } from '../utils/budgets'
import { buildRecurringPayment, recurringCategory, recurringDateKey, recurringDueDate } from '../utils/recurring'
import { balanceChanges } from '../utils/transactionBalances'

const FinanceContext = createContext(null)
const collectionKeys = ['accounts', 'transactions', 'budgets', 'bills', 'recurringTransactions', 'goals', 'debts', 'receivables', 'installments']

function emptyFirebaseData(ownerUid = null) {
  return {
    ownerUid,
    accounts: [],
    transactions: [],
    budgets: [],
    bills: [],
    recurringTransactions: [],
    goals: [],
    debts: [],
    receivables: [],
    installments: [],
    loaded: {},
    error: null,
  }
}

function initialDemoData() {
  return {
    accounts: demoAccounts,
    transactions: demoTransactions,
    budgets: demoBudgets,
    bills: upcomingBills,
    recurringTransactions: upcomingBills.map((bill, index) => ({ ...bill, name: bill.title, nextDate: format(addDays(new Date(), [3, 7, 10][index]), 'yyyy-MM-dd'), frequency: 'Bulanan', type: bill.title === 'Netflix' ? 'Langganan' : 'Tagihan' })),
    goals: demoGoals,
    debts: demoDebtRecords.utang,
    receivables: demoDebtRecords.piutang,
    installments: demoDebtRecords.cicilan,
  }
}

function transactionValues(values, accounts) {
  const source = accounts.find((account) => account.id === values.accountId || account.name === values.account)
  const destination = values.type === 'transfer'
    ? accounts.find((account) => account.id === values.destinationAccountId || account.name === values.destinationAccount)
    : null
  if (!source) throw new Error('Akun transaksi tidak ditemukan.')
  if (values.type === 'transfer' && !destination) throw new Error('Akun tujuan tidak ditemukan.')
  if (destination?.id === source.id) throw new Error('Akun sumber dan tujuan harus berbeda.')
  const amount = Number(values.amount)
  const adminFee = values.type === 'transfer' ? Number(values.adminFee || 0) : 0
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Nominal harus lebih dari nol.')
  if (!Number.isFinite(adminFee) || adminFee < 0) throw new Error('Biaya admin tidak valid.')
  const transactionDate = new Date(`${values.date}T${values.time || '12:00'}`)
  if (Number.isNaN(transactionDate.getTime())) throw new Error('Tanggal transaksi tidak valid.')
  return {
    ...values, amount, adminFee, accountId: source.id, accountName: source.name, account: source.name,
    destinationAccountId: destination?.id || null,
    destinationAccountName: destination?.name || null,
    destinationAccount: destination?.name || null,
    categoryName: values.category,
    transactionDate,
  }
}

function applyDemoBalanceChanges(accounts, changes) {
  return accounts.map((account) => ({
    ...account,
    currentBalance: Number(account.currentBalance) + changes
      .filter((change) => change.accountId === account.id || (!change.accountId && change.accountName === account.name))
      .reduce((total, change) => total + change.delta, 0),
  }))
}

export function FinanceProvider({ children }) {
  const { user } = useAuth()
  const [firebaseData, setFirebaseData] = useState(() => emptyFirebaseData())
  const [demoData, setDemoData] = useState(initialDemoData)
  const [toast, setToast] = useState(null)
  const [today, setToday] = useState(() => new Date())
  const isDemo = Boolean(user?.isDemo)
  const ownsFirebaseData = Boolean(user && !isDemo && firebaseData.ownerUid === user.uid)
  const activeData = isDemo ? demoData : ownsFirebaseData ? firebaseData : emptyFirebaseData()
  const loading = Boolean(user && !isDemo && (!ownsFirebaseData || collectionKeys.some((key) => !firebaseData.loaded[key])))
  const error = ownsFirebaseData ? firebaseData.error : null

  useEffect(() => {
    const now = new Date()
    const nextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    const timer = window.setTimeout(() => setToday(new Date()), nextDay.getTime() - now.getTime() + 1000)
    return () => window.clearTimeout(timer)
  }, [today])

  useEffect(() => {
    if (!user || user.isDemo) return undefined
    const userId = user.uid
    const update = (key, data) => setFirebaseData((current) => {
      const base = current.ownerUid === userId ? current : emptyFirebaseData(userId)
      return { ...base, [key]: data, loaded: { ...base.loaded, [key]: true } }
    })
    const fail = (key) => (firestoreError) => setFirebaseData((current) => {
      const base = current.ownerUid === userId ? current : emptyFirebaseData(userId)
      return { ...base, error: firestoreError, loaded: { ...base.loaded, [key]: true } }
    })
    const unsubscribers = [
      subscribeCollection(userId, 'accounts', (data) => update('accounts', data), undefined, fail('accounts')),
      subscribeCollection(userId, 'transactions', (data) => update('transactions', data.map((item) => ({
        ...item,
        date: item.transactionDate?.toDate ? format(item.transactionDate.toDate(), 'yyyy-MM-dd') : item.date || (item.createdAt?.toDate ? format(item.createdAt.toDate(), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')),
        account: item.accountName || 'Akun',
        category: item.categoryName || item.category || 'Lainnya',
      }))), 'createdAt', fail('transactions')),
      subscribeCollection(userId, 'budgets', (data) => update('budgets', data.map((item) => ({ ...item, color: item.color || '#087f5b' }))), undefined, fail('budgets')),
      subscribeCollection(userId, 'bills', (data) => update('bills', data.map((item) => ({
        ...item,
        title: item.title || item.name,
        account: item.accountName || item.account || 'Akun',
        date: item.dueDate?.toDate ? item.dueDate.toDate().toISOString().slice(0, 10) : item.date,
      }))), 'dueDate', fail('bills')),
      subscribeCollection(userId, 'recurringTransactions', (data) => update('recurringTransactions', data), undefined, fail('recurringTransactions')),
      subscribeCollection(userId, 'goals', (data) => update('goals', data), undefined, fail('goals')),
      subscribeCollection(userId, 'debts', (data) => update('debts', data), undefined, fail('debts')),
      subscribeCollection(userId, 'receivables', (data) => update('receivables', data), undefined, fail('receivables')),
      subscribeCollection(userId, 'installments', (data) => update('installments', data), undefined, fail('installments')),
    ]
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
  }, [user])

  const notify = (message, tone = 'success') => {
    setToast({ message, tone })
    window.setTimeout(() => setToast(null), 3000)
  }

  const addDemoTransaction = async (values) => {
    const record = transactionValues(values, activeData.accounts)
    if (user && !user.isDemo) {
      await createTransaction(user.uid, {
        ...record,
        idempotencyKey: crypto.randomUUID(),
      })
      notify('Transaksi berhasil ditambahkan')
      return
    }
    const transaction = { ...record, id: crypto.randomUUID() }
    setDemoData((current) => ({
      ...current,
      transactions: [transaction, ...current.transactions],
      accounts: applyDemoBalanceChanges(current.accounts, balanceChanges(null, transaction)),
    }))
    notify('Transaksi berhasil ditambahkan')
  }

  const editTransaction = async (transactionId, values) => {
    const previous = activeData.transactions.find((item) => item.id === transactionId)
    if (!previous) throw new Error('Transaksi tidak ditemukan.')
    if (previous.type === 'adjustment') throw new Error('Penyesuaian saldo hanya dapat dihapus.')
    const record = transactionValues(values, activeData.accounts)
    if (user && !user.isDemo) await updateTransaction(user.uid, transactionId, record)
    else {
      const next = { ...previous, ...record }
      const changes = balanceChanges(previous, next)
      setDemoData((current) => ({
        ...current,
        transactions: current.transactions.map((item) => item.id === transactionId ? next : item),
        accounts: applyDemoBalanceChanges(current.accounts, changes),
      }))
    }
    notify('Transaksi berhasil diperbarui')
  }

  const removeTransaction = async (transactionId) => {
    const previous = activeData.transactions.find((item) => item.id === transactionId)
    if (!previous) throw new Error('Transaksi tidak ditemukan.')
    if (user && !user.isDemo) await deleteTransaction(user.uid, transactionId)
    else {
      const changes = balanceChanges(previous, null)
      setDemoData((current) => ({
        ...current,
        transactions: current.transactions.filter((item) => item.id !== transactionId),
        accounts: applyDemoBalanceChanges(current.accounts, changes),
      }))
    }
    notify('Transaksi berhasil dihapus')
  }

  const addDemoAccount = async (values) => {
    if (user && !user.isDemo) await addAccount(user.uid, values)
    else setDemoData((current) => ({ ...current, accounts: [...current.accounts, { ...values, id: crypto.randomUUID(), currentBalance: Number(values.initialBalance), initialBalance: Number(values.initialBalance), isActive: true }] }))
    notify('Akun berhasil dibuat')
  }

  const addDemoBudget = async (values) => {
    if (user && !user.isDemo) await addBudget(user.uid, values)
    else setDemoData((current) => ({ ...current, budgets: [...current.budgets, { ...values, id: crypto.randomUUID(), amount: Number(values.amount), periodKey: budgetMonthKey() }] }))
    notify('Budget berhasil dibuat')
  }

  const removeBudget = async (budgetId) => {
    if (user && !user.isDemo) await deleteBudget(user.uid, budgetId)
    else setDemoData((current) => ({ ...current, budgets: current.budgets.filter((budget) => budget.id !== budgetId) }))
    notify('Budget berhasil dihapus')
  }

  const reconcileBalance = async (accountId, actualBalance) => {
    const balance = Number(actualBalance)
    if (!Number.isFinite(balance) || balance < 0) throw new Error('Saldo nyata harus berupa angka nol atau lebih.')
    if (user && !user.isDemo) {
      const adjusted = await reconcileAccount(user.uid, accountId, balance)
      if (adjusted) notify('Saldo berhasil direkonsiliasi')
      return adjusted
    }
    const account = demoData.accounts.find((item) => item.id === accountId)
    if (!account) throw new Error('Akun tidak ditemukan.')
    const difference = balance - Number(account.currentBalance)
    if (difference === 0) return false
    const now = new Date()
    setDemoData((current) => ({
      ...current,
      accounts: current.accounts.map((item) => item.id === accountId ? { ...item, currentBalance: balance } : item),
      transactions: [{
        id: crypto.randomUUID(), title: `Penyesuaian saldo ${account.name}`, type: 'adjustment',
        amount: Math.abs(difference), adjustmentDelta: difference, accountId, account: account.name,
        category: 'Penyesuaian saldo', date: format(now, 'yyyy-MM-dd'),
      }, ...current.transactions],
    }))
    notify('Saldo berhasil direkonsiliasi')
    return true
  }

  const toggleAccountActive = async (accountId, isActive) => {
    if (user && !user.isDemo) await setAccountActive(user.uid, accountId, isActive)
    else setDemoData((current) => ({
      ...current,
      accounts: current.accounts.map((account) => account.id === accountId ? { ...account, isActive } : account),
    }))
    notify(isActive ? 'Akun berhasil diaktifkan kembali' : 'Akun berhasil dinonaktifkan')
  }

  const recurringValues = (values, previous = null) => {
    const account = activeData.accounts.find((item) => item.id === values.accountId && item.isActive !== false)
    const amount = Number(values.amount)
    const nextDate = recurringDateKey(values.nextDate)
    if (!values.name?.trim()) throw new Error('Nama transaksi rutin wajib diisi.')
    if (!['Langganan', 'Tagihan', 'Cicilan', 'Pemasukan rutin'].includes(values.type)) throw new Error('Jenis transaksi rutin tidak valid.')
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Nominal harus lebih dari nol.')
    if (!account) throw new Error('Pilih akun yang masih aktif.')
    if (!nextDate) throw new Error('Tanggal berikutnya tidak valid.')
    if (!['Mingguan', 'Bulanan', 'Tahunan'].includes(values.frequency)) throw new Error('Frekuensi tidak valid.')
    const scheduleChanged = !previous || recurringDueDate(previous) !== nextDate || (previous.frequency || 'Bulanan') !== values.frequency
    return {
      name: values.name.trim(), type: values.type, amount, frequency: values.frequency,
      nextDate, anchorDate: scheduleChanged ? nextDate : previous.anchorDate || nextDate,
      accountId: account.id, accountName: account.name,
      categoryName: recurringCategory(values.type, values.categoryName),
    }
  }

  const addRecurring = async (values) => {
    const record = { ...recurringValues(values), isActive: true }
    if (user && !user.isDemo) await addUserRecord(user.uid, 'recurringTransactions', record)
    else setDemoData((current) => ({ ...current, recurringTransactions: [...current.recurringTransactions, { ...record, id: crypto.randomUUID() }] }))
    notify('Transaksi rutin berhasil dibuat')
  }

  const editRecurring = async (recurringId, values) => {
    const previous = activeData.recurringTransactions.find((item) => item.id === recurringId)
    if (!previous) throw new Error('Transaksi rutin tidak ditemukan.')
    const record = recurringValues(values, previous)
    if (user && !user.isDemo) await saveRecurringRecord(user.uid, recurringId, record)
    else setDemoData((current) => ({ ...current, recurringTransactions: current.recurringTransactions.map((item) => item.id === recurringId ? { ...item, ...record } : item) }))
    notify('Transaksi rutin berhasil diperbarui')
  }

  const removeRecurring = async (recurringId) => {
    if (user && !user.isDemo) await deleteRecurringRecord(user.uid, recurringId)
    else setDemoData((current) => ({ ...current, recurringTransactions: current.recurringTransactions.filter((item) => item.id !== recurringId) }))
    notify('Jadwal rutin dihentikan')
  }

  const recordRecurringPayment = async (recurringId, expectedDueDate, accountId, amount) => {
    const item = activeData.recurringTransactions.find((entry) => entry.id === recurringId)
    if (!item || item.isActive === false) throw new Error('Jadwal rutin tidak ditemukan atau sudah berhenti.')
    if (recurringDueDate(item) !== expectedDueDate) throw new Error('Jadwal telah berubah. Muat ulang halaman.')
    if (user && !user.isDemo) await payRecurringRecord(user.uid, recurringId, expectedDueDate, accountId, Number(amount))
    else {
      const account = activeData.accounts.find((entry) => entry.id === accountId)
      const payment = buildRecurringPayment(recurringId, item, account, amount)
      const transaction = { ...payment.transaction, id: crypto.randomUUID() }
      setDemoData((current) => ({
        ...current,
        recurringTransactions: current.recurringTransactions.map((entry) => entry.id === recurringId ? { ...entry, nextDate: payment.nextDate, lastPaidDate: transaction.date } : entry),
        transactions: [transaction, ...current.transactions],
        accounts: applyDemoBalanceChanges(current.accounts, balanceChanges(null, transaction)),
      }))
    }
    notify(item.type === 'Pemasukan rutin' ? 'Pemasukan rutin berhasil dicatat' : 'Pembayaran berhasil dicatat')
  }

  const addGoal = async (values) => {
    const record = { ...values, target: Number(values.target || 0), saved: Number(values.saved || 0), status: 'Aktif', color: values.color || '#087f5b' }
    if (user && !user.isDemo) await addUserRecord(user.uid, 'goals', record)
    else setDemoData((current) => ({ ...current, goals: [...current.goals, { ...record, id: crypto.randomUUID() }] }))
    notify('Target keuangan berhasil dibuat')
  }

  const addDebtRecord = async (kind, values) => {
    const collectionName = kind === 'piutang' ? 'receivables' : kind === 'cicilan' ? 'installments' : 'debts'
    const key = collectionName
    const record = { ...values, total: Number(values.total || 0), remaining: Number(values.remaining || values.total || 0), monthly: Number(values.monthly || 0), interest: Number(values.interest || 0), status: values.status || 'Aktif' }
    if (user && !user.isDemo) await addUserRecord(user.uid, collectionName, record)
    else setDemoData((current) => ({ ...current, [key]: [...current[key], { ...record, id: crypto.randomUUID() }] }))
    notify('Data berhasil ditambahkan')
  }

  const payBill = async (id) => {
    if (user && !user.isDemo) {
      const bill = activeData.bills.find((item) => item.id === id)
      await markBillPaid(user.uid, id, bill.accountId)
    } else setDemoData((current) => ({ ...current, bills: current.bills.map((bill) => bill.id === id ? { ...bill, status: 'Sudah dibayar', tone: 'success' } : bill) }))
    notify('Tagihan berhasil dibayar')
  }

  const value = {
    ...activeData,
    budgets: monthlyBudgets(activeData.budgets, activeData.transactions, today),
    loading,
    error,
    isDemo,
    toast,
    today,
    notify,
    addDemoTransaction,
    editTransaction,
    removeTransaction,
    addDemoAccount,
    addDemoBudget,
    removeBudget,
    reconcileBalance,
    toggleAccountActive,
    addRecurring,
    editRecurring,
    removeRecurring,
    recordRecurringPayment,
    addGoal,
    addDebtRecord,
    payBill,
  }
  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>
}

export const useFinance = () => useContext(FinanceContext)
