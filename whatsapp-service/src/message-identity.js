const phoneFromJid = (jid) => {
  if (typeof jid !== 'string' || !/^\d{6,15}@c\.us$/.test(jid)) return null
  return jid.slice(0, -'@c.us'.length)
}

export const getMessageId = (message) => {
  const id = message?.id
  if (!id) return null

  if (typeof id._serialized === 'string' && id._serialized) return id._serialized
  if (typeof id.$1 === 'string' && id.$1) return id.$1

  const remote = typeof id.remote === 'string' ? id.remote : id.remote?._serialized
  if (typeof id.fromMe !== 'boolean' || typeof remote !== 'string' || !remote ||
      typeof id.id !== 'string' || !id.id) return null

  return `${id.fromMe}_${remote}_${id.id}`
}

export const restoreSerializedMessageId = (message) => {
  const serialized = getMessageId(message)
  if (!serialized || !message?.id || typeof message.id !== 'object') return null
  if (typeof message.id._serialized !== 'string' || !message.id._serialized) {
    message.id._serialized = serialized
  }
  return serialized
}

export const resolveSenderPhone = async (client, senderId) => {
  const directPhone = phoneFromJid(senderId)
  if (directPhone) return directPhone
  if (typeof senderId !== 'string' || !senderId.endsWith('@lid')) return null

  const mappings = await client.getContactLidAndPhone([senderId])
  const match = mappings.find((item) => item?.lid === senderId)
  return phoneFromJid(match?.pn)
}
