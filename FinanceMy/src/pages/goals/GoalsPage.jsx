import { useState } from 'react'
import { differenceInCalendarMonths } from 'date-fns'
import { CalendarDays, Home, Laptop, Plus, ShieldCheck, Sparkles } from 'lucide-react'
import Modal from '../../components/common/Modal'
import PageTitle from '../../components/common/PageTitle'
import ProgressBar from '../../components/common/ProgressBar'
import { useFinance } from '../../context/FinanceContext'
import { toDate } from '../../utils/analytics'
import { formatCurrency, formatDate } from '../../utils/formatters'

const iconMap = { home: Home, laptop: Laptop, shield: ShieldCheck }

export default function GoalsPage() {
  const [open, setOpen] = useState(false)
  const { accounts, goals, addGoal } = useFinance()
  const totalTarget = goals.reduce((sum, item) => sum + Number(item.target || 0), 0)
  const totalSaved = goals.reduce((sum, item) => sum + Number(item.saved || 0), 0)
  const progress = totalTarget ? (totalSaved / totalTarget) * 100 : 0
  const submit = async (event) => {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget))
    await addGoal(values)
    setOpen(false)
  }

  return <>
    <PageTitle eyebrow="MASA DEPAN" title="Target keuangan" subtitle="Ubah rencana besar menjadi langkah kecil yang terukur." action={<button className="primary-btn" onClick={()=>setOpen(true)}><Plus/>Tambah target</button>}/>
    <section className="goal-highlight"><div><span><Sparkles/>PROGRESS KESELURUHAN</span><h2>Kamu sudah mengumpulkan <em>{formatCurrency(totalSaved)}</em></h2><p>dari total target {formatCurrency(totalTarget)} di {goals.length} tujuan aktif.</p></div><div className="goal-ring"><strong>{Math.round(progress)}%</strong><span>tercapai</span></div></section>
    {goals.length ? <div className="goals-grid">{goals.map((item)=>{const Icon=iconMap[item.icon]||ShieldCheck;const deadline=toDate(item.deadline);const months=deadline?Math.max(differenceInCalendarMonths(deadline,new Date()),1):12;const recommended=Math.max(Number(item.target||0)-Number(item.saved||0),0)/months;return <article className="card goal-card" key={item.id}><header><i style={{background:`${item.color||'#087f5b'}18`,color:item.color||'#087f5b'}}><Icon/></i><span><strong>{item.name}</strong><small>{item.priority||'Prioritas sedang'}</small></span><em>{item.status||'Aktif'}</em></header><div className="goal-value"><span>Terkumpul<strong>{formatCurrency(item.saved)}</strong></span><span>Target<strong>{formatCurrency(item.target)}</strong></span></div><ProgressBar value={item.target?item.saved/item.target*100:0} color={item.color||'#087f5b'}/><div className="goal-foot"><span><CalendarDays/> {deadline?formatDate(deadline,'MMM yyyy'):'Tanpa deadline'}</span><strong>Saran {formatCurrency(recommended)}/bulan</strong></div></article>})}</div> : <div className="card empty-state"><ShieldCheck/><h3>Belum ada target keuangan</h3><p>Tambahkan tujuan pertama dan pantau progresnya dari sini.</p></div>}
    <Modal open={open} onClose={()=>setOpen(false)} title="Buat target keuangan" description="Kontribusi dicatat sebagai alokasi atau transfer, bukan pengeluaran."><form className="finance-form" onSubmit={submit}><div className="form-grid"><label>Nama target<input name="name" required placeholder="Contoh: Dana pendidikan"/></label><label>Nominal target<input name="target" required type="number" min="1"/></label><label>Dana saat ini<input name="saved" type="number" min="0" defaultValue="0"/></label><label>Deadline<input name="deadline" type="date" required/></label><label>Prioritas<select name="priority"><option>Tinggi</option><option>Sedang</option><option>Rendah</option></select></label><label>Akun tujuan<select name="accountId"><option value="">Belum dipilih</option>{accounts.filter((account)=>account.isActive!==false).map((account)=><option key={account.id} value={account.id}>{account.name}</option>)}</select></label></div><div className="form-actions"><button type="button" className="secondary-btn" onClick={()=>setOpen(false)}>Batal</button><button className="primary-btn">Simpan target</button></div></form></Modal>
  </>
}
