import { useForm } from 'react-hook-form'
import { useFinance } from '../../context/FinanceContext'

export default function AccountForm({ onDone }) {
  const { addDemoAccount } = useFinance()
  const { register, handleSubmit, formState:{errors,isSubmitting} } = useForm({defaultValues:{type:'Rekening bank',color:'#087f5b',initialBalance:0}})
  const submit = async (values) => { await addDemoAccount(values); onDone() }
  return <form className="finance-form" onSubmit={handleSubmit(submit)}><div className="form-grid"><label>Nama akun<input autoFocus placeholder="Contoh: BCA Utama" {...register('name',{required:'Nama akun wajib diisi.'})}/>{errors.name&&<small className="field-error">{errors.name.message}</small>}</label><label>Jenis akun<select {...register('type')}><option>Rekening bank</option><option>E-wallet</option><option>Uang tunai</option><option>Tabungan</option><option>Investasi</option><option>Akun lainnya</option></select></label><label>Saldo awal (Rp)<input type="number" min="0" {...register('initialBalance',{min:0})}/></label><label>Warna akun<input className="color-input" type="color" {...register('color')}/></label></div><div className="form-actions"><button type="button" className="secondary-btn" onClick={onDone}>Batal</button><button className="primary-btn" disabled={isSubmitting}>{isSubmitting?'Menyimpan...':'Buat akun'}</button></div></form>
}
