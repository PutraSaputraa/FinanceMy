import { useState } from 'react'
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Plus, Scale } from 'lucide-react'
import AccountCard from '../../components/accounts/AccountCard'
import AccountForm from '../../components/forms/AccountForm'
import Modal from '../../components/common/Modal'
import PageTitle from '../../components/common/PageTitle'
import { useFinance } from '../../context/FinanceContext'
import { getPeriodSummary } from '../../utils/analytics'
import { formatCurrency } from '../../utils/formatters'

export default function AccountsPage(){
 const [open,setOpen]=useState(false); const [reconcile,setReconcile]=useState(null); const {accounts,transactions,notify}=useFinance(); const total=accounts.reduce((s,a)=>s+Number(a.currentBalance||0),0); const summary=getPeriodSummary(transactions)
 return <><PageTitle eyebrow="AKUN & DOMPET" title="Semua akun" subtitle="Pantau saldo dan aktivitas di setiap tempat uangmu tersimpan." action={<button className="primary-btn" onClick={()=>setOpen(true)}><Plus/>Tambah akun</button>}/>
 <section className="account-overview card"><div><span>Total saldo aktif</span><strong>{formatCurrency(total)}</strong><small>{accounts.length} akun aktif</small></div><div className="account-overview-stat"><i className="income"><ArrowDownLeft/></i><span>Pemasukan bulan ini<strong>{formatCurrency(summary.income)}</strong></span></div><div className="account-overview-stat"><i className="expense"><ArrowUpRight/></i><span>Pengeluaran bulan ini<strong>{formatCurrency(summary.expense)}</strong></span></div></section>
 {accounts.length?<div className="accounts-page-grid">{accounts.map(account=>{const accountTransactions=transactions.filter(t=>(t.account||t.accountName||'').includes(account.name));const accountIncome=accountTransactions.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount||0),0);const accountExpense=accountTransactions.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount||0),0);return <article className="account-detail-card card" key={account.id}><AccountCard account={account}/><div className="account-detail-stats"><span>Pemasukan<strong>{formatCurrency(accountIncome)}</strong></span><span>Pengeluaran<strong>{formatCurrency(accountExpense)}</strong></span></div><div className="account-card-actions"><button onClick={()=>setReconcile(account)}><Scale/>Rekonsiliasi</button><button>Riwayat <ArrowRight/></button></div></article>})}</div>:<div className="card empty-state"><Scale/><h3>Belum ada akun</h3><p>Tambahkan akun pertama untuk mulai mengelola saldo.</p></div>}
 <Modal open={open} onClose={()=>setOpen(false)} title="Tambah akun" description="Tidak perlu logo—pilih warna untuk mengenali akunmu."><AccountForm onDone={()=>setOpen(false)}/></Modal>
 <Modal open={!!reconcile} onClose={()=>setReconcile(null)} title={`Rekonsiliasi ${reconcile?.name||''}`} description="Samakan saldo aplikasi dengan saldo nyata."><form className="finance-form" onSubmit={(e)=>{e.preventDefault();notify('Transaksi penyesuaian berhasil dibuat');setReconcile(null)}}><div className="reconcile-box"><span>Saldo aplikasi<strong>{formatCurrency(reconcile?.currentBalance)}</strong></span><label>Saldo nyata<input type="number" defaultValue={reconcile?.currentBalance}/></label></div><p className="form-note">Selisih akan dicatat sebagai transaksi penyesuaian saldo, bukan pemasukan biasa.</p><div className="form-actions"><button type="button" className="secondary-btn" onClick={()=>setReconcile(null)}>Batal</button><button className="primary-btn">Buat penyesuaian</button></div></form></Modal></>
}
