import { useState } from 'react'
import { AlertCircle, ArrowDownLeft, ArrowUpRight, CalendarDays, HandCoins, Plus } from 'lucide-react'
import Modal from '../../components/common/Modal'
import PageTitle from '../../components/common/PageTitle'
import ProgressBar from '../../components/common/ProgressBar'
import { useFinance } from '../../context/FinanceContext'
import { toDate } from '../../utils/analytics'
import { formatCurrency, formatDate } from '../../utils/formatters'

export default function DebtsPage() {
  const [tab, setTab] = useState('utang')
  const [open, setOpen] = useState(false)
  const { debts, receivables, installments, addDebtRecord } = useFinance()
  const records = { utang: debts, piutang: receivables, cicilan: installments }
  const currentRecords = records[tab]
  const totalDebt = debts.reduce((sum, item) => sum + Number(item.remaining || 0), 0)
  const totalReceivable = receivables.reduce((sum, item) => sum + Number(item.remaining || 0), 0)
  const monthlyObligations = [...debts, ...installments].reduce((sum, item) => sum + Number(item.monthly || 0), 0)
  const submit = async (event) => {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget))
    await addDebtRecord(tab, values)
    setOpen(false)
  }

  return <>
    <PageTitle eyebrow="KEWAJIBAN & TAGIHAN" title="Utang & Piutang" subtitle="Ketahui apa yang harus dibayar dan apa yang akan diterima." action={<button className="primary-btn" onClick={()=>setOpen(true)}><Plus/>Tambah data</button>}/>
    <div className="page-tabs"><button className={tab==='utang'?'active':''} onClick={()=>setTab('utang')}>Utang</button><button className={tab==='piutang'?'active':''} onClick={()=>setTab('piutang')}>Piutang</button><button className={tab==='cicilan'?'active':''} onClick={()=>setTab('cicilan')}>Cicilan</button></div>
    <section className="debt-summary"><article><i className="expense"><ArrowUpRight/></i><span>Total sisa utang<strong>{formatCurrency(totalDebt)}</strong></span></article><article><i className="income"><ArrowDownLeft/></i><span>Piutang belum diterima<strong>{formatCurrency(totalReceivable)}</strong></span></article><article><i><HandCoins/></i><span>Kewajiban bulanan<strong>{formatCurrency(monthlyObligations)}</strong></span></article></section>
    {currentRecords.length ? <div className="debt-list">{currentRecords.map((item)=>{const dueDate=toDate(item.due);return <article className="card debt-card" key={item.id}><header><span><strong>{item.name}</strong><small>{tab==='cicilan'?'Cicilan aktif':tab==='utang'?'Utang aktif':'Menunggu pembayaran'}</small></span><em>{item.status || (tab==='piutang'?'Akan diterima':'Aktif')}</em></header><div className="debt-values"><span>Sisa<strong>{formatCurrency(item.remaining)}</strong></span><span>Jumlah awal<strong>{formatCurrency(item.total)}</strong></span><span>Per bulan<strong>{formatCurrency(item.monthly)}</strong></span></div><ProgressBar value={item.total?(item.total-item.remaining)/item.total*100:0}/><footer><span><CalendarDays/>{dueDate?formatDate(dueDate):item.due||'Tanpa jatuh tempo'}</span>{item.cash&&<span className="cost-note"><AlertCircle/>Biaya tambahan {formatCurrency(item.total-item.cash)}</span>}<button className="secondary-btn">Catat pembayaran</button></footer></article>})}</div> : <div className="card empty-state"><HandCoins/><h3>Belum ada data {tab}</h3><p>Tambahkan data agar kewajiban dan penerimaanmu dapat dipantau.</p></div>}
    <Modal open={open} onClose={()=>setOpen(false)} title={`Tambah ${tab}`}><form className="finance-form" onSubmit={submit}><div className="form-grid"><label>Nama<input name="name" required/></label><label>Jumlah awal<input name="total" required type="number" min="1"/></label><label>Jatuh tempo<input name="due" type="date"/></label><label>Cicilan per bulan<input name="monthly" type="number" min="0" defaultValue="0"/></label><label>Bunga (%)<input name="interest" type="number" min="0" step="0.1" defaultValue="0"/></label><label>Status<select name="status"><option>Aktif</option><option>Lunas</option></select></label></div><div className="form-actions"><button type="button" className="secondary-btn" onClick={()=>setOpen(false)}>Batal</button><button className="primary-btn">Simpan</button></div></form></Modal>
  </>
}
