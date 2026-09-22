import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import qrcode from 'qrcode-terminal'
import whatsapp from 'whatsapp-web.js'
import { createInbox } from './inbox.js'
import { getMessageId, resolveSenderPhone } from './message-identity.js'

const { Client, LocalAuth } = whatsapp
const sessionPath = process.env.WA_SESSION_DIR
  ? path.resolve(process.env.WA_SESSION_DIR)
  : path.join(os.homedir(), '.local', 'share', 'financemy-whatsapp')
fs.mkdirSync(sessionPath, { recursive: true, mode: 0o700 })
fs.chmodSync(sessionPath, 0o700)
const inbox = createInbox(sessionPath)

const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'financemy', dataPath: sessionPath }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
})

let stopping = false
const stop = async (code) => {
  if (stopping) return
  stopping = true
  try {
    await client.destroy()
  } catch (error) {
    console.error('Gagal menutup sesi WhatsApp:', error)
  } finally {
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
client.on('ready', () => console.log(`WhatsApp siap menerima pesan. Antrean tersimpan: ${inbox.count}.`))
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

  try {
    if (inbox.append(record)) {
      console.log(`Pesan tersimpan: jenis=${record.type}, nomorDitemukan=${Boolean(phone)}, waktu=${receivedAt}`)
    }
  } catch (error) {
    console.error('Gagal menyimpan pesan masuk:', error)
  }
})

client.initialize().catch((error) => {
  console.error('Gagal memulai WhatsApp:', error)
  void stop(1)
})
