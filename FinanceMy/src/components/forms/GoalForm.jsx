import { useState } from 'react'
import { format } from 'date-fns'
import { useForm } from 'react-hook-form'
import { toDate } from '../../utils/analytics'

function deadlineValue(value) {
  const date = toDate(value)
  return date ? format(date, 'yyyy-MM-dd') : ''
}

function priorityValue(value) {
  const normalized = String(value || '').toLocaleLowerCase('id-ID')
  if (normalized.includes('tinggi')) return 'Tinggi'
  if (normalized.includes('rendah')) return 'Rendah'
  return 'Sedang'
}

export default function GoalForm({ goal, accounts, goals, onSave, onDone }) {
  const [saveError, setSaveError] = useState('')
  const usedAccountIds = new Set(goals.filter((item) => item.id !== goal?.id).map((item) => item.accountId).filter(Boolean))
  const availableAccounts = accounts.filter((account) => account.isActive !== false)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      name: goal?.name || '',
      target: goal?.target || '',
      deadline: deadlineValue(goal?.deadline),
      priority: priorityValue(goal?.priority),
      accountId: goal?.accountId || '',
    },
  })

  const submit = async (values) => {
    setSaveError('')
    try {
      await onSave(values)
      onDone()
    } catch (error) {
      setSaveError(error.message || 'Target gagal disimpan. Coba lagi.')
    }
  }

  return <form className="finance-form" onSubmit={handleSubmit(submit)}>
    <p className="form-note">Progres target mengikuti saldo akun tujuan secara otomatis. Gunakan akun khusus agar saldo target tidak tercampur dengan uang harian.</p>
    <div className="form-grid">
      <label>Nama target<input autoFocus maxLength="120" placeholder="Contoh: Dana darurat" {...register('name', { validate: (value) => Boolean(value?.trim()) || 'Nama target wajib diisi.' })}/>{errors.name && <small className="field-error">{errors.name.message}</small>}</label>
      <label>Nominal target<input type="number" min="1" step="1" placeholder="20000000" {...register('target', { required: 'Nominal target wajib diisi.', min: { value: 1, message: 'Nominal harus lebih dari nol.' } })}/>{errors.target && <small className="field-error">{errors.target.message}</small>}</label>
      <label>Deadline<input type="date" {...register('deadline', { required: 'Deadline wajib diisi.' })}/>{errors.deadline && <small className="field-error">{errors.deadline.message}</small>}</label>
      <label>Prioritas<select {...register('priority')}><option>Tinggi</option><option>Sedang</option><option>Rendah</option></select></label>
      <label className="full">Akun tujuan<select {...register('accountId', { required: 'Pilih akun tujuan.' })}><option value="">Pilih akun</option>{availableAccounts.map((account) => <option key={account.id} value={account.id} disabled={usedAccountIds.has(account.id)}>{account.name}{usedAccountIds.has(account.id) ? ' — dipakai target lain' : ''}</option>)}</select>{errors.accountId && <small className="field-error">{errors.accountId.message}</small>}</label>
    </div>
    {!availableAccounts.length && <p className="form-feedback error" role="alert">Buat atau aktifkan akun terlebih dahulu sebelum membuat target.</p>}
    {saveError && <p className="form-feedback error" role="alert">{saveError}</p>}
    <div className="form-actions"><button type="button" className="secondary-btn" onClick={onDone} disabled={isSubmitting}>Batal</button><button className="primary-btn" disabled={isSubmitting || !availableAccounts.length}>{isSubmitting ? 'Menyimpan...' : goal ? 'Simpan perubahan' : 'Buat target'}</button></div>
  </form>
}
