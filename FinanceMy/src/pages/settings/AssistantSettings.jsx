import { useState } from 'react'
import { useFinance } from '../../context/FinanceContext'
import { assistantPreferences } from '../../utils/assistantReports'
import './assistant-settings.css'

export default function AssistantSettings({ connected = false }) {
  const { assistantSettings, saveAssistantSettings, isDemo, loading } = useFinance()
  const prefs = assistantPreferences(assistantSettings)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const update = async (values) => {
    setBusy(true); setError('')
    try { await saveAssistantSettings({ ...prefs, ...values }) }
    catch (reason) { setError(reason.message || 'Pengaturan belum tersimpan.') }
    finally { setBusy(false) }
  }
  return <section className="assistant-settings" aria-label="Pengingat dan laporan WhatsApp">
    <h3>Pengingat & laporan dari Myoui</h3>
    <p>Satu pesan singkat, mudah dibaca di WhatsApp. Kamu bisa meminta rincian dengan membalas “detail”.</p>
    <label className="assistant-option"><span><strong>Ringkasan bulanan</strong><small>Dikirim tanggal 1 mulai pukul 09.00 WIB untuk bulan sebelumnya. Hanya jika ada transaksi tercatat.</small></span><input type="checkbox" checked={prefs.monthlyReport} disabled={busy || loading} onChange={(event) => update({ monthlyReport: event.target.checked })}/></label>
    <label className="assistant-option"><span><strong>Pengingat transaksi rutin</strong><small>Satu pengingat per jatuh tempo, mulai pukul 09.00 WIB.</small></span><input type="checkbox" checked={prefs.recurringReminder} disabled={busy || loading} onChange={(event) => update({ recurringReminder: event.target.checked })}/></label>
    <label className="assistant-timing">Waktu pengingat<select value={prefs.reminderDays} disabled={busy || loading || !prefs.recurringReminder} onChange={(event) => update({ reminderDays: Number(event.target.value) })}><option value={7}>H-7 · 7 hari sebelumnya</option><option value={3}>H-3 · 3 hari sebelumnya</option><option value={0}>Hari jatuh tempo</option></select></label>
    {(!connected || isDemo) && <p className="assistant-note">{isDemo ? 'Mode demo: pengaturan dapat dicoba, tanpa mengirim pesan WhatsApp.' : 'Hubungkan WhatsApp untuk menerima pesan. Preferensimu tetap tersimpan.'}</p>}
    {error && <p className="form-feedback error" role="alert">{error}</p>}
    <small className="assistant-note">Pesan dikirim setelah pukul 09.00 dan sebelum 21.00 WIB. Jika layanan sempat terputus, ringkasan bulanan dapat menyusul sampai tanggal 3.</small>
  </section>
}
