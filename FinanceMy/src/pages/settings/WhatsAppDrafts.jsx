import { useEffect, useState } from 'react'
import { Check, RotateCw, Trash2 } from 'lucide-react'
import { useFinance } from '../../context/FinanceContext'
import { budgetsForDate } from '../../utils/budgets'
import { approveWhatsAppDraft, dismissWhatsAppDraft, getWhatsAppDrafts } from '../../services/whatsappDraftService'

const incomeCategories = ['Gaji', 'Freelance', 'Bonus', 'Refund', 'Pemasukan lainnya']
const expenseCategories = ['Makan & Minum', 'Transportasi', 'Belanja', 'Kebutuhan Rumah', 'Tagihan', 'Langganan', 'Hiburan', 'Pengeluaran Lainnya']

function jakartaToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

function jakartaTime() {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())
}

function initialValues(draft, accounts) {
  const hint = draft.parsed?.accountHint?.toLocaleLowerCase('id-ID') || ''
  const account = hint ? accounts.find((item) => item.name.toLocaleLowerCase('id-ID') === hint && item.isActive !== false) : null
  return {
    type: draft.parsed?.type || 'expense',
    title: draft.parsed?.title || '',
    amount: draft.parsed?.amount || '',
    category: draft.parsed?.category || 'Pengeluaran Lainnya',
    accountId: account?.id || '',
    budgetId: '',
    date: draft.parsed?.date || jakartaToday(),
    time: jakartaTime(),
    needType: 'kebutuhan',
    note: '',
  }
}

export default function WhatsAppDrafts({ user }) {
  const { accounts, budgetRecords, notify } = useFinance()
  const uid = user?.uid
  const isDemo = user?.isDemo
  const [drafts, setDrafts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!uid || isDemo) return undefined
    let active = true
    const load = async () => {
      try {
        const result = await getWhatsAppDrafts()
        if (active) { setDrafts(result.drafts); setError('') }
      } catch (reason) { if (active) setError(reason.message) }
      finally { if (active) setLoading(false) }
    }
    void load()
    const timer = window.setInterval(() => void load(), 15000)
    return () => { active = false; window.clearInterval(timer) }
  }, [uid, isDemo])

  if (!user || user.isDemo) return null
  const choose = (draft) => { setSelected(draft); setForm(initialValues(draft, accounts)); setError('') }
  const change = (field, value) => setForm((current) => ({ ...current, [field]: value }))
  const availableBudgets = form?.date ? budgetsForDate(budgetRecords, new Date(`${form.date}T12:00`)) : []

  const approve = async (event) => {
    event.preventDefault()
    if (!selected || busy) return
    setBusy(true)
    setError('')
    try {
      await approveWhatsAppDraft(selected.id, form)
      setDrafts((current) => current.filter((item) => item.id !== selected.id))
      setSelected(null)
      setForm(null)
      notify('Transaksi WhatsApp berhasil dicatat')
    } catch (reason) { setError(reason.message) }
    finally { setBusy(false) }
  }

  const dismiss = async (draft) => {
    if (!window.confirm('Abaikan draf WhatsApp ini?')) return
    setBusy(true)
    setError('')
    try {
      await dismissWhatsAppDraft(draft.id)
      setDrafts((current) => current.filter((item) => item.id !== draft.id))
      if (selected?.id === draft.id) { setSelected(null); setForm(null) }
    } catch (reason) { setError(reason.message) }
    finally { setBusy(false) }
  }

  return <section className="wa-drafts">
    <div className="wa-drafts-heading"><div><h3>Draf dari WhatsApp</h3><p>Periksa dan catat di sini, atau balas SUBMIT, REVISI, atau BATAL langsung di chat. Saldo berubah setelah kamu mengirim SUBMIT atau menekan Catat transaksi.</p></div><button type="button" className="secondary-btn" onClick={async () => { setLoading(true); try { setDrafts((await getWhatsAppDrafts()).drafts); setError('') } catch (reason) { setError(reason.message) } finally { setLoading(false) } }}><RotateCw size={14}/>Muat ulang</button></div>
    {error && <p className="wa-link-error" role="alert">{error}</p>}
    {loading ? <p className="wa-link-note">Memuat draf...</p> : drafts.length === 0 ? <p className="wa-link-note">Belum ada draf. Kirim contoh seperti “Makan siang 25 ribu pakai BCA” ke WhatsApp Business FinanceMy.</p> : <div className="wa-draft-list">{drafts.map((draft) => <article className="wa-draft-item" key={draft.id}><p>{draft.text}</p><div><button type="button" className="primary-btn" onClick={() => choose(draft)} disabled={busy}>Periksa</button><button type="button" className="secondary-btn" onClick={() => void dismiss(draft)} disabled={busy}><Trash2 size={14}/>Abaikan</button></div></article>)}</div>}
    {selected && form && <form className="finance-form wa-draft-form" onSubmit={approve}>
      <h4>Periksa transaksi</h4><p className="wa-draft-original">Pesan: {selected.text}</p>
      {selected.parsed?.accountHint && <p className="wa-link-note">Sumber dana yang disebut: {selected.parsed.accountHint}. Pilih akun FinanceMy yang sesuai.</p>}
      <div className="form-grid">
        <label>Jenis<select value={form.type} onChange={(event) => { const type = event.target.value; setForm((current) => ({ ...current, type, category: type === 'income' ? incomeCategories[0] : expenseCategories[0], budgetId: '' })) }}><option value="expense">Pengeluaran</option><option value="income">Pemasukan</option></select></label>
        <label>Nominal (Rp)<input type="number" min="1" required value={form.amount} onChange={(event) => change('amount', event.target.value)}/></label>
        <label className="full">Nama transaksi<input required maxLength="120" value={form.title} onChange={(event) => change('title', event.target.value)}/></label>
        <label>Akun<select required value={form.accountId} onChange={(event) => change('accountId', event.target.value)}><option value="">Pilih akun</option>{accounts.filter((account) => account.isActive !== false).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
        <label>Kategori<select value={form.category} onChange={(event) => change('category', event.target.value)}>{(form.type === 'income' ? incomeCategories : expenseCategories).map((category) => <option key={category}>{category}</option>)}</select></label>
        {form.type === 'expense' && availableBudgets.length > 0 && <label>Budget (opsional)<select value={form.budgetId} onChange={(event) => change('budgetId', event.target.value)}><option value="">Tanpa budget</option>{availableBudgets.map((budget) => <option key={budget.id} value={budget.id}>{budget.name}</option>)}</select></label>}
        <label>Tanggal<input type="date" required value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value, budgetId: '' }))}/></label>
        <label>Waktu<input type="time" required value={form.time} onChange={(event) => change('time', event.target.value)}/></label>
        {form.type === 'expense' && <label>Label<select value={form.needType} onChange={(event) => change('needType', event.target.value)}><option value="wajib">Wajib</option><option value="kebutuhan">Kebutuhan</option><option value="keinginan">Keinginan</option><option value="tidak-terduga">Tidak terduga</option></select></label>}
        <label className="full">Catatan<textarea rows="2" maxLength="1000" value={form.note} onChange={(event) => change('note', event.target.value)}/></label>
      </div>
      <div className="form-actions"><button type="button" className="secondary-btn" onClick={() => { setSelected(null); setForm(null) }} disabled={busy}>Batal</button><button className="primary-btn" disabled={busy}><Check size={15}/>{busy ? 'Menyimpan...' : 'Catat transaksi'}</button></div>
    </form>}
  </section>
}
