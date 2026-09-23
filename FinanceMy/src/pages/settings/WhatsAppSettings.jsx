import { useEffect, useState } from 'react'
import { CheckCircle2, Copy, Link2, MessageCircle, Unplug } from 'lucide-react'
import { createWhatsAppPairingCode, disconnectWhatsApp, getWhatsAppConnection } from '../../services/whatsappLinkService'
import WhatsAppDrafts from './WhatsAppDrafts'

export default function WhatsAppSettings({ user }) {
  const [connection, setConnection] = useState(null)
  const [pairing, setPairing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (user?.isDemo) return undefined
    let active = true
    getWhatsAppConnection()
      .then((result) => { if (active) setConnection(result) })
      .catch((reason) => { if (active) setError(reason.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [user?.isDemo, user?.uid])

  useEffect(() => {
    if (!pairing || connection?.connected) return undefined
    const timer = window.setInterval(async () => {
      if (Date.now() >= new Date(pairing.expiresAt).getTime()) {
        setPairing(null)
        setError('Kode sudah kedaluwarsa. Buat kode baru untuk mencoba lagi.')
        return
      }
      try {
        const result = await getWhatsAppConnection()
        if (result.connected) { setConnection(result); setPairing(null); setError('') }
      } catch { /* Status akan dicoba lagi pada pemeriksaan berikutnya. */ }
    }, 4000)
    return () => window.clearInterval(timer)
  }, [pairing, connection?.connected])

  const createCode = async () => {
    setBusy(true)
    setError('')
    try {
      setPairing(await createWhatsAppPairingCode())
    } catch (reason) { setError(reason.message) }
    finally { setBusy(false) }
  }

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(pairing.code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch { setError('Gagal menyalin kode. Pilih kode lalu salin secara manual.') }
  }

  const disconnect = async () => {
    if (!window.confirm('Putuskan chat WhatsApp dari akun FinanceMy ini?')) return
    setBusy(true)
    setError('')
    try {
      setConnection(await disconnectWhatsApp())
      setPairing(null)
    } catch (reason) { setError(reason.message) }
    finally { setBusy(false) }
  }

  return <>
    <header><h2>Hubungkan WhatsApp</h2><p>Pasangkan chat pribadimu dengan akun FinanceMy agar pesanmu dikenali sebagai milikmu.</p></header>
    {user?.isDemo ? <div className="wa-link-card"><MessageCircle/><p>Login dengan akun FinanceMy untuk menghubungkan WhatsApp. Mode demo tidak menyimpan pasangan chat.</p></div>
      : loading ? <p className="wa-link-note">Memeriksa koneksi WhatsApp...</p>
        : <div className="wa-link-content">
          {error && <p className="wa-link-error" role="alert">{error}</p>}
          {connection?.connected ? <div className="wa-link-card connected">
            <CheckCircle2/><div><strong>WhatsApp terhubung</strong><p>{connection.phone ? `Nomor +${connection.phone}` : 'Chat sudah terhubung. Nomor telepon belum tersedia dari WhatsApp.'}</p></div>
            <button type="button" className="secondary-btn" onClick={disconnect} disabled={busy}><Unplug size={15}/>Putuskan</button>
          </div> : <>
            <div className="wa-link-card"><Link2/><div><strong>Hubungkan chat pribadimu</strong><p>Buat kode, lalu kirim kode itu dari nomor WhatsApp milikmu ke WhatsApp Business FinanceMy. Kode berlaku 10 menit dan hanya bisa dipakai sekali.</p></div></div>
            {pairing ? <div className="wa-pairing-code">
              <span>Kode pasangan</span><strong>{pairing.code}</strong>
              <button type="button" onClick={copyCode}><Copy size={15}/>{copied ? 'Tersalin' : 'Salin kode'}</button>
              <p>Kirim persis kode di atas sebagai satu pesan. Halaman ini akan menampilkan status terhubung secara otomatis.</p>
            </div> : <button type="button" className="primary-btn" onClick={createCode} disabled={busy}>{busy ? 'Membuat kode...' : 'Buat kode pasangan'}</button>}
          </>}
          {connection?.connected && <div className="wa-assistant-guide">
            <strong>Pendamping FinanceMy siap digunakan</strong>
            <p>Kirim catatan transaksi atau tanyakan kondisi keuanganmu langsung dari chat yang terhubung.</p>
            <ul>
              <li>“Budget bulan ini tersisa berapa?”</li>
              <li>“Apa saja transaksi rutinku?”</li>
              <li>“Berapa pengeluaran makan bulan ini?”</li>
              <li>“Tampilkan utang dan cicilanku.”</li>
            </ul>
            <p>Transaksi baru selalu menjadi draf dan baru memengaruhi saldo setelah kamu membalas SUBMIT.</p>
          </div>}
        </div>}
    <WhatsAppDrafts user={user}/>
  </>
}
