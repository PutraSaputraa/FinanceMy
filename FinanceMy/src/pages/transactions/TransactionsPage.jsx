import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Download, Filter, Plus, Search, SlidersHorizontal } from 'lucide-react'
import PageTitle from '../../components/common/PageTitle'
import Modal from '../../components/common/Modal'
import TransactionForm from '../../components/forms/TransactionForm'
import TransactionItem from '../../components/transactions/TransactionItem'
import { useFinance } from '../../context/FinanceContext'
import { getMonthInfo } from '../../utils/analytics'
import { formatCurrency } from '../../utils/formatters'

export default function TransactionsPage(){
  const [params,setParams]=useSearchParams(); const [localOpen,setLocalOpen]=useState(false); const [query,setQuery]=useState(''); const [type,setType]=useState('all'); const {transactions}=useFinance(); const open=localOpen||params.get('add')==='true'; const month=getMonthInfo()
  const close=()=>{setLocalOpen(false);setParams({})}
  const filtered=useMemo(()=>transactions.filter(t=>(type==='all'||t.type===type)&&`${t.title} ${t.category} ${t.account}`.toLowerCase().includes(query.toLowerCase())),[transactions,query,type])
  const exportCsv=()=>{const content=['Nama,Jenis,Kategori,Akun,Nominal,Tanggal',...transactions.map(t=>[t.title,t.type,t.category,t.account,t.amount,t.date].join(','))].join('\n'); const blob=new Blob([content],{type:'text/csv'}); const url=URL.createObjectURL(blob); const link=document.createElement('a');link.href=url;link.download='transaksi-financemy.csv';link.click();URL.revokeObjectURL(url)}
  return <><PageTitle eyebrow="CATATAN KEUANGAN" title="Transaksi" subtitle={`${filtered.length} transaksi pada ${month.label}`} action={<div className="page-actions"><button className="secondary-btn" onClick={exportCsv}><Download/>Ekspor</button><button className="primary-btn" onClick={()=>setLocalOpen(true)}><Plus/>Tambah transaksi</button></div>}/>
    <section className="card filter-card"><label className="search-box page-search"><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Cari transaksi..."/></label><div className="filter-tabs">{[['all','Semua'],['income','Pemasukan'],['expense','Pengeluaran'],['transfer','Transfer']].map(([value,label])=><button key={value} className={type===value?'active':''} onClick={()=>setType(value)}>{label}</button>)}</div><button className="secondary-btn filter-more"><SlidersHorizontal/>Filter</button></section>
    <section className="transaction-stats"><article><span>Total pemasukan</span><strong className="income">+{formatCurrency(transactions.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0))}</strong></article><article><span>Total pengeluaran</span><strong className="expense">−{formatCurrency(transactions.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0))}</strong></article><article><span>Transfer</span><strong>{formatCurrency(transactions.filter(t=>t.type==='transfer').reduce((s,t)=>s+t.amount,0))}</strong></article></section>
    <section className="card transactions-card"><div className="transaction-table-head"><span>TRANSAKSI</span><span>TANGGAL</span><span>NOMINAL</span></div>{filtered.length?filtered.map(t=><TransactionItem key={t.id} transaction={t}/>):<div className="empty-state"><Filter/><h3>Belum ada transaksi</h3><p>Coba ubah filter atau tambahkan transaksi baru.</p></div>}</section>
    <Modal open={open} onClose={close} title="Tambah transaksi" description="Catat aktivitas keuangan secara manual." size="wide"><TransactionForm onDone={close}/></Modal></>
}
