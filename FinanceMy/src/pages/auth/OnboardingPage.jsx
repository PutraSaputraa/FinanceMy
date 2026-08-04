import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, CreditCard, Landmark, PiggyBank, WalletCards } from 'lucide-react'
import { useFinance } from '../../context/FinanceContext'
import { useAuth } from '../../context/AuthContext'
import { completeOnboarding } from '../../services/financeService'
import { getMonthInfo } from '../../utils/analytics'
import { formatCurrency } from '../../utils/formatters'

export default function OnboardingPage() {
  const { user } = useAuth()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(() => ({ name: user?.displayName || '', currency: 'IDR', budgetStartDay: 1, accountName: 'Rekening utama', accountType: 'Rekening bank', initialBalance: 0, budgetName: 'Makan & Minum', budgetAmount: 0 }))
  const { addDemoAccount, addDemoBudget } = useFinance()
  const navigate = useNavigate()
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const finish = async () => { if (form.accountName) await addDemoAccount({ name: form.accountName, type: form.accountType, initialBalance: form.initialBalance, color: '#087f5b' }); if (form.budgetAmount) await addDemoBudget({ name: form.budgetName, amount: form.budgetAmount, spent: 0, method: 'adaptive', color: '#087f5b' }); if (user && !user.isDemo) await completeOnboarding(user.uid, form); navigate('/dashboard') }
  return <main className="onboarding"><header><div className="auth-brand"><span><CreditCard size={22}/></span>Finance<b>My</b></div><span>Langkah {step} dari 3</span></header>
    <div className="onboard-progress"><i className={step >= 1 ? 'active' : ''}/><i className={step >= 2 ? 'active' : ''}/><i className={step >= 3 ? 'active' : ''}/></div>
    <section className="onboard-card">
      {step === 1 && <><div className="onboard-icon"><WalletCards/></div><h1>Mari kenalan dulu</h1><p>Atur preferensi dasar. Kamu dapat mengubah semuanya nanti.</p><div className="form-grid"><label className="full">Nama tampilan<input value={form.name} onChange={(e)=>update('name',e.target.value)}/></label><label>Mata uang<select value={form.currency} onChange={(e)=>update('currency',e.target.value)}><option>IDR — Rupiah</option></select></label><label>Tanggal awal budget<select value={form.budgetStartDay} onChange={(e)=>update('budgetStartDay',e.target.value)}>{[1,5,10,15,20,25].map(day=><option key={day}>{day}</option>)}</select></label></div></>}
      {step === 2 && <><div className="onboard-icon"><Landmark/></div><h1>Tambahkan akun pertama</h1><p>Masukkan saldo saat ini agar ringkasanmu akurat.</p><div className="account-type-options"><button className="selected"><Landmark/><span>Bank</span><Check/></button><button><WalletCards/><span>E-wallet</span></button><button><PiggyBank/><span>Tabungan</span></button></div><div className="form-grid"><label>Nama akun<input value={form.accountName} onChange={(e)=>update('accountName',e.target.value)}/></label><label>Saldo awal<input type="number" value={form.initialBalance} onChange={(e)=>update('initialBalance',e.target.value)}/></label></div></>}
      {step === 3 && <><div className="onboard-icon"><PiggyBank/></div><h1>Buat budget pertamamu</h1><p>Mulai sederhana. Budget adaptif akan mengikuti sisa hari.</p><div className="form-grid"><label>Nama budget<select value={form.budgetName} onChange={(e)=>update('budgetName',e.target.value)}><option>Makan & Minum</option><option>Transportasi</option><option>Hiburan</option><option>Langganan</option></select></label><label>Nominal per bulan<input type="number" value={form.budgetAmount} onChange={(e)=>update('budgetAmount',e.target.value)}/></label></div><div className="adaptive-note"><Sparkline/>Target harian tetap <strong>{formatCurrency(Number(form.budgetAmount || 0) / getMonthInfo().daysInMonth)}</strong>, lalu batas tersedia dihitung ulang setiap hari.</div></>}
      <footer>{step > 1 ? <button className="text-btn" onClick={()=>setStep(step-1)}><ArrowLeft/>Kembali</button> : <span/>}<button className="primary-btn" onClick={()=>step < 3 ? setStep(step+1) : finish()}>{step < 3 ? 'Lanjutkan' : 'Buka dashboard'}<ArrowRight/></button></footer>
    </section>
  </main>
}

function Sparkline(){return <svg viewBox="0 0 32 20" width="32" aria-hidden="true"><path d="M1 17l7-8 6 4 7-10 10 5" fill="none" stroke="currentColor" strokeWidth="2"/></svg>}
