import { createHash, randomUUID } from 'node:crypto'
import { assistantPreferences, jakartaDateKey, monthOffset, notificationCandidates } from '../../../src/utils/assistantReports.js'
import { validSenderId } from './whatsapp-pairing.mjs'

export async function reportData(db, uid, { includeTransactions = true } = {}) {
  const names = includeTransactions ? ['transactions', 'recurringTransactions'] : ['recurringTransactions']
  const snapshots = await Promise.all(names.map((name) => db.collection(`users/${uid}/${name}`).get()))
  return Object.fromEntries(names.map((name, index) => [name, snapshots[index].docs.map((doc) => ({ id: doc.id, ...doc.data() }))]))
}

const deliveryId = (uid, key) => createHash('sha256').update(`${uid}:${key}`).digest('hex')

// One immutable delivery identity per month or recurring due date. No financial mutations.
export function notificationQueue(db) {
  const claim = async (uid, senderId, candidate, preferences, now) => {
    const id = deliveryId(uid, candidate.key)
    const ref = db.doc(`waNotificationDeliveries/${id}`)
    return db.runTransaction(async (transaction) => {
      const [existing, connection, user, settings, recurring] = await Promise.all([
        transaction.get(ref), transaction.get(db.doc(`waConnections/${uid}`)), transaction.get(db.doc(`users/${uid}`)),
        transaction.get(db.doc(`users/${uid}/settings/assistant`)),
        candidate.kind === 'recurring' ? transaction.get(db.doc(`users/${uid}/recurringTransactions/${candidate.recurringId}`)) : null,
      ])
      if (!user.exists || user.data()?.status === 'disabled' || connection.data()?.senderId !== senderId || !validSenderId(senderId)) return null
      const current = assistantPreferences(settings.data())
      if (candidate.kind === 'monthly' ? !current.monthlyReport : !current.recurringReminder || current.reminderDays !== preferences.reminderDays) return null
      if (recurring && (!recurring.exists || !notificationCandidates({ recurringTransactions: [{ id: recurring.id, ...recurring.data() }] }, current, now).some((item) => item.key === candidate.key))) return null
      if (existing.data()?.status === 'sent' || existing.data()?.leaseUntil > now.getTime()) return null
      const leaseToken = randomUUID()
      transaction.set(ref, { uid, senderId, ...candidate, status: 'claimed', leaseToken, leaseUntil: now.getTime() + 300_000, claimedAt: now.getTime() })
      return { id, leaseToken, senderId, text: candidate.text }
    })
  }

  const acknowledge = async (id, leaseToken, now = new Date()) => db.runTransaction(async (transaction) => {
    const ref = db.doc(`waNotificationDeliveries/${id}`)
    const item = (await transaction.get(ref)).data()
    if (!item || item.leaseToken !== leaseToken) return false
    if (item.status === 'sent') return true
    const contextRef = item.kind === 'monthly' ? db.doc(`waReportContexts/${item.uid}`) : null
    const context = contextRef ? (await transaction.get(contextRef)).data() : null
    transaction.update(ref, { status: 'sent', sentAt: now.getTime(), leaseUntil: 0 })
    if (contextRef && (!context?.period || context.period <= item.period)) transaction.set(contextRef, { period: item.period, sentAt: now.getTime() })
    return true
  })

  const poll = async ({ cursor = null, now = new Date() } = {}) => {
    const today = jakartaDateKey(now)
    const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', hourCycle: 'h23' }).format(now))
    if (hour < 9 || hour >= 21) return { items: [], cursor: null }
    // A bounded page prevents one connector request from scanning every user.
    let query = db.collection('waConnections').orderBy('__name__').limit(10)
    if (cursor) query = query.startAfter(cursor)
    const connections = await query.get()
    const items = []
    for (const connection of connections.docs) {
      const uid = connection.id
      const senderId = connection.data().senderId
      if (!validSenderId(senderId)) continue
      const [settings, profile] = await Promise.all([db.doc(`users/${uid}/settings/assistant`).get(), db.doc(`users/${uid}`).get()])
      const prefs = assistantPreferences(settings.data())
      let monthlyDue = prefs.monthlyReport && Number(today.slice(-2)) <= 3
      if (monthlyDue) {
        const key = `monthly_${monthOffset(today.slice(0, 7), -1)}`
        const delivered = (await db.doc(`waNotificationDeliveries/${deliveryId(uid, key)}`).get()).data()
        monthlyDue = delivered?.status !== 'sent' && !(delivered?.leaseUntil > now.getTime())
      }
      if (!profile.exists || profile.data()?.status === 'disabled' || (!monthlyDue && !prefs.recurringReminder)) continue
      const data = await reportData(db, uid, { includeTransactions: monthlyDue })
      for (const candidate of notificationCandidates(data, { ...prefs, monthlyReport: monthlyDue }, now)) {
        const item = await claim(uid, senderId, candidate, prefs, now)
        if (item) items.push(item)
        if (items.length >= 20) return { items, cursor: null }
      }
    }
    return { items, cursor: connections.docs.length === 10 ? connections.docs.at(-1).id : null }
  }
  return { poll, claim, acknowledge }
}
