const pairingPattern = /^FM-[A-HJ-NP-Z2-9]{8}$/

export function pairingCodeFromMessage(message) {
  if (message?.type !== 'chat' || typeof message.body !== 'string') return null
  const code = message.body.trim().toUpperCase()
  return pairingPattern.test(code) ? code : null
}

export async function claimPairingCode({ code, senderId, phone }) {
  const endpoint = process.env.WA_PAIRING_ENDPOINT
  const key = process.env.WA_CONNECTOR_KEY
  if (!endpoint || !key) throw new Error('Konektor pasangan WhatsApp belum dikonfigurasi.')
  if (new URL(endpoint).protocol !== 'https:') throw new Error('Endpoint pasangan WhatsApp harus memakai HTTPS.')

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-financemy-connector-key': key,
    },
    body: JSON.stringify({ code, senderId, phone }),
    signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) throw new Error(`Server menolak pasangan WhatsApp (HTTP ${response.status}).`)
  return response.json()
}
