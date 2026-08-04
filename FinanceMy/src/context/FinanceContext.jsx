import { createContext, useContext, useEffect, useState } from 'react'
import { demoAccounts, demoBudgets, demoTransactions, upcomingBills } from '../constants/demoData'
import { useAuth } from './AuthContext'
import { addAccount, addBudget, createTransaction, markBillPaid, subscribeCollection } from '../services/financeService'

const FinanceContext = createContext(null)

export function FinanceProvider({ children }) {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState(demoAccounts)
  const [transactions, setTransactions] = useState(demoTransactions)
  const [budgets, setBudgets] = useState(demoBudgets)
  const [bills, setBills] = useState(upcomingBills)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (!user || user.isDemo) return undefined
    const unsubscribers = [
      subscribeCollection(user.uid, 'accounts', setAccounts),
      subscribeCollection(user.uid, 'transactions', (data) => setTransactions(data.map((item) => ({
        ...item,
        date: item.transactionDate?.toDate ? item.transactionDate.toDate().toISOString().slice(0, 10) : item.date,
        account: item.accountName || 'Akun',
        category: item.categoryName || item.category || 'Lainnya',
      }))), 'createdAt'),
      subscribeCollection(user.uid, 'budgets', (data) => setBudgets(data.map((item) => ({ ...item, spent: item.spent || 0, color: item.color || '#087f5b' })))),
      subscribeCollection(user.uid, 'bills', setBills, 'dueDate'),
    ]
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
  }, [user])

  const notify = (message, tone = 'success') => { setToast({ message, tone }); window.setTimeout(() => setToast(null), 3000) }

  const addDemoTransaction = async (values) => {
    if (user && !user.isDemo) {
      const source = accounts.find((account) => account.name === values.account)
      const destination = accounts.find((account) => account.name === values.destinationAccount)
      await createTransaction(user.uid, {
        ...values, accountId: source?.id, accountName: source?.name,
        destinationAccountId: destination?.id || null, destinationAccountName: destination?.name || null,
        categoryName: values.category,
        transactionDate: new Date(`${values.date}T${values.time || '12:00'}`),
        idempotencyKey: crypto.randomUUID(),
      })
      notify('Transaksi berhasil ditambahkan')
      return
    }
    const tx = { ...values, id: crypto.randomUUID(), amount: Number(values.amount), date: values.date || new Date().toISOString().slice(0, 10) }
    setTransactions((current) => [tx, ...current])
    setAccounts((current) => current.map((account) => {
      if (account.name !== values.account && account.name !== values.destinationAccount) return account
      if (values.type === 'transfer') {
        if (account.name === values.account) return { ...account, currentBalance: account.currentBalance - tx.amount - Number(values.adminFee || 0) }
        return { ...account, currentBalance: account.currentBalance + tx.amount }
      }
      const delta = values.type === 'income' || values.type === 'refund' ? tx.amount : -tx.amount
      return { ...account, currentBalance: account.currentBalance + delta }
    }))
    notify('Transaksi berhasil ditambahkan')
  }

  const addDemoAccount = async (values) => {
    if (user && !user.isDemo) await addAccount(user.uid, values)
    else setAccounts((current) => [...current, { ...values, id: crypto.randomUUID(), currentBalance: Number(values.initialBalance), initialBalance: Number(values.initialBalance), isActive: true }])
    notify('Akun berhasil dibuat')
  }

  const addDemoBudget = async (values) => {
    if (user && !user.isDemo) await addBudget(user.uid, values)
    else setBudgets((current) => [...current, { ...values, id: crypto.randomUUID(), amount: Number(values.amount), spent: 0 }])
    notify('Budget berhasil dibuat')
  }

  const payBill = async (id) => {
    if (user && !user.isDemo) {
      const bill = bills.find((item) => item.id === id)
      await markBillPaid(user.uid, id, bill.accountId)
    } else setBills((current) => current.map((bill) => bill.id === id ? { ...bill, status: 'Sudah dibayar', tone: 'success' } : bill))
    notify('Tagihan berhasil dibayar')
  }

  const value = { accounts, transactions, budgets, bills, toast, notify, addDemoTransaction, addDemoAccount, addDemoBudget, payBill }
  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>
}

export const useFinance = () => useContext(FinanceContext)
