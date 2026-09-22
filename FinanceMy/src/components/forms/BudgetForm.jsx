import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useFinance } from '../../context/FinanceContext'

export default function BudgetForm({ onDone }) {
  const { addDemoBudget } = useFinance()
  const [saveError, setSaveError] = useState('')
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({ defaultValues: { name: '', method: 'adaptive', color: '#087f5b' } })
  const method = watch('method')
  const submit = async (values) => {
    setSaveError('')
    try {
      await addDemoBudget({ ...values, name: values.name.trim() })
      onDone()
    } catch (error) {
      setSaveError(error.message || 'Budget gagal dibuat. Coba lagi.')
    }
  }

  return <form className="finance-form" onSubmit={handleSubmit(submit)}>
    <p className="form-note">Beri nama bebas untuk budget bulan ini. Saat mencatat pengeluaran, pilih budget yang ingin digunakan atau pilih Tanpa budget.</p>
    <div className="form-grid">
      <label>Nama budget<input type="text" maxLength="120" placeholder="Contoh: Jajan" {...register('name', { validate: (value) => Boolean(value?.trim()) || 'Nama budget wajib diisi.' })}/>{errors.name && <small className="field-error">{errors.name.message}</small>}</label>
      <label>Batas per bulan<input type="number" min="1" step="1" placeholder="0" {...register('amount', { required: 'Nominal wajib diisi.', min: { value: 1, message: 'Nominal harus positif.' } })}/>{errors.amount && <small className="field-error">{errors.amount.message}</small>}</label>
      <label>Panduan harian<select {...register('method')}><option value="adaptive">Adaptif</option><option value="fixed">Tetap</option></select></label>
      <label>Warna<input className="color-input" type="color" {...register('color')}/></label>
    </div>
    <p className="form-note">{method === 'fixed' ? 'Tetap: batas per hari adalah nominal bulanan dibagi jumlah hari dalam bulan.' : 'Adaptif: sisa budget dibagi jumlah hari yang tersisa, sehingga panduan harian menyesuaikan pengeluaran.'} Sisa akhir bulan tidak otomatis dipindahkan ke bulan berikutnya.</p>
    {saveError && <p className="form-feedback error" role="alert">{saveError}</p>}
    <div className="form-actions"><button type="button" className="secondary-btn" onClick={onDone}>Batal</button><button className="primary-btn" disabled={isSubmitting}>{isSubmitting ? 'Menyimpan...' : 'Buat budget'}</button></div>
  </form>
}
