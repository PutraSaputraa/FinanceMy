import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight } from 'lucide-react'
import { useFinance } from '../../context/FinanceContext'

export default function TransactionForm({ onDone }) {
  const [type, setType] = useState('expense')
  const { accounts, addDemoTransaction } = useFinance()
  const activeAccounts = accounts.filter((account) => account.isActive !== false)
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({ defaultValues: { date: '2026-08-04', time: '12:00', needType: 'kebutuhan', account: activeAccounts[0]?.name } })
  const source = watch('account')
  const submit = async (values) => { await addDemoTransaction({ ...values, type, category: type === 'transfer' ? 'Transfer' : values.category, amount: Number(values.amount) }); onDone() }
  return <form className="finance-form" onSubmit={handleSubmit(submit)}>
    <div className="type-tabs"><button type="button" className={type==='expense'?'active expense':''} onClick={()=>setType('expense')}><ArrowUpRight/>Pengeluaran</button><button type="button" className={type==='income'?'active income':''} onClick={()=>setType('income')}><ArrowDownLeft/>Pemasukan</button><button type="button" className={type==='transfer'?'active transfer':''} onClick={()=>setType('transfer')}><ArrowLeftRight/>Transfer</button></div>
    {type !== 'transfer' && <label className="full">Nama {type==='income'?'pemasukan':'pengeluaran'}<input autoFocus placeholder={type==='income'?'Contoh: Gaji bulanan':'Contoh: Makan siang'} {...register('title',{required:'Nama transaksi wajib diisi.'})}/>{errors.title&&<small className="field-error">{errors.title.message}</small>}</label>}
    <label className={type==='transfer'?'full':''}>Nominal (Rp)<input type="number" min="1" placeholder="0" {...register('amount',{required:'Nominal wajib diisi.',min:{value:1,message:'Nominal harus lebih dari nol.'}})}/>{errors.amount&&<small className="field-error">{errors.amount.message}</small>}</label>
    <div className="form-grid">
      <label>{type==='income'?'Akun tujuan':'Akun pembayaran'}<select {...register('account',{required:true})}>{activeAccounts.map((account)=><option key={account.id}>{account.name}</option>)}</select></label>
      {type === 'transfer' && <label>Akun tujuan<select {...register('destinationAccount',{validate:(value)=>value!==source||'Akun tujuan harus berbeda.'})}><option value="">Pilih akun</option>{activeAccounts.map((account)=><option key={account.id}>{account.name}</option>)}</select>{errors.destinationAccount&&<small className="field-error">{errors.destinationAccount.message}</small>}</label>}
      {type !== 'transfer' && <label>Kategori<select {...register('category',{required:true})}>{(type==='income'?['Gaji','Freelance','Bonus','Refund','Pemasukan lainnya']:['Makan & Minum','Transportasi','Belanja','Kebutuhan Rumah','Tagihan','Langganan','Hiburan','Pengeluaran Lainnya']).map((item)=><option key={item}>{item}</option>)}</select></label>}
      <label>Tanggal<input type="date" {...register('date')}/></label><label>Waktu<input type="time" {...register('time')}/></label>
      {type==='expense'&&<label>Label<select {...register('needType')}><option value="wajib">Wajib</option><option value="kebutuhan">Kebutuhan</option><option value="keinginan">Keinginan</option><option value="tidak-terduga">Tidak terduga</option></select></label>}
      {type==='transfer'&&<label>Biaya admin<input type="number" min="0" defaultValue="0" {...register('adminFee')}/></label>}
      <label className="full">Catatan<textarea rows="3" placeholder="Opsional" {...register('note')}/></label>
    </div>
    <div className="form-actions"><button type="button" className="secondary-btn" onClick={onDone}>Batal</button><button className="primary-btn" disabled={isSubmitting}>{isSubmitting?'Menyimpan...':'Simpan transaksi'}</button></div>
  </form>
}
