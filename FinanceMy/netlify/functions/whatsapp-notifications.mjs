import { adminDb, response } from './_lib/firebase-admin.mjs'
import { matchesConnectorKey } from './_lib/whatsapp-pairing.mjs'
import { notificationQueue } from './_lib/assistant-notifications.mjs'

const queue = notificationQueue(adminDb)
export default async (request) => {
  if (!matchesConnectorKey(request.headers.get('x-financemy-connector-key'), process.env.WA_CONNECTOR_KEY)) return response(401, { error: 'Konektor tidak dikenal.' })
  if (request.method !== 'POST') return response(405, { error: 'Metode tidak didukung.' })
  let body
  try { body = await request.json() } catch { return response(400, { error: 'Body JSON tidak valid.' }) }
  try {
    let result
    if (body?.action === 'ack') {
      if (!/^[a-f0-9]{64}$/.test(body.id || '') || !/^[a-f0-9-]{36}$/.test(body.leaseToken || '')) return response(400, { error: 'Identitas pengiriman tidak valid.' })
      result = { acknowledged: await queue.acknowledge(body.id, body.leaseToken) }
    } else if (body?.action === 'poll') {
      if (body.cursor != null && (typeof body.cursor !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(body.cursor))) return response(400, { error: 'Cursor tidak valid.' })
      result = await queue.poll({ cursor: body.cursor || null })
    } else return response(400, { error: 'Aksi tidak didukung.' })
    const reply = response(200, result)
    reply.headers.set('cache-control', 'no-store')
    return reply
  } catch (error) {
    console.error('Antrean pengingat WhatsApp gagal:', error.code || error.name)
    return response(503, { error: 'Pengingat akan dicoba kembali.' })
  }
}
