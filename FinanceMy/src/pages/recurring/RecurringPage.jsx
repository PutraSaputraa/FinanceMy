import { useState } from 'react'
import { CalendarClock, ChevronRight, Plus, Repeat2, Tv2, Wifi } from 'lucide-react'
import Modal from '../../components/common/Modal'
import PageTitle from '../../components/common/PageTitle'
import { useFinance } from '../../context/FinanceContext'
import { toDate } from '../../utils/analytics'
import { formatCurrency, formatDate } from '../../utils/formatters'

function nextLabel(item) {
  const date = toDate(item.nextDate || item.date || item.dueDate)
  return date ? formatDate(date, 'd MMM yyyy') : 'Belum diatur'
}

export default function RecurringPage() {
  const [tab, setTab] = useState('rutin')
  const [open, setOpen] = useState(false)
  const { recurringTransactions, addRecurring } = useFinance()
  const filtered = recurringTransactions.filter((item) => tab === 'rutin' || tab === 'kalender' || (item.type || '').toLowerCase() === tab)
  const monthlyTotal = recurringTransactions.filter((item) => item.isActive !== false && (item.frequency || 'Bulanan') === 'Bulanan').reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const subscriptions = recurringTransactions.filter((item) => (item.type || '').toLowerCase() === 'langganan' && item.isActive !== false)
  const submit = async (event) => {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget))
    await addRecurring(values)
    setOpen(false)
  }

  return <>
    <PageTitle eyebrow="OTOMATISASI RINGAN" title="Transaksi rutin" subtitle="Tagihan, langganan, dan transaksi berulang dalam satu tempat." action={<button className="primary-btn" onClick={()=>setOpen(true)}><Plus/>Tambah rutin</button>}/>
    <div className="page-tabs"><button className={tab==='rutin'?'active':''} onClick={()=>setTab('rutin')}>Semua rutin</button><button className={tab==='tagihan'?'active':''} onClick={()=>setTab('tagihan')}>Tagihan</button><button className={tab==='langganan'?'active':''} onClick={()=>setTab('langganan')}>Langganan</button><button className={tab==='kalender'?'active':''} onClick={()=>setTab('kalender')}>Kalender</button></div>
    <section className="recurring-summary"><article><Repeat2/><span>Biaya rutin bulanan<strong>{formatCurrency(monthlyTotal)}</strong></span></article><article><CalendarClock/><span>Jadwal aktif<strong>{recurringTransactions.filter((item)=>item.isActive!==false).length} transaksi</strong></span></article><article><Tv2/><span>Langganan aktif<strong>{formatCurrency(subscriptions.reduce((sum,item)=>sum+Number(item.amount||0),0)*12)}/tahun</strong></span></article></section>
    <section className="card recurring-list"><header><strong>Jadwal mendatang</strong><span>Data tersimpan pada akun pengguna</span></header>{filtered.length ? filtered.map((item)=><div key={item.id}><i style={{background:'#2271b318',color:'#2271b3'}}><Wifi/></i><span><strong>{item.name || item.title}</strong><small>{item.type || 'Transaksi rutin'} • {item.frequency || 'Bulanan'}</small></span><span><small>Jatuh tempo</small><strong>{nextLabel(item)}</strong></span><span><small>Akun</small><strong>{item.account || item.accountName || 'Belum dipilih'}</strong></span><b>{formatCurrency(item.amount)}</b><button className="icon-btn"><ChevronRight/></button></div>) : <div className="empty-state"><CalendarClock/><h3>Belum ada transaksi rutin</h3><p>Tambahkan tagihan atau langganan agar jadwalnya muncul di sini.</p></div>}</section>
    <Modal open={open} onClose={()=>setOpen(false)} title="Tambah transaksi rutin" description="Pemeriksaan jatuh tempo dilakukan setiap aplikasi dibuka."><form className="finance-form" onSubmit={submit}><div className="form-grid"><label>Nama<input name="name" required placeholder="Contoh: Spotify"/></label><label>Jenis<select name="type"><option>Langganan</option><option>Tagihan</option><option>Cicilan</option><option>Pemasukan rutin</option></select></label><label>Nominal<input name="amount" required type="number" min="1"/></label><label>Frekuensi<select name="frequency"><option>Bulanan</option><option>Mingguan</option><option>Tahunan</option></select></label><label>Tanggal berikutnya<input name="nextDate" type="date" required/></label><label>Metode pencatatan<select name="method"><option>Minta konfirmasi</option><option>Pengingat saja</option><option>Catat otomatis saat aplikasi dibuka</option></select></label></div><p className="form-note">Occurrence key unik mencegah transaksi dibuat dua kali untuk periode yang sama.</p><div className="form-actions"><button type="button" className="secondary-btn" onClick={()=>setOpen(false)}>Batal</button><button className="primary-btn">Simpan transaksi rutin</button></div></form></Modal>
  </>
}
