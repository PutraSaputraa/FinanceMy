import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { format } from 'date-fns'
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight } from 'lucide-react'
import { useFinance } from '../../context/FinanceContext'

const incomeCategories = ['Gaji', 'Freelance', 'Bonus', 'Refund', 'Pemasukan lainnya']
const expenseCategories = ['Makan & Minum', 'Transportasi', 'Belanja', 'Kebutuhan Rumah', 'Tagihan', 'Langganan', 'Hiburan', 'Pengeluaran Lainnya']

export default function TransactionForm({ onDone, transaction }) {
  const [type, setType] = useState(transaction?.type || 'expense')
  const [submitError, setSubmitError] = useState('')
  const { accounts, addDemoTransaction, editTransaction } = useFinance()
  const transactionTime = transaction?.transactionDate?.toDate?.() || (transaction?.transactionDate instanceof Date ? transaction.transactionDate : null)
  const sourceId = transaction?.accountId || accounts.find((account) => account.name === transaction?.account)?.id
  const destinationId = transaction?.destinationAccountId || accounts.find((account) => account.name === transaction?.destinationAccount)?.id
  const availableAccounts = accounts.filter((account) => account.isActive !== false || account.id === sourceId || account.id === destinationId)
  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      title: transaction?.title || '',
      amount: transaction?.amount || '',
      accountId: sourceId || availableAccounts[0]?.id || '',
      destinationAccountId: destinationId || '',
      category: transaction?.category || transaction?.categoryName || expenseCategories[0],
      date: transaction?.date || format(new Date(), 'yyyy-MM-dd'),
      time: transaction?.time || (transactionTime ? format(transactionTime, 'HH:mm') : format(new Date(), 'HH:mm')),
      needType: transaction?.needType || 'kebutuhan',
      adminFee: transaction?.adminFee || 0,
      note: transaction?.note || '',
    },
  })
  const source = watch('accountId')
  const categories = type === 'income' ? incomeCategories : expenseCategories
  const categoryOptions = transaction?.category && !categories.includes(transaction.category)
    ? [transaction.category, ...categories]
    : categories
  const changeType = (nextType) => {
    setType(nextType)
    if (nextType !== 'transfer') setValue('category', nextType === 'income' ? incomeCategories[0] : expenseCategories[0])
  }

  const submit = async (values) => {
    setSubmitError('')
    const destinationName = accounts.find((account) => account.id === values.destinationAccountId)?.name
    const record = {
      ...values,
      type,
      title: type === 'transfer' ? `Transfer ke ${destinationName}` : values.title.trim(),
      category: type === 'transfer' ? 'Transfer' : values.category,
      destinationAccountId: type === 'transfer' ? values.destinationAccountId : null,
      adminFee: type === 'transfer' ? values.adminFee : 0,
    }
    try {
      if (transaction) await editTransaction(transaction.id, record)
      else await addDemoTransaction(record)
      onDone()
    } catch (error) {
      setSubmitError(error.message || 'Transaksi gagal disimpan. Coba lagi.')
    }
  }

  return <form className="finance-form" onSubmit={handleSubmit(submit)}>
    <div className="type-tabs"><button type="button" className={type === 'expense' ? 'active expense' : ''} onClick={() => changeType('expense')}><ArrowUpRight/>Pengeluaran</button><button type="button" className={type === 'income' ? 'active income' : ''} onClick={() => changeType('income')}><ArrowDownLeft/>Pemasukan</button><button type="button" className={type === 'transfer' ? 'active transfer' : ''} onClick={() => changeType('transfer')}><ArrowLeftRight/>Transfer</button>{transaction?.type === 'refund' && <button type="button" className={type === 'refund' ? 'active income' : ''} onClick={() => changeType('refund')}><ArrowDownLeft/>Refund</button>}</div>
    {type !== 'transfer' && <label className="full">Nama {type === 'income' ? 'pemasukan' : type === 'refund' ? 'refund' : 'pengeluaran'}<input autoFocus placeholder={type === 'income' ? 'Contoh: Gaji bulanan' : 'Contoh: Makan siang'} {...register('title', { validate: (value) => type === 'transfer' || Boolean(value?.trim()) || 'Nama transaksi wajib diisi.' })}/>{errors.title && <small className="field-error">{errors.title.message}</small>}</label>}
    <label className={type === 'transfer' ? 'full' : ''}>Nominal (Rp)<input type="number" min="1" placeholder="0" {...register('amount', { required: 'Nominal wajib diisi.', min: { value: 1, message: 'Nominal harus lebih dari nol.' } })}/>{errors.amount && <small className="field-error">{errors.amount.message}</small>}</label>
    <div className="form-grid">
      <label>{type === 'income' || type === 'refund' ? 'Akun tujuan' : 'Akun pembayaran'}<select {...register('accountId', { required: 'Pilih akun.' })}>{availableAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}{account.isActive === false ? ' (nonaktif)' : ''}</option>)}</select>{errors.accountId && <small className="field-error">{errors.accountId.message}</small>}</label>
      {type === 'transfer' && <label>Akun tujuan<select {...register('destinationAccountId', { validate: (value) => Boolean(value) && value !== source || 'Pilih akun tujuan yang berbeda.' })}><option value="">Pilih akun</option>{availableAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}{account.isActive === false ? ' (nonaktif)' : ''}</option>)}</select>{errors.destinationAccountId && <small className="field-error">{errors.destinationAccountId.message}</small>}</label>}
      {type !== 'transfer' && <label>Kategori<select {...register('category', { required: 'Pilih kategori.' })}>{categoryOptions.map((item) => <option key={item}>{item}</option>)}</select>{errors.category && <small className="field-error">{errors.category.message}</small>}</label>}
      <label>Tanggal<input type="date" {...register('date', { required: 'Tanggal wajib diisi.' })}/>{errors.date && <small className="field-error">{errors.date.message}</small>}</label><label>Waktu<input type="time" {...register('time', { required: 'Waktu wajib diisi.' })}/>{errors.time && <small className="field-error">{errors.time.message}</small>}</label>
      {type === 'expense' && <label>Label<select {...register('needType')}><option value="wajib">Wajib</option><option value="kebutuhan">Kebutuhan</option><option value="keinginan">Keinginan</option><option value="tidak-terduga">Tidak terduga</option></select></label>}
      {type === 'transfer' && <label>Biaya admin<input type="number" min="0" {...register('adminFee', { min: { value: 0, message: 'Biaya admin tidak valid.' } })}/>{errors.adminFee && <small className="field-error">{errors.adminFee.message}</small>}</label>}
      <label className="full">Catatan<textarea rows="3" placeholder="Opsional" {...register('note')}/></label>
    </div>
    {submitError && <p className="form-feedback error" role="alert">{submitError}</p>}
    <div className="form-actions"><button type="button" className="secondary-btn" onClick={onDone} disabled={isSubmitting}>Batal</button><button className="primary-btn" disabled={isSubmitting}>{isSubmitting ? 'Menyimpan...' : transaction ? 'Simpan perubahan' : 'Simpan transaksi'}</button></div>
  </form>
}
