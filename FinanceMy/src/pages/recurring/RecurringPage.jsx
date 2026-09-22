import { useState } from 'react'
import { CalendarClock, Pencil, Plus, Repeat2, Trash2, Tv2, WalletCards } from 'lucide-react'
import Modal from '../../components/common/Modal'
import PageTitle from '../../components/common/PageTitle'
import RecurringForm from '../../components/forms/RecurringForm'
import RecurringPaymentForm from '../../components/forms/RecurringPaymentForm'
import { useFinance } from '../../context/FinanceContext'
import { formatCurrency, formatDate } from '../../utils/formatters'
import { recurringDueDate, recurringStatus, recurringTransactionType } from '../../utils/recurring'
import './recurring.css'

function annualAmount(item) {
  const amount = Number(item.amount || 0)
  if (item.frequency === 'Mingguan') return amount * 52
  if (item.frequency === 'Tahunan') return amount
  return amount * 12
}

export default function RecurringPage() {
  const [tab, setTab] = useState('rutin')
  const [editing, setEditing] = useState(null)
  const [paying, setPaying] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const { accounts, recurringTransactions, today, addRecurring, editRecurring, removeRecurring, recordRecurringPayment } = useFinance()
  const activeItems = recurringTransactions.filter((item) => item.isActive !== false)
  const filtered = activeItems
    .filter((item) => tab === 'rutin' || tab === 'kalender' || (item.type || '').toLowerCase() === tab)
    .sort((a, b) => (recurringDueDate(a) || '').localeCompare(recurringDueDate(b) || ''))
  const reminders = activeItems.filter((item) => recurringStatus(item, today).needsReminder)
  const monthlyCost = activeItems.filter((item) => recurringTransactionType(item.type) === 'expense')
    .reduce((sum, item) => sum + annualAmount(item) / 12, 0)
  const subscriptionAnnual = activeItems.filter((item) => item.type === 'Langganan')
    .reduce((sum, item) => sum + annualAmount(item), 0)

  const confirmDelete = async () => {
    if (deleteBusy || !deleting) return
    setDeleteBusy(true)
    setDeleteError('')
    try {
      await removeRecurring(deleting.id)
      setDeleting(null)
    } catch (error) {
      setDeleteError(error.message || 'Jadwal gagal dihapus. Coba lagi.')
    } finally {
      setDeleteBusy(false)
    }
  }

  return <>
    <PageTitle eyebrow="PENGINGAT PEMBAYARAN" title="Transaksi rutin" subtitle="Pantau jatuh tempo dan catat pembayaran saat benar-benar dilakukan." action={<button className="primary-btn" onClick={() => setEditing('new')}><Plus/>Tambah rutin</button>}/>
    <div className="page-tabs"><button className={tab === 'rutin' ? 'active' : ''} onClick={() => setTab('rutin')}>Semua rutin</button><button className={tab === 'tagihan' ? 'active' : ''} onClick={() => setTab('tagihan')}>Tagihan</button><button className={tab === 'langganan' ? 'active' : ''} onClick={() => setTab('langganan')}>Langganan</button><button className={tab === 'kalender' ? 'active' : ''} onClick={() => setTab('kalender')}>Kalender</button></div>
    <section className="recurring-summary"><article><Repeat2/><span>Perkiraan biaya per bulan<strong>{formatCurrency(monthlyCost)}</strong></span></article><article><CalendarClock/><span>Perlu perhatian<strong>{reminders.length} jadwal</strong></span></article><article><Tv2/><span>Langganan aktif<strong>{formatCurrency(subscriptionAnnual)}/tahun</strong></span></article></section>
    {reminders.length > 0 && <section className="pending-banner"><CalendarClock/><div><strong>{reminders.length} jadwal perlu perhatian</strong><p>Jatuh tempo dalam 7 hari, hari ini, atau sudah lewat. Catat pembayaran melalui tombol pada setiap jadwal.</p></div></section>}
    <section className="card recurring-list"><header><strong>Jadwal pembayaran</strong><span>Pembayaran yang dicatat muncul di menu Transaksi</span></header>
      {filtered.length ? <ul className="recurring-items">{filtered.map((item) => {
        const status = recurringStatus(item, today)
        const due = recurringDueDate(item)
        const income = recurringTransactionType(item.type) === 'income'
        const account = accounts.find((entry) => entry.id === item.accountId || entry.name === item.accountName || entry.name === item.account)
        return <li className="recurring-item" key={item.id}>
          <span className="recurring-item-icon"><WalletCards size={18}/></span>
          <div className="recurring-item-name"><strong>{item.name || item.title}</strong><small>{item.type || 'Tagihan'} · {item.frequency || 'Bulanan'}</small></div>
          <div className="recurring-item-due"><small>Jatuh tempo</small><strong>{due ? formatDate(`${due}T12:00:00`, 'd MMM yyyy') : 'Belum diatur'}</strong><em className={`recurring-status ${status.tone}`}>{status.label}</em></div>
          <div className="recurring-item-account"><small>{income ? 'Akun penerima' : 'Sumber dana'}</small><strong>{account?.name || 'Pilih saat bayar'}</strong></div>
          <strong className="recurring-item-amount">{formatCurrency(item.amount)}</strong>
          <div className="recurring-item-actions"><button className="primary-btn" onClick={() => setPaying(item)} disabled={!due} title={!due ? 'Edit jadwal untuk mengisi tanggal jatuh tempo' : undefined}>{income ? 'Terima' : 'Bayar'}</button><button className="secondary-btn" onClick={() => setEditing(item)} aria-label={`Edit ${item.name || item.title}`}><Pencil size={15}/><span>Edit</span></button><button className="recurring-delete" onClick={() => { setDeleting(item); setDeleteError('') }} aria-label={`Hapus ${item.name || item.title}`} title="Hapus jadwal"><Trash2 size={16}/><span>Hapus</span></button></div>
        </li>
      })}</ul> : <div className="empty-state"><CalendarClock/><h3>Belum ada transaksi rutin</h3><p>Tambahkan tagihan atau langganan agar jadwalnya muncul di sini.</p></div>}
    </section>
    <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Tambah transaksi rutin' : `Edit ${editing?.name || editing?.title || 'transaksi rutin'}`} description="Jadwal dapat diubah tanpa mengubah riwayat pembayaran.">
      {editing && <RecurringForm key={editing === 'new' ? 'new' : editing.id} item={editing === 'new' ? null : editing} accounts={accounts} onSave={(values) => editing === 'new' ? addRecurring(values) : editRecurring(editing.id, values)} onDone={() => setEditing(null)}/>}
    </Modal>
    <Modal open={!!paying} onClose={() => setPaying(null)} title={`${paying?.type === 'Pemasukan rutin' ? 'Catat pemasukan' : 'Bayar'} ${paying?.name || paying?.title || ''}`} description="Periksa nominal dan akun sebelum mencatat.">
      {paying && <RecurringPaymentForm key={`${paying.id}_${recurringDueDate(paying)}`} item={paying} accounts={accounts} onPay={recordRecurringPayment} onDone={() => setPaying(null)}/>}
    </Modal>
    <Modal open={!!deleting} onClose={() => !deleteBusy && setDeleting(null)} title={`Hapus ${deleting?.name || deleting?.title || 'jadwal'}?`} description="Pengingat berikutnya akan dihentikan.">
      <div className="confirm-account-action"><p>Jadwal ini akan dihapus. Transaksi yang sudah dibayar tetap tersimpan di riwayat.</p>{deleteError && <p className="form-feedback error" role="alert">{deleteError}</p>}<div className="form-actions"><button className="secondary-btn" onClick={() => setDeleting(null)} disabled={deleteBusy}>Batal</button><button className="danger-btn" onClick={confirmDelete} disabled={deleteBusy}>{deleteBusy ? 'Menghapus...' : 'Hapus jadwal'}</button></div></div>
    </Modal>
  </>
}
