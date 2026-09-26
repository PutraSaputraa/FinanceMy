import { useState } from 'react'
import { Plus, Tags } from 'lucide-react'
import Modal from '../../components/common/Modal'
import { useFinance } from '../../context/FinanceContext'
import './category-settings.css'

export default function CategorySettings() {
  const { categories, tags, addTaxonomy, toggleTaxonomy, loading } = useFinance()
  const [tab, setTab] = useState('expense')
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const isTag = tab === 'tag'
  const items = isTag ? tags : categories.filter((item) => item.type === tab)

  const toggle = async (item) => {
    setBusy(true); setError('')
    try { await toggleTaxonomy(isTag ? 'tag' : 'category', item, item.isActive === false) }
    catch (reason) { setError(reason.message) }
    finally { setBusy(false) }
  }
  const add = async (event) => {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget))
    setBusy(true); setError('')
    try { await addTaxonomy(isTag ? 'tag' : 'category', { ...values, type: tab }); setAdding(false) }
    catch (reason) { setError(reason.message) }
    finally { setBusy(false) }
  }

  return <>
    <header><h2>Kategori & tag</h2><p>Tambahkan kategori sesuai kebutuhanmu. Nonaktifkan yang tidak dipakai; riwayat transaksi tetap tersimpan.</p></header>
    <div className="taxonomy-toolbar">
      <div className="taxonomy-tabs" role="group" aria-label="Jenis kategori">
        {[['expense', 'Pengeluaran'], ['income', 'Pemasukan'], ['tag', 'Tag']].map(([id, label]) => <button key={id} type="button" aria-pressed={tab === id} onClick={() => { setTab(id); setError('') }}>{label}</button>)}
      </div>
      <button className="primary-btn" disabled={loading} onClick={() => { setError(''); setAdding(true) }}><Plus size={16}/>{isTag ? 'Tambah tag' : 'Tambah kategori'}</button>
    </div>
    <p className="taxonomy-help">{isTag ? 'Gunakan beberapa tag pada satu transaksi, misalnya “Liburan” atau “Kantor”.' : 'Kategori aktif tersedia saat mencatat transaksi dan membuat jadwal rutin.'}</p>
    {error && !adding && <p className="form-feedback error" role="alert">{error}</p>}
    <div className="taxonomy-list">
      {items.map((item) => <label key={item.id} className={item.isActive === false ? 'inactive' : ''}>
        <i style={{ background: item.color }}/><span><strong>{item.name}</strong><small>{item.isDefault ? 'Bawaan' : 'Buatanmu'} · {item.isActive === false ? 'Nonaktif' : 'Aktif'}</small></span>
        <input type="checkbox" checked={item.isActive !== false} disabled={busy || loading} onChange={() => toggle(item)} aria-label={`Aktifkan ${item.name}`}/>
      </label>)}
    </div>
    {!items.length && <div className="empty-state"><Tags/><h3>Belum ada tag</h3><p>Buat tag pertamamu untuk mengelompokkan transaksi lintas kategori.</p></div>}
    {adding && <Modal open title={isTag ? 'Tambah tag' : 'Tambah kategori'} onClose={() => { if (!busy) setAdding(false) }}>
      <form className="finance-form" onSubmit={add}>
        <label>Nama {isTag ? 'tag' : 'kategori'}<input name="name" autoFocus required maxLength={40} placeholder={isTag ? 'Contoh: Liburan' : 'Contoh: Pendidikan'}/></label>
        <label>Warna<select name="color"><option value="#087f5b">Hijau</option><option value="#2271b3">Biru</option><option value="#8b5cf6">Ungu</option><option value="#e08a17">Oranye</option><option value="#e05252">Merah</option></select></label>
        {error && <p className="form-feedback error" role="alert">{error}</p>}
        <div className="form-actions"><button type="button" className="secondary-btn" disabled={busy} onClick={() => setAdding(false)}>Batal</button><button className="primary-btn" disabled={busy}>{busy ? 'Menyimpan...' : 'Simpan'}</button></div>
      </form>
    </Modal>}
  </>
}
