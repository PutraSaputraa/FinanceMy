import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useFinance } from '../../context/FinanceContext'

const categories = ['Makan & Minum', 'Transportasi', 'Hiburan', 'Langganan', 'Kebutuhan Rumah', 'Belanja', 'Tagihan', 'Pengeluaran Lainnya']

export default function BudgetForm({ onDone }) {
  const { budgets, addDemoBudget } = useFinance()
  const [saveError, setSaveError] = useState('')
  const available = categories.filter((category) => !budgets.some((budget) => budget.name === category))
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({ defaultValues: { name: available[0] || '', method: 'adaptive', color: '#087f5b' } })
  const method = watch('method')
  const submit = async (values) => {
    setSaveError('')
    try {
      await addDemoBudget(values)
      onDone()
    } catch (error) {
      setSaveError(error.message || 'Budget gagal dibuat. Coba lagi.')
    }
  }

  return <form className="finance-form" onSubmit={handleSubmit(submit)}>
    <p className="form-note">Budget berlaku untuk bulan ini. Nominal terpakai dihitung otomatis dari transaksi pengeluaran dengan kategori yang sama.</p>
    <div className="form-grid">
      <label>Kategori budget<select {...register('name', { required: 'Pilih kategori.' })} disabled={!available.length}>{available.map((category) => <option key={category}>{category}</option>)}</select>{errors.name && <small className="field-error">{errors.name.message}</small>}</label>
      <label>Batas per bulan<input type="number" min="1" step="1" placeholder="0" {...register('amount', { required: 'Nominal wajib diisi.', min: { value: 1, message: 'Nominal harus positif.' } })}/>{errors.amount && <small className="field-error">{errors.amount.message}</small>}</label>
      <label>Panduan harian<select {...register('method')}><option value="adaptive">Adaptif</option><option value="fixed">Tetap</option></select></label>
      <label>Warna<input className="color-input" type="color" {...register('color')}/></label>
    </div>
    <p className="form-note">{method === 'fixed' ? 'Tetap: batas per hari adalah nominal bulanan dibagi jumlah hari dalam bulan.' : 'Adaptif: sisa budget dibagi jumlah hari yang tersisa, sehingga panduan harian menyesuaikan pengeluaran.'} Sisa akhir bulan tidak otomatis dipindahkan ke bulan berikutnya.</p>
    {!available.length && <p className="form-feedback error">Semua kategori sudah memiliki budget bulan ini. Hapus budget yang ingin diganti terlebih dahulu.</p>}
    {saveError && <p className="form-feedback error" role="alert">{saveError}</p>}
    <div className="form-actions"><button type="button" className="secondary-btn" onClick={onDone}>Batal</button><button className="primary-btn" disabled={isSubmitting || !available.length}>{isSubmitting ? 'Menyimpan...' : 'Buat budget'}</button></div>
  </form>
}
