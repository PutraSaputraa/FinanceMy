import { useState } from 'react'
import { differenceInCalendarMonths } from 'date-fns'
import { CalendarDays, Home, Landmark, Laptop, Pencil, Plus, ShieldCheck, Sparkles, Trash2 } from 'lucide-react'
import Modal from '../../components/common/Modal'
import PageTitle from '../../components/common/PageTitle'
import ProgressBar from '../../components/common/ProgressBar'
import GoalForm from '../../components/forms/GoalForm'
import { useFinance } from '../../context/FinanceContext'
import { toDate } from '../../utils/analytics'
import { formatCurrency, formatDate } from '../../utils/formatters'
import { goalProgress, goalSavedAmount, linkedGoalAccount } from '../../utils/goals'

const iconMap = { home: Home, laptop: Laptop, shield: ShieldCheck }

function priorityLabel(value) {
  if (!value) return 'Prioritas sedang'
  return value.toLocaleLowerCase('id-ID').startsWith('prioritas')
    ? value : `Prioritas ${value.toLocaleLowerCase('id-ID')}`
}

export default function GoalsPage() {
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const { accounts, goals, addGoal, editGoal, removeGoal } = useFinance()
  const totalTarget = goals.reduce((sum, item) => sum + Number(item.target || 0), 0)
  const totalSaved = goals.reduce((sum, item) => sum + goalSavedAmount(item, accounts), 0)
  const progress = totalTarget ? totalSaved / totalTarget * 100 : 0

  const confirmDelete = async () => {
    if (!deleting || deleteBusy) return
    setDeleteBusy(true)
    setDeleteError('')
    try {
      await removeGoal(deleting.id)
      setDeleting(null)
    } catch (error) {
      setDeleteError(error.message || 'Target gagal dihapus. Coba lagi.')
    } finally {
      setDeleteBusy(false)
    }
  }

  return <>
    <PageTitle eyebrow="MASA DEPAN" title="Target keuangan" subtitle="Pantau tujuan secara otomatis dari saldo akun yang kamu pilih." action={<button className="primary-btn" onClick={() => setEditing('new')}><Plus/>Tambah target</button>}/>
    <section className="goal-explainer card" aria-label="Cara kerja target keuangan"><strong>Cara kerja target</strong><p>Setiap target terhubung ke satu akun tujuan. Saldo akun menjadi dana terkumpul dan progres berubah otomatis saat ada transaksi atau transfer. Satu akun hanya dapat dipakai oleh satu target aktif.</p></section>
    <section className="goal-highlight"><div><span><Sparkles/>PROGRES KESELURUHAN</span><h2>Saldo akun tujuan mencapai <em>{formatCurrency(totalSaved)}</em></h2><p>dari total target {formatCurrency(totalTarget)} di {goals.length} tujuan aktif.</p></div><div className="goal-ring"><strong>{Math.round(progress)}%</strong><span>tercapai</span></div></section>
    {goals.length ? <div className="goals-grid">{goals.map((item) => {
      const Icon = iconMap[item.icon] || ShieldCheck
      const account = linkedGoalAccount(item, accounts)
      const saved = goalSavedAmount(item, accounts)
      const itemProgress = goalProgress(item, accounts)
      const deadline = toDate(item.deadline)
      const months = deadline ? Math.max(differenceInCalendarMonths(deadline, new Date()), 1) : 12
      const recommended = Math.max(Number(item.target || 0) - saved, 0) / months
      const reached = Number(item.target) > 0 && saved >= Number(item.target)
      return <article className="card goal-card" key={item.id}>
        <header>
          <i style={{ background: `${item.color || '#087f5b'}18`, color: item.color || '#087f5b' }}><Icon/></i>
          <span><strong>{item.name}</strong><small>{priorityLabel(item.priority)}</small></span>
          <div className="goal-card-controls"><em className={account ? '' : 'warning'}>{account ? reached ? 'Tercapai' : 'Aktif' : 'Pilih akun'}</em><span><button onClick={() => setEditing(item)} aria-label={`Edit ${item.name}`} title="Edit target"><Pencil/></button><button className="delete" onClick={() => { setDeleting(item); setDeleteError('') }} aria-label={`Hapus ${item.name}`} title="Hapus target"><Trash2/></button></span></div>
        </header>
        <div className={`goal-account ${account ? '' : 'missing'}`}><Landmark/><span>{account ? <>Saldo mengikuti <strong>{account.name}</strong>{account.isActive === false && <small>Akun nonaktif</small>}</> : <>Target lama belum memiliki akun tujuan.<strong>Edit untuk memilih akun</strong></>}</span></div>
        <div className="goal-value"><span>{account ? `Saldo ${account.name}` : 'Dana lama'}<strong>{formatCurrency(saved)}</strong></span><span>Target<strong>{formatCurrency(item.target)}</strong></span></div>
        <ProgressBar value={itemProgress} color={item.color || '#087f5b'}/>
        <div className="goal-foot"><span><CalendarDays/> {deadline ? formatDate(deadline, 'MMM yyyy') : 'Tanpa deadline'}</span><strong>{reached ? 'Target tercapai' : `Saran ${formatCurrency(recommended)}/bulan`}</strong></div>
      </article>
    })}</div> : <div className="card empty-state"><ShieldCheck/><h3>Belum ada target keuangan</h3><p>Buat target dan hubungkan dengan akun tempat dananya disimpan.</p></div>}
    <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Buat target keuangan' : `Edit ${editing?.name || 'target'}`} description="Progres akan mengikuti saldo akun tujuan secara otomatis.">
      {editing && <GoalForm key={editing === 'new' ? 'new' : editing.id} goal={editing === 'new' ? null : editing} accounts={accounts} goals={goals} onSave={(values) => editing === 'new' ? addGoal(values) : editGoal(editing.id, values)} onDone={() => setEditing(null)}/>}
    </Modal>
    <Modal open={!!deleting} onClose={() => !deleteBusy && setDeleting(null)} title={`Hapus target ${deleting?.name || ''}?`} description="Target akan dihapus dari daftar tujuanmu.">
      <div className="confirm-account-action"><p>Menghapus target tidak mengubah saldo akun dan tidak menghapus riwayat transaksi.</p>{deleteError && <p className="form-feedback error" role="alert">{deleteError}</p>}<div className="form-actions"><button className="secondary-btn" onClick={() => setDeleting(null)} disabled={deleteBusy}>Batal</button><button className="danger-btn" onClick={confirmDelete} disabled={deleteBusy}>{deleteBusy ? 'Menghapus...' : 'Hapus target'}</button></div></div>
    </Modal>
  </>
}
