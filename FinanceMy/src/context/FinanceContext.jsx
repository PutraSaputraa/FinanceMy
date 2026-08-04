import { createContext, useContext, useEffect, useState } from 'react'
import { demoAccounts, demoBudgets, demoDebtRecords, demoGoals, demoTransactions, upcomingBills } from '../constants/demoData'
import { useAuth } from './AuthContext'
import { addAccount, addBudget, addUserRecord, createTransaction, markBillPaid, subscribeCollection } from '../services/financeService'

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
    recurringTransactions: upcomingBills.map((bill) => ({ ...bill, name: bill.title, nextDate: bill.date, frequency: 'Bulanan', type: bill.title === 'Netflix' ? 'Langganan' : 'Tagihan' })),
    goals: demoGoals,
    debts: demoDebtRecords.utang,
    receivables: demoDebtRecords.piutang,
    installments: demoDebtRecords.cicilan,
  }
}

export function FinanceProvider({ children }) {
  const { user } = useAuth()
  const [firebaseData, setFirebaseData] = useState(() => emptyFirebaseData())
  const [demoData, setDemoData] = useState(initialDemoData)
  const [toast, setToast] = useState(null)
  const isDemo = Boolean(user?.isDemo)
  const ownsFirebaseData = Boolean(user && !isDemo && firebaseData.ownerUid === user.uid)
  const activeData = isDemo ? demoData : ownsFirebaseData ? firebaseData : emptyFirebaseData()
  const loading = Boolean(user && !isDemo && (!ownsFirebaseData || collectionKeys.some((key) => !firebaseData.loaded[key])))
  const error = ownsFirebaseData ? firebaseData.error : null

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
        date: item.transactionDate?.toDate ? item.transactionDate.toDate().toISOString().slice(0, 10) : item.date,
        account: item.accountName || 'Akun',
        category: item.categoryName || item.category || 'Lainnya',
      }))), 'createdAt', fail('transactions')),
      subscribeCollection(userId, 'budgets', (data) => update('budgets', data.map((item) => ({ ...item, spent: item.spent || 0, color: item.color || '#087f5b' }))), undefined, fail('budgets')),
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
    if (user && !user.isDemo) {
      const source = activeData.accounts.find((account) => account.name === values.account)
      const destination = activeData.accounts.find((account) => account.name === values.destinationAccount)
      await createTransaction(user.uid, {
        ...values,
        accountId: source?.id,
        accountName: source?.name,
        destinationAccountId: destination?.id || null,
        destinationAccountName: destination?.name || null,
        categoryName: values.category,
        transactionDate: new Date(`${values.date}T${values.time || '12:00'}`),
        idempotencyKey: crypto.randomUUID(),
      })
      notify('Transaksi berhasil ditambahkan')
      return
    }
    const transaction = { ...values, id: crypto.randomUUID(), amount: Number(values.amount), date: values.date || new Date().toISOString().slice(0, 10) }
    setDemoData((current) => ({
      ...current,
      transactions: [transaction, ...current.transactions],
      accounts: current.accounts.map((account) => {
        if (account.name !== values.account && account.name !== values.destinationAccount) return account
        if (values.type === 'transfer') {
          if (account.name === values.account) return { ...account, currentBalance: account.currentBalance - transaction.amount - Number(values.adminFee || 0) }
          return { ...account, currentBalance: account.currentBalance + transaction.amount }
        }
        const delta = values.type === 'income' || values.type === 'refund' ? transaction.amount : -transaction.amount
        return { ...account, currentBalance: account.currentBalance + delta }
      }),
    }))
    notify('Transaksi berhasil ditambahkan')
  }

  const addDemoAccount = async (values) => {
    if (user && !user.isDemo) await addAccount(user.uid, values)
    else setDemoData((current) => ({ ...current, accounts: [...current.accounts, { ...values, id: crypto.randomUUID(), currentBalance: Number(values.initialBalance), initialBalance: Number(values.initialBalance), isActive: true }] }))
    notify('Akun berhasil dibuat')
  }

  const addDemoBudget = async (values) => {
    if (user && !user.isDemo) await addBudget(user.uid, values)
    else setDemoData((current) => ({ ...current, budgets: [...current.budgets, { ...values, id: crypto.randomUUID(), amount: Number(values.amount), spent: 0 }] }))
    notify('Budget berhasil dibuat')
  }

  const addRecurring = async (values) => {
    const record = { ...values, amount: Number(values.amount || 0), isActive: true }
    if (user && !user.isDemo) await addUserRecord(user.uid, 'recurringTransactions', record)
    else setDemoData((current) => ({ ...current, recurringTransactions: [...current.recurringTransactions, { ...record, id: crypto.randomUUID() }] }))
    notify('Transaksi rutin berhasil dibuat')
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
    loading,
    error,
    isDemo,
    toast,
    notify,
    addDemoTransaction,
    addDemoAccount,
    addDemoBudget,
    addRecurring,
    addGoal,
    addDebtRecord,
    payBill,
  }
  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>
}

export const useFinance = () => useContext(FinanceContext)
