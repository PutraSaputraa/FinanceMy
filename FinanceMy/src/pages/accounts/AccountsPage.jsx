import { useState } from 'react'
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Plus, Scale } from 'lucide-react'
import AccountCard from '../../components/accounts/AccountCard'
import AccountForm from '../../components/forms/AccountForm'
import Modal from '../../components/common/Modal'
import PageTitle from '../../components/common/PageTitle'
import { useFinance } from '../../context/FinanceContext'
import { formatCurrency } from '../../utils/formatters'

export default function AccountsPage(){
 const [open,setOpen]=useState(false); const [reconcile,setReconcile]=useState(null); const {accounts,transactions,notify}=useFinance(); const total=accounts.reduce((s,a)=>s+a.currentBalance,0)
 return <><PageTitle eyebrow="AKUN & DOMPET" title="Semua akun" subtitle="Pantau saldo dan aktivitas di setiap tempat uangmu tersimpan." action={<button className="primary-btn" onClick={()=>setOpen(true)}><Plus/>Tambah akun</button>}/>
 <section className="account-overview card"><div><span>Total saldo aktif</span><strong>{formatCurrency(total)}</strong><small>{accounts.length} akun aktif</small></div><div className="account-overview-stat"><i className="income"><ArrowDownLeft/></i><span>Pemasukan bulan ini<strong>Rp6.000.000</strong></span></div><div className="account-overview-stat"><i className="expense"><ArrowUpRight/></i><span>Pengeluaran bulan ini<strong>Rp903.500</strong></span></div></section>
 <div className="accounts-page-grid">{accounts.map(account=><article className="account-detail-card card" key={account.id}><AccountCard account={account}/><div className="account-detail-stats"><span>Pemasukan<strong>{formatCurrency(account.name==='BSI'?6000000:0)}</strong></span><span>Pengeluaran<strong>{formatCurrency(transactions.filter(t=>t.account.includes(account.name)&&t.type==='expense').reduce((s,t)=>s+t.amount,0))}</strong></span></div><div className="account-card-actions"><button onClick={()=>setReconcile(account)}><Scale/>Rekonsiliasi</button><button>Riwayat <ArrowRight/></button></div></article>)}</div>
 <Modal open={open} onClose={()=>setOpen(false)} title="Tambah akun" description="Tidak perlu logo—pilih warna untuk mengenali akunmu."><AccountForm onDone={()=>setOpen(false)}/></Modal>
 <Modal open={!!reconcile} onClose={()=>setReconcile(null)} title={`Rekonsiliasi ${reconcile?.name||''}`} description="Samakan saldo aplikasi dengan saldo nyata."><form className="finance-form" onSubmit={(e)=>{e.preventDefault();notify('Transaksi penyesuaian berhasil dibuat');setReconcile(null)}}><div className="reconcile-box"><span>Saldo aplikasi<strong>{formatCurrency(reconcile?.currentBalance)}</strong></span><label>Saldo nyata<input type="number" defaultValue={reconcile?.currentBalance}/></label></div><p className="form-note">Selisih akan dicatat sebagai transaksi penyesuaian saldo, bukan pemasukan biasa.</p><div className="form-actions"><button type="button" className="secondary-btn" onClick={()=>setReconcile(null)}>Batal</button><button className="primary-btn">Buat penyesuaian</button></div></form></Modal></>
}
