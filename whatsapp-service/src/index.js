import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import qrcode from 'qrcode-terminal'
import whatsapp from 'whatsapp-web.js'
import { createDelivery } from './delivery.js'
import { createInbox } from './inbox.js'
import { createMediaStore } from './media-store.js'
import { getMessageId, resolveSenderPhone, restoreSerializedMessageId } from './message-identity.js'
import { claimPairingCode, pairingCodeFromMessage } from './pairing.js'

const { Client, LocalAuth } = whatsapp
const sessionPath = process.env.WA_SESSION_DIR
  ? path.resolve(process.env.WA_SESSION_DIR)
  : path.join(os.homedir(), '.local', 'share', 'financemy-whatsapp')
fs.mkdirSync(sessionPath, { recursive: true, mode: 0o700 })
fs.chmodSync(sessionPath, 0o700)
const inbox = createInbox(sessionPath)
const mediaStore = createMediaStore(sessionPath)

const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'financemy', dataPath: sessionPath }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
})
const delivery = createDelivery(inbox, sessionPath, fetch, (chatId, text) => client.sendMessage(chatId, text), mediaStore)

let stopping = false
const stop = async (code) => {
  if (stopping) return
  stopping = true
  try {
    await client.destroy()
  } catch (error) {
    console.error('Gagal menutup sesi WhatsApp:', error)
  } finally {
    delivery.stop()
    inbox.close()
    process.exit(code)
  }
}

process.on('SIGINT', () => void stop(0))
process.on('SIGTERM', () => void stop(0))

client.on('qr', (qr) => {
  if (!process.stdout.isTTY) {
    console.error('Sesi WhatsApp perlu dipindai ulang. Jalankan npm start dari SSH interaktif.')
    void stop(78)
    return
  }
  console.log('Scan QR ini dari WhatsApp Business > Perangkat tertaut > Tautkan perangkat.')
  qrcode.generate(qr, { small: true })
})

client.on('authenticated', () => console.log('WhatsApp terautentikasi. Menunggu sesi siap...'))
client.on('ready', () => {
  console.log(`WhatsApp siap menerima pesan. Antrean tersimpan: ${inbox.count}.`)
  delivery.start()
})
client.on('auth_failure', (message) => {
  console.error('Autentikasi WhatsApp gagal:', message)
  void stop(78)
})
client.on('disconnected', (reason) => {
  if (stopping) return
  console.error('WhatsApp terputus:', reason)
  void stop(1)
})

client.on('message', async (message) => {
  if (message.fromMe || !message.from || message.from.endsWith('@g.us') || message.from.endsWith('@broadcast')) return

  const pairingCode = pairingCodeFromMessage(message)
  if (pairingCode) {
    let phone = null
    try {
      phone = await resolveSenderPhone(client, message.from)
      await claimPairingCode({ code: pairingCode, senderId: message.from, phone })
      console.log('Chat WhatsApp berhasil dihubungkan ke akun FinanceMy.')
    } catch (error) {
      console.error('Gagal menghubungkan chat WhatsApp:', error.message)
    }
    return
  }

  const id = getMessageId(message)
  if (!id) {
    console.error('Pesan dilewati karena ID WhatsApp tidak tersedia.')
    return
  }

  let phone = null
  try {
    phone = await resolveSenderPhone(client, message.from)
  } catch (error) {
    console.error('Nomor pengirim belum bisa dicocokkan:', error)
  }

  const receivedAt = new Date().toISOString()
  const sentAt = Number.isFinite(message.timestamp)
    ? new Date(message.timestamp * 1000).toISOString()
    : null
  const record = {
    id,
    senderId: message.from,
    phone,
    type: message.type,
    text: message.body || '',
    sentAt,
    receivedAt,
    status: 'unassigned',
  }

  if (message.type === 'image' && message.hasMedia) {
    try {
      restoreSerializedMessageId(message)
      const media = await message.downloadMedia()
      if (!media) throw new Error('Media foto tidak tersedia dari WhatsApp.')
      record.media = mediaStore.save(id, media)
    } catch (error) {
      console.error('Foto struk tidak dapat disimpan:', error.message)
      await client.sendMessage(message.from, '⚠️ *FOTO BELUM DIPROSES*\n\nWhatsApp belum dapat mengunduh foto tersebut. Coba kirim ulang sebagai foto baru, bukan pesan sekali lihat.')
      return
    }
  }

  try {
    if (inbox.append(record)) {
      console.log(`Pesan tersimpan: jenis=${record.type}, nomorDitemukan=${Boolean(phone)}, waktu=${receivedAt}`)
      void delivery.flush()
    } else if (record.media) mediaStore.remove(record.media)
  } catch (error) {
    console.error('Gagal menyimpan pesan masuk:', error)
  }
})

client.initialize().catch((error) => {
  console.error('Gagal memulai WhatsApp:', error)
  void stop(1)
})
