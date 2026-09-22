import fs from 'node:fs'
import path from 'node:path'

export const createInbox = (directory) => {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 })
  fs.chmodSync(directory, 0o700)

  const filePath = path.join(directory, 'inbox.jsonl')
  const file = fs.openSync(filePath, 'a+', 0o600)
  fs.fchmodSync(file, 0o600)

  const seenIds = new Set()
  const previous = fs.readFileSync(file, 'utf8')
  for (const line of previous.split('\n')) {
    if (!line) continue
    const record = JSON.parse(line)
    if (typeof record.id === 'string') seenIds.add(record.id)
  }

  return {
    filePath,
    count: seenIds.size,
    append(record) {
      if (!record.id || seenIds.has(record.id)) return false
      fs.appendFileSync(file, `${JSON.stringify(record)}\n`, 'utf8')
      fs.fsyncSync(file)
      seenIds.add(record.id)
      return true
    },
    close() {
      fs.closeSync(file)
    },
  }
}
