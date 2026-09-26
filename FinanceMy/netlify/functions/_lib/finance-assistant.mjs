import { parseWhatsAppDraft } from './whatsapp-draft.mjs'
import { calculateAdaptiveBudget } from '../../../src/utils/calculations.js'

const rupiah = new Intl.NumberFormat('id-ID')
const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const allowedTopics = new Set([
  'overview', 'accounts', 'budgets', 'debts', 'receivables', 'installments',
  'recurring', 'goals', 'transactions',
])

function jsonObject(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    const parsed = JSON.parse(trimmed)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function validDateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T12:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null
}

function textValue(value, max = 80) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function positiveAmount(value) {
  const amount = Number(value)
  return Number.isFinite(amount) && amount > 0 ? amount : null
}

function nonNegativeAmount(value) {
  if (value === null || value === undefined || value === '') return null
  const amount = Number(value)
  return Number.isFinite(amount) && amount >= 0 ? amount : null
}

const amountPattern = String.raw`(\d[\d.]*(?:,\d+)?)\s*(juta|jt|ribu|rb|k)?`
const monthNumbers = {
  januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6,
  juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, desember: 12,
}

function localizedAmount(raw, unit) {
  if (!raw) return null
  const normalizedNumber = raw.includes(',')
    ? raw.replaceAll('.', '').replace(',', '.')
    : raw.replaceAll('.', '')
  const value = Number(normalizedNumber)
  if (!Number.isFinite(value)) return null
  const multiplier = ['juta', 'jt'].includes(unit) ? 1_000_000
    : ['ribu', 'rb', 'k'].includes(unit) ? 1_000 : 1
  return positiveAmount(value * multiplier)
}

function amountAfter(text, prefix, distance = 50) {
  const match = text.match(new RegExp(`(?:${prefix})[^\\d]{0,${distance}}${amountPattern}`, 'i'))
  return match ? localizedAmount(match[1], match[2]?.toLocaleLowerCase('id-ID')) : null
}

export function extractGoalPlanHints(text) {
  const source = String(text || '').toLocaleLowerCase('id-ID')
  const exactDateMatch = source.match(/\b(?:tanggal\s+)?(\d{1,2})\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s+(20\d{2})\b/i)
  const monthMatch = source.match(/\b(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s+(20\d{2})\b/i)
  let targetDate = null
  if (exactDateMatch) {
    const year = Number(exactDateMatch[3])
    const month = monthNumbers[exactDateMatch[2]]
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
    const day = Number(exactDateMatch[1])
    if (day <= lastDay) targetDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  } else if (monthMatch) {
    const year = Number(monthMatch[2])
    const month = monthNumbers[monthMatch[1]]
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
    targetDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  }
  const dayMatch = source.match(/(?:setiap\s+)?(?:tanggal|tgl)\s*(\d{1,2})/i)
  const incomeDay = dayMatch && Number(dayMatch[1]) >= 1 && Number(dayMatch[1]) <= 31
    ? Number(dayMatch[1]) : null
  const extractedIncome = amountAfter(source, 'gaji|penghasilan|pemasukan', 30)
  return {
    targetAmount: amountAfter(source, String.raw`target(?:\s+(?:tabungan|dana|keuangan))?|ingin\s+(?:dapat|punya|memiliki|mengumpulkan)|mau\s+(?:punya|memiliki|mengumpulkan)`),
    currentSaved: amountAfter(source, String.raw`sudah\s+(?:(?:berhasil|terkumpul)\s+)?(?:mengumpulkan|menabung|punya|memiliki|ada)|(?:telah|sudah)\s+terkumpul|dana\s+saat\s+ini`),
    targetDate,
    monthlyIncome: extractedIncome && extractedIncome < 100 ? extractedIncome * 1_000_000 : extractedIncome,
    incomeDay,
  }
}

export function parseAssistantIntent(content, fallbackDate, categories) {
  const result = jsonObject(content)
  if (result?.kind === 'transaction') {
    return { kind: 'transaction', draft: parseWhatsAppDraft(JSON.stringify(result), fallbackDate, categories) }
  }
  if (result?.kind !== 'finance_query') return { kind: 'unsupported' }

  const requestedTopics = Array.isArray(result.topics) ? result.topics : [result.topic]
  const topics = [...new Set(requestedTopics.filter((topic) => allowedTopics.has(topic)))].slice(0, 4)
  if (!topics.length) return { kind: 'unsupported' }
  const transactionType = ['expense', 'income', 'transfer'].includes(result.transactionType)
    ? result.transactionType : 'all'
  const targetAmount = positiveAmount(result.targetAmount)
  const targetDate = validDateKey(result.targetDate)
  return {
    kind: 'finance_query',
    plan: {
      topics,
      mode: ['list', 'summary', 'advice'].includes(result.mode) ? result.mode : 'summary',
      periodStart: validDateKey(result.periodStart),
      periodEnd: validDateKey(result.periodEnd),
      transactionType,
      budgetView: result.budgetView === 'daily' ? 'daily' : 'monthly',
      adviceType: result.adviceType === 'goal_plan' || (targetAmount && targetDate)
        ? 'goal_plan' : result.adviceType === 'purchase' ? 'purchase' : 'general',
      scenarioAmount: positiveAmount(result.scenarioAmount),
      scenarioTitle: textValue(result.scenarioTitle, 100),
      budget: textValue(result.budget),
      targetAmount,
      currentSaved: nonNegativeAmount(result.currentSaved),
      targetDate,
      monthlyIncome: positiveAmount(result.monthlyIncome),
      incomeDay: Number.isInteger(Number(result.incomeDay)) && Number(result.incomeDay) >= 1 && Number(result.incomeDay) <= 31
        ? Number(result.incomeDay) : null,
      goalName: textValue(result.goalName, 100),
      category: textValue(result.category),
      account: textValue(result.account),
      search: textValue(result.search, 120),
    },
  }
}

function normalized(value) {
  return String(value || '').trim().toLocaleLowerCase('id-ID')
}

function number(value) {
  const result = Number(value)
  return Number.isFinite(result) ? result : 0
}

function money(value) {
  const amount = number(value)
  return `${amount < 0 ? '-' : ''}Rp${rupiah.format(Math.abs(Math.round(amount)))}`
}

function dateKey(value) {
  if (!value) return null
  if (typeof value === 'string') {
    const direct = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0]
    if (direct) return validDateKey(direct)
  }
  const date = typeof value?.toDate === 'function' ? value.toDate() : value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date?.getTime?.())) return null
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function monthBounds(today) {
  const [year, month] = today.split('-').map(Number)
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return { start: `${year}-${String(month).padStart(2, '0')}-01`, end: `${year}-${String(month).padStart(2, '0')}-${last}` }
}

function displayDate(value) {
  const key = dateKey(value)
  if (!key) return String(value || 'belum diatur')
  const [year, month, day] = key.split('-').map(Number)
  return `${day} ${monthNames[month - 1]} ${year}`
}

function monthLabel(value) {
  const key = dateKey(value) || `${value}-01`
  const [year, month] = key.split('-').map(Number)
  return `${monthNames[month - 1]} ${year}`
}

function periodLabel(start, end) {
  if (start === end) return displayDate(start)
  const bounds = monthBounds(start)
  if (start === bounds.start && end === bounds.end) return monthLabel(start)
  return `${displayDate(start)} – ${displayDate(end)}`
}

function itemDate(item) {
  return dateKey(item.transactionDate || item.date || item.createdAt)
}

function transactionCategory(item) {
  return item.categoryName || item.category || 'Lainnya'
}

function transactionAccount(item) {
  return item.accountName || item.account || 'Akun'
}

function expenseValue(item) {
  if (item.type === 'expense') return number(item.amount)
  if (item.type === 'refund') return -number(item.amount)
  if (item.type === 'transfer') return number(item.adminFee)
  return 0
}

function incomeValue(item) {
  return item.type === 'income' ? number(item.amount) : 0
}

function active(items) {
  return items.filter((item) => item.isActive !== false && normalized(item.status) !== 'lunas')
}

function linkedGoalAccount(data, goal) {
  return data.accounts.find((account) => account.id === goal?.accountId)
    || data.accounts.find((account) => goal?.accountName && account.name === goal.accountName)
    || null
}

function goalSavedAmount(data, goal) {
  const account = linkedGoalAccount(data, goal)
  return Math.max(number(account ? account.currentBalance : goal?.saved), 0)
}

function searched(items, query, fields) {
  const needle = normalized(query)
  if (!needle) return items
  return items.filter((item) => fields.some((field) => normalized(field(item)).includes(needle)))
}

function limitedBlocks(items, render, limit = 5) {
  const visible = items.slice(0, limit).map(render)
  if (items.length > limit) visible.push(`_+${items.length - limit} data lainnya. Buka FinanceMy untuk melihat semua._`)
  return visible
}

function budgetPeriodKey(item, today) {
  return item.periodKey || dateKey(item.createdAt)?.slice(0, 7) || today.slice(0, 7)
}

function assignedToBudget(item, budget) {
  const hasBudgetId = Object.hasOwn(item, 'budgetId')
  return hasBudgetId
    ? item.budgetId === budget.id
    : budget.trackingMode !== 'manual' && transactionCategory(item) === budget.name
}

function currentBudgets(data, today) {
  const budgets = data.budgets.filter((item) => item.isActive !== false && budgetPeriodKey(item, today) === today.slice(0, 7))
  return budgets.map((budget) => {
    const spent = data.transactions.reduce((total, item) => {
      if (itemDate(item)?.slice(0, 7) !== today.slice(0, 7)) return total
      return assignedToBudget(item, budget) ? total + expenseValue(item) : total
    }, 0)
    return { ...budget, spent: Math.max(spent, 0), remaining: number(budget.amount) - Math.max(spent, 0) }
  })
}

function dailyBudgetAnswer(items, data, today) {
  const [year, month, day] = today.split('-').map(Number)
  const daysInPeriod = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const daysRemaining = daysInPeriod - day + 1
  const blocks = limitedBlocks(items, (budget) => {
    const daily = dailyBudgetMetrics(budget, data, today)
    const availableLine = daily.remainingToday < 0
      ? `Terlewati hari ini: *${money(-daily.remainingToday)}*`
      : `Masih tersedia hari ini: *${money(daily.remainingToday)}*`
    return `• *${budget.name}*\n  Batas aman hari ini: *${money(daily.availableToday)}*\n  Sudah dipakai hari ini: ${money(daily.spentToday)}\n  ${availableLine}\n  Sisa bulanan: ${money(budget.remaining)}`
  })
  return [
    '🎯 *PANDUAN BUDGET HARI INI*',
    ...blocks,
    `_Dihitung dari sisa budget dan ${daysRemaining} hari tersisa, termasuk hari ini._`,
  ].join('\n\n')
}

function dailyBudgetMetrics(budget, data, today) {
  const [year, month, day] = today.split('-').map(Number)
  const daysInPeriod = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const daysRemaining = daysInPeriod - day + 1
  const spentToday = data.transactions.reduce((total, item) => {
    if (itemDate(item) !== today || !assignedToBudget(item, budget)) return total
    return total + expenseValue(item)
  }, 0)
  const spentBeforeToday = Math.max(budget.spent - spentToday, 0)
  const guidance = calculateAdaptiveBudget({
    amount: number(budget.amount),
    spent: spentBeforeToday,
    daysInPeriod,
    daysRemaining,
    method: budget.method || 'adaptive',
    rolloverPercentage: number(budget.rolloverPercentage),
  })
  return {
    spentToday,
    availableToday: guidance.availableToday,
    remainingToday: guidance.availableToday - spentToday,
  }
}

function upcomingRecurring(data, today, days = 7) {
  const end = new Date(`${today}T00:00:00Z`)
  end.setUTCDate(end.getUTCDate() + days)
  const endKey = end.toISOString().slice(0, 10)
  return data.recurringTransactions.filter((item) => {
    const due = dateKey(item.nextDate || item.date || item.dueDate)
    return item.isActive !== false && normalized(item.type) !== 'pemasukan rutin'
      && due && due >= today && due <= endKey
  })
}

function monthlyPaydays(today, targetDate, incomeDay) {
  if (!validDateKey(today) || !validDateKey(targetDate) || !incomeDay) return []
  const [startYear, startMonth] = today.split('-').map(Number)
  const [endYear, endMonth] = targetDate.split('-').map(Number)
  const dates = []
  let year = startYear
  let month = startMonth
  while (year < endYear || (year === endYear && month <= endMonth)) {
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
    const date = `${year}-${String(month).padStart(2, '0')}-${String(Math.min(incomeDay, lastDay)).padStart(2, '0')}`
    if (date > today && date <= targetDate) dates.push(date)
    month += 1
    if (month === 13) {
      month = 1
      year += 1
    }
  }
  return dates
}

function goalPlanAdviceAnswer(data, plan, today) {
  const goalQuery = plan.goalName || plan.search
  const storedGoal = goalQuery
    ? data.goals.filter((item) => item.isActive !== false && normalized(item.status) !== 'selesai')
      .find((item) => normalized(item.name).includes(normalized(goalQuery)))
    : null
  const targetAmount = number(plan.targetAmount || storedGoal?.target)
  const currentSaved = plan.currentSaved === null || plan.currentSaved === undefined
    ? goalSavedAmount(data, storedGoal) : number(plan.currentSaved)
  const targetDate = plan.targetDate || dateKey(storedGoal?.deadline)
  const recurringIncome = data.recurringTransactions
    .filter((item) => item.isActive !== false && normalized(item.type) === 'pemasukan rutin')
    .reduce((sum, item) => sum + number(item.amount), 0)
  const month = monthBounds(today)
  const recordedIncome = data.transactions.reduce((sum, item) => {
    const date = itemDate(item)
    return date && date >= month.start && date <= month.end ? sum + incomeValue(item) : sum
  }, 0)
  const monthlyIncome = number(plan.monthlyIncome || recurringIncome || recordedIncome)
  const incomeDay = plan.incomeDay || null
  const missing = []
  if (!targetAmount) missing.push('jumlah target')
  if (!targetDate) missing.push('bulan atau tanggal target')
  if (!monthlyIncome) missing.push('pemasukan bulanan')
  if (!incomeDay) missing.push('tanggal menerima pemasukan')
  if (missing.length) {
    return [
      '🎯 *MYOUI • RENCANA TARGET*',
      `Aku masih membutuhkan ${missing.join(', ')} untuk menghitung rencananya.`,
      '_Contoh: “Target Rp20 juta pada Februari 2027, sudah ada Rp4 juta, gaji Rp5,7 juta setiap tanggal 9.”_',
    ].join('\n\n')
  }

  const gap = Math.max(targetAmount - currentSaved, 0)
  if (gap === 0) {
    return [
      '🎯 *MYOUI • RENCANA TARGET*',
      `Target *${money(targetAmount)}* sudah tercapai dari dana terkumpul ${money(currentSaved)}.`,
      'Pertahankan dana tersebut di akun yang terpisah agar tidak terpakai untuk pengeluaran harian.',
    ].join('\n\n')
  }

  const paydays = monthlyPaydays(today, targetDate, incomeDay)
  if (!paydays.length) {
    return [
      '🎯 *MYOUI • RENCANA TARGET*',
      `Tanggal target ${displayDate(targetDate)} sudah terlalu dekat atau telah lewat sebelum jadwal pemasukan berikutnya.`,
      `Kekurangan yang masih harus dikumpulkan: *${money(gap)}*.`,
    ].join('\n\n')
  }

  const requiredSaving = gap / paydays.length
  const maximumSpending = monthlyIncome - requiredSaving
  const monthlyObligations = [...active(data.debts), ...active(data.installments)]
    .reduce((sum, item) => sum + number(item.monthly), 0)
  const title = plan.goalName || storedGoal?.name || `Target ${money(targetAmount)}`
  if (maximumSpending < 0) {
    const shortfall = -maximumSpending
    return [
      '🎯 *MYOUI • RENCANA TARGET*',
      `*${title}*\nTarget ${money(targetAmount)} pada ${displayDate(targetDate)}\nSudah terkumpul ${money(currentSaved)} • Kurang *${money(gap)}*`,
      `Tersisa *${paydays.length} kali gajian* (${displayDate(paydays[0])} sampai ${displayDate(paydays.at(-1))}).`,
      `Kamu perlu menabung *${money(requiredSaving)} setiap gajian*, sedangkan pemasukanmu ${money(monthlyIncome)}. Masih kurang *${money(shortfall)} per bulan* bahkan sebelum pengeluaran.`,
      '*Saran Myoui*\n• Mundurkan tanggal target\n• Kurangi jumlah target awal\n• Tambah pemasukan sebesar kekurangannya',
    ].join('\n\n')
  }

  const recommendedSpending = maximumSpending * 0.9
  const buffer = maximumSpending - recommendedSpending
  const flexibleAfterObligations = recommendedSpending - monthlyObligations
  const notes = [
    `• Pindahkan *${money(requiredSaving)}* ke tabungan setiap tanggal ${incomeDay}`,
    `• Batas pengeluaran maksimal agar tepat target: *${money(maximumSpending)}/bulan*`,
    `• Target pengeluaran yang lebih aman: *${money(recommendedSpending)}/bulan*`,
    `• Sisakan buffer sekitar *${money(buffer)}/bulan*`,
  ]
  if (monthlyObligations) {
    notes.push(`• Dari batas aman tersebut, utang/cicilan tercatat memakai ${money(monthlyObligations)}; sisa untuk pengeluaran lain sekitar *${money(flexibleAfterObligations)}*`)
  }
  const obligationWarning = flexibleAfterObligations < 0
    ? '\n\n⚠️ Kewajiban bulanan yang tercatat lebih besar daripada batas pengeluaran aman. Target perlu diperpanjang atau pemasukan perlu ditambah.'
    : ''

  return [
    '🎯 *MYOUI • RENCANA TARGET*',
    `*${title}*\nTarget ${money(targetAmount)} pada ${displayDate(targetDate)}\nSudah terkumpul ${money(currentSaved)} • Kurang *${money(gap)}*`,
    `*Perhitungannya*\nTersisa ${paydays.length} kali gajian\n${displayDate(paydays[0])} sampai ${displayDate(paydays.at(-1))}\nPemasukan ${money(monthlyIncome)} per gajian`,
    `*Rencana yang kusarankan*\n${notes.join('\n')}${obligationWarning}`,
    `_Asumsi: pemasukan diterima satu kali setiap bulan dan target harus tercapai paling lambat ${displayDate(targetDate)}._`,
  ].join('\n\n')
}

function financialAdviceAnswer(data, plan, today) {
  if (plan.adviceType === 'goal_plan') return goalPlanAdviceAnswer(data, plan, today)
  const accounts = data.accounts.filter((item) => item.isActive !== false)
  const selectedAccount = plan.account
    ? accounts.find((item) => normalized(item.name).includes(normalized(plan.account)))
    : null
  const totalBalance = accounts.reduce((sum, item) => sum + number(item.currentBalance), 0)
  const availableBalance = selectedAccount ? number(selectedAccount.currentBalance) : totalBalance
  const month = monthBounds(today)
  const monthTransactions = data.transactions.filter((item) => {
    const date = itemDate(item)
    return date && date >= month.start && date <= month.end
  })
  const income = monthTransactions.reduce((sum, item) => sum + incomeValue(item), 0)
  const expense = monthTransactions.reduce((sum, item) => sum + expenseValue(item), 0)
  const cashflow = income - expense
  const budgets = currentBudgets(data, today)
  const budgetQuery = plan.budget || (plan.topics.includes('budgets') ? plan.search : '')
  const selectedBudget = budgetQuery
    ? budgets.find((item) => normalized(item.name).includes(normalized(budgetQuery)))
    : null
  const budgetAmount = budgets.reduce((sum, item) => sum + number(item.amount), 0)
  const budgetSpent = budgets.reduce((sum, item) => sum + item.spent, 0)
  const upcoming = upcomingRecurring(data, today)
  const upcomingAmount = upcoming.reduce((sum, item) => sum + number(item.amount), 0)
  const monthlyObligations = [...active(data.debts), ...active(data.installments)]
    .reduce((sum, item) => sum + number(item.monthly), 0)
  const scenarioAmount = number(plan.scenarioAmount)

  if (scenarioAmount > 0) {
    const title = plan.scenarioTitle || 'Rencana pengeluaran'
    const balanceAfter = availableBalance - scenarioAmount
    const afterUpcoming = balanceAfter - upcomingAmount
    const daily = selectedBudget ? dailyBudgetMetrics(selectedBudget, data, today) : null
    const budgetAfter = selectedBudget ? selectedBudget.remaining - scenarioAmount : null
    let verdict = 'CUKUP AMAN'
    let reason = 'Saldo masih mencukupi berdasarkan data yang tersedia.'
    if (scenarioAmount > availableBalance) {
      verdict = 'BELUM AMAN'
      reason = `Nominal rencana lebih besar ${money(scenarioAmount - availableBalance)} daripada saldo yang dihitung.`
    } else if (selectedBudget && scenarioAmount > selectedBudget.remaining) {
      verdict = 'BELUM AMAN'
      reason = `Rencana ini melampaui sisa budget ${selectedBudget.name} sebesar ${money(-budgetAfter)}.`
    } else if (afterUpcoming < 0) {
      verdict = 'BERISIKO'
      reason = `Saldo tidak cukup setelah menyisihkan transaksi rutin tujuh hari ke depan.`
    } else if (daily && scenarioAmount > Math.max(daily.remainingToday, 0)) {
      verdict = 'PERLU DIPERTIMBANGKAN'
      reason = `Nominalnya lebih besar dari panduan tersisa budget ${selectedBudget.name} untuk hari ini.`
    }

    const impacts = [
      `• ${selectedAccount ? `Saldo ${selectedAccount.name}` : 'Total saldo aktif'} setelah rencana: *${money(balanceAfter)}*`,
      ...(selectedBudget ? [`• Sisa budget ${selectedBudget.name}: *${money(budgetAfter)}*`] : []),
      ...(upcomingAmount ? [`• Perlu disisihkan dalam 7 hari: *${money(upcomingAmount)}*`] : []),
      ...(monthlyObligations ? [`• Kewajiban utang/cicilan per bulan: *${money(monthlyObligations)}*`] : []),
    ]
    const suggestions = []
    if (daily && scenarioAmount > Math.max(daily.remainingToday, 0)) {
      suggestions.push(`Jika ingin menjaga ritme budget ${selectedBudget.name}, batas tersisa hari ini sekitar ${money(Math.max(daily.remainingToday, 0))}.`)
    }
    if (upcomingAmount) suggestions.push(`Sisihkan ${money(upcomingAmount)} untuk ${upcoming.length} transaksi rutin yang jatuh tempo dalam tujuh hari.`)
    if (!selectedAccount) suggestions.push('Sebutkan akun sumber dana agar perhitungannya lebih tepat.')
    if (!selectedBudget) suggestions.push('Sebutkan budget yang akan dipakai agar dampaknya pada batas bulanan bisa dihitung.')
    if (!suggestions.length) suggestions.push('Jika rencana dijalankan, catat pengeluarannya ke budget yang sesuai agar panduan berikutnya tetap akurat.')

    return [
      '💡 *MYOUI • CEK RENCANA*',
      `*${title}*\n${money(scenarioAmount)}`,
      `*Dampaknya*\n${impacts.join('\n')}`,
      `*Penilaian Myoui: ${verdict}*\n${reason}`,
      `*Saran*\n${suggestions.slice(0, 3).map((item) => `• ${item}`).join('\n')}`,
      '_Ini hanya simulasi. Belum ada transaksi yang dicatat._',
    ].join('\n\n')
  }

  const facts = [
    `• Total saldo aktif: *${money(totalBalance)}*`,
    `• Arus kas bulan ini: *${money(cashflow)}*`,
    ...(budgetAmount ? [`• Budget terpakai: ${money(budgetSpent)} dari ${money(budgetAmount)}`] : []),
    ...(upcomingAmount ? [`• Jatuh tempo 7 hari: *${money(upcomingAmount)}*`] : []),
    ...(monthlyObligations ? [`• Utang/cicilan per bulan: *${money(monthlyObligations)}*`] : []),
  ]
  const suggestions = []
  const exceeded = budgets.filter((item) => item.remaining < 0)
  const nearLimit = budgets.filter((item) => item.remaining >= 0 && number(item.amount) > 0 && item.spent / number(item.amount) >= 0.8)
  if (cashflow < 0 && income > 0) suggestions.push(`Pengeluaran bulan ini melebihi pemasukan sebesar ${money(-cashflow)}. Tahan pengeluaran pilihan sampai arus kas kembali positif.`)
  if (exceeded.length) suggestions.push(`Hentikan sementara pengeluaran dari budget yang terlampaui: ${exceeded.map((item) => item.name).join(', ')}.`)
  else if (nearLimit.length) suggestions.push(`Perketat budget yang sudah mendekati batas: ${nearLimit.map((item) => item.name).join(', ')}.`)
  if (upcomingAmount) suggestions.push(`Pisahkan ${money(upcomingAmount)} sekarang untuk transaksi rutin tujuh hari ke depan.`)
  if (monthlyObligations) suggestions.push(`Sisihkan kewajiban utang dan cicilan bulanan sebesar ${money(monthlyObligations)} sebelum pengeluaran pilihan.`)
  if (!budgets.length) suggestions.push('Buat budget untuk pengeluaran yang paling sering agar Myoui dapat menghitung batas harian.')
  if (!suggestions.length) suggestions.push('Kondisi saat ini cukup terkendali. Pertahankan pencatatan dan periksa kembali sebelum pengeluaran besar.')

  return [
    '💡 *MYOUI • SARAN KEUANGAN*',
    `*Kondisi yang kulihat*\n${facts.slice(0, 5).join('\n')}`,
    `*Prioritas yang kusarankan*\n${suggestions.slice(0, 3).map((item, index) => `${index + 1}. ${item}`).join('\n')}`,
    '_Kamu bisa menyebutkan rencana, nominal, akun, dan budget untuk simulasi yang lebih spesifik._',
  ].join('\n\n')
}

function accountsAnswer(data, plan) {
  let items = data.accounts.filter((item) => item.isActive !== false)
  items = searched(items, plan.search || plan.account, [(item) => item.name, (item) => item.type])
  if (!items.length) return 'Belum ada akun aktif yang cocok.'
  const total = items.reduce((sum, item) => sum + number(item.currentBalance), 0)
  return [
    '💰 *SALDO AKUN*',
    ...limitedBlocks(items, (item) => `• *${item.name}*\n  ${money(item.currentBalance)}`),
    `*Total saldo*\n${money(total)}`,
  ].join('\n\n')
}

function budgetsAnswer(data, plan, today) {
  let items = currentBudgets(data, today)
  items = searched(items, plan.search, [(item) => item.name])
  if (!items.length) return `Belum ada budget ${plan.search ? `yang cocok dengan “${plan.search}” ` : ''}untuk ${monthLabel(today)}.`
  if (plan.budgetView === 'daily' || plan.mode === 'advice') return dailyBudgetAnswer(items, data, today)
  const amount = items.reduce((sum, item) => sum + number(item.amount), 0)
  const spent = items.reduce((sum, item) => sum + item.spent, 0)
  const blocks = limitedBlocks(items, (item) => {
    const used = number(item.amount) ? Math.round(item.spent / number(item.amount) * 100) : 0
    const status = item.remaining < 0 ? `Terlampaui ${money(-item.remaining)}` : `Sisa *${money(item.remaining)}*`
    return `• *${item.name}*\n  ${status} dari ${money(item.amount)}\n  Terpakai ${money(item.spent)} (${used}%)`
  })
  return [`🎯 *BUDGET ${monthLabel(today).toLocaleUpperCase('id-ID')}*`, ...blocks, `*Total budget*\nTerpakai ${money(spent)} • Sisa *${money(amount - spent)}*`].join('\n\n')
}

function obligationAnswer(title, items, plan) {
  let records = active(items).filter((item) => number(item.remaining) > 0)
  records = searched(records, plan.search, [(item) => item.name])
  if (!records.length) return `Belum ada ${title.toLocaleLowerCase('id-ID')} aktif${plan.search ? ' yang cocok' : ''}.`
  const remaining = records.reduce((sum, item) => sum + number(item.remaining), 0)
  const monthly = records.reduce((sum, item) => sum + number(item.monthly), 0)
  return [
    `🤝 *${title.toLocaleUpperCase('id-ID')}*`,
    ...limitedBlocks(records, (item) => `• *${item.name}*\n  Sisa *${money(item.remaining)}*${number(item.monthly) ? ` • ${money(item.monthly)}/bulan` : ''}${item.due ? `\n  Jatuh tempo ${dateKey(item.due) ? displayDate(item.due) : item.due}` : ''}`),
    `*Total sisa*\n${money(remaining)}${monthly ? `\nKewajiban bulanan ${money(monthly)}` : ''}`,
  ].join('\n\n')
}

function recurringAnswer(data, plan) {
  let items = data.recurringTransactions.filter((item) => item.isActive !== false)
  items = searched(items, plan.search, [(item) => item.name || item.title, (item) => item.type, (item) => item.categoryName])
  if (!items.length) return `Belum ada transaksi rutin aktif${plan.search ? ' yang cocok' : ''}.`
  items.sort((a, b) => String(dateKey(a.nextDate || a.date || a.dueDate) || '9999').localeCompare(String(dateKey(b.nextDate || b.date || b.dueDate) || '9999')))
  const expense = items.filter((item) => item.type !== 'Pemasukan rutin').reduce((sum, item) => sum + number(item.amount), 0)
  return [
    '🔁 *TRANSAKSI RUTIN*',
    ...limitedBlocks(items, (item) => `• *${item.name || item.title}*\n  ${money(item.amount)} • ${item.frequency || 'Bulanan'}\n  Berikutnya ${dateKey(item.nextDate || item.date || item.dueDate) ? displayDate(item.nextDate || item.date || item.dueDate) : 'belum diatur'} • ${item.accountName || item.account || 'akun belum dipilih'}`),
    `*Total rutin pengeluaran*\n${money(expense)} per siklus masing-masing`,
  ].join('\n\n')
}

function goalsAnswer(data, plan) {
  let items = data.goals.filter((item) => normalized(item.status) !== 'selesai')
  items = searched(items, plan.search, [(item) => item.name])
  if (!items.length) return `Belum ada target keuangan aktif${plan.search ? ' yang cocok' : ''}.`
  const saved = items.reduce((sum, item) => sum + goalSavedAmount(data, item), 0)
  const target = items.reduce((sum, item) => sum + number(item.target), 0)
  return [
    '🏁 *TARGET KEUANGAN*',
    ...limitedBlocks(items, (item) => {
      const targetValue = number(item.target)
      const itemSaved = goalSavedAmount(data, item)
      const account = linkedGoalAccount(data, item)
      const progress = targetValue ? Math.min(Math.round(itemSaved / targetValue * 100), 100) : 0
      return `• *${item.name}* • ${progress}%\n  ${account ? `Saldo ${account.name}` : 'Dana tercatat'} ${money(itemSaved)} dari ${money(targetValue)}${item.deadline ? `\n  Target ${dateKey(item.deadline) ? displayDate(item.deadline) : item.deadline}` : ''}${account ? '' : '\n  ⚠️ Pilih akun tujuan melalui FinanceMy'}`
    }),
    `*Total saldo akun tujuan*\n${money(saved)} dari ${money(target)}`,
  ].join('\n\n')
}

function transactionMatches(item, plan, start, end) {
  const date = itemDate(item)
  if (!date || date < start || date > end) return false
  if (plan.transactionType === 'expense' && !['expense', 'refund'].includes(item.type)) return false
  if (plan.transactionType === 'income' && item.type !== 'income') return false
  if (plan.transactionType === 'transfer' && item.type !== 'transfer') return false
  if (plan.category && !normalized(transactionCategory(item)).includes(normalized(plan.category))) return false
  if (plan.account && !normalized(transactionAccount(item)).includes(normalized(plan.account))) return false
  const query = normalized(plan.search)
  return !query || [item.title, transactionCategory(item), transactionAccount(item)].some((value) => normalized(value).includes(query))
}

function transactionsAnswer(data, plan, today) {
  const month = monthBounds(today)
  const start = plan.periodStart || month.start
  const end = plan.periodEnd || month.end
  if (start > end) return 'Rentang tanggal pertanyaan tidak valid.'
  const items = data.transactions.filter((item) => transactionMatches(item, plan, start, end))
    .sort((a, b) => String(itemDate(b) || '').localeCompare(String(itemDate(a) || '')))
  if (!items.length) return `Tidak ada transaksi yang cocok pada ${periodLabel(start, end)}.`
  if (plan.mode === 'list') {
    return [
      '🧾 *DAFTAR TRANSAKSI*',
      `_${periodLabel(start, end)}_`,
      ...limitedBlocks(items, (item) => {
        const sign = item.type === 'income' || item.type === 'refund' ? '+' : '-'
        return `• *${item.title || 'Transaksi'}*  ${sign}${money(item.amount)}\n  ${displayDate(itemDate(item))} • ${transactionAccount(item)}`
      }),
    ].join('\n\n')
  }
  const income = items.reduce((sum, item) => sum + incomeValue(item), 0)
  const expense = items.reduce((sum, item) => sum + expenseValue(item), 0)
  const categories = new Map()
  for (const item of items) {
    const value = expenseValue(item)
    if (value) categories.set(transactionCategory(item), Math.max((categories.get(transactionCategory(item)) || 0) + value, 0))
  }
  const top = [...categories.entries()].filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const typeLine = plan.transactionType === 'income'
    ? `Total pemasukan: *${money(income)}*`
    : plan.transactionType === 'expense'
      ? `Total pengeluaran: *${money(expense)}*`
      : `Pemasukan: *${money(income)}*\nPengeluaran: *${money(expense)}*\nSelisih: *${money(income - expense)}*`
  return [
    '🧾 *RINGKASAN TRANSAKSI*',
    `_${periodLabel(start, end)} • ${items.length} transaksi_`,
    typeLine,
    ...(top.length ? [`*Kategori pengeluaran terbesar*\n${top.map(([name, value]) => `• ${name}: ${money(value)}`).join('\n')}`] : []),
  ].join('\n\n')
}

function overviewAnswer(data, today) {
  const month = monthBounds(today)
  const current = data.transactions.filter((item) => {
    const date = itemDate(item)
    return date && date >= month.start && date <= month.end
  })
  const income = current.reduce((sum, item) => sum + incomeValue(item), 0)
  const expense = current.reduce((sum, item) => sum + expenseValue(item), 0)
  const balance = data.accounts.filter((item) => item.isActive !== false).reduce((sum, item) => sum + number(item.currentBalance), 0)
  const budgets = currentBudgets(data, today)
  const budgetAmount = budgets.reduce((sum, item) => sum + number(item.amount), 0)
  const budgetSpent = budgets.reduce((sum, item) => sum + item.spent, 0)
  const obligations = [...active(data.debts), ...active(data.installments)].reduce((sum, item) => sum + number(item.remaining), 0)
  const notes = []
  if (expense > income && income > 0) notes.push(`Pengeluaran bulan ini lebih besar ${money(expense - income)} daripada pemasukan.`)
  const exceeded = budgets.filter((item) => item.remaining < 0)
  if (exceeded.length) notes.push(`${exceeded.length} budget sudah terlampaui: ${exceeded.map((item) => item.name).join(', ')}.`)
  return [
    `📊 *RINGKASAN ${monthLabel(today).toLocaleUpperCase('id-ID')}*`,
    `*Saldo aktif*\n${money(balance)}`,
    `*Arus kas bulan ini*\nPemasukan  ${money(income)}\nPengeluaran  ${money(expense)}\nSelisih  *${money(income - expense)}*`,
    budgets.length ? `*Budget*\nSisa *${money(budgetAmount - budgetSpent)}*` : '*Budget*\nBelum dibuat bulan ini',
    `*Utang & cicilan*\nSisa ${money(obligations)}`,
    ...(notes.length ? [`*Perlu diperhatikan*\n${notes.map((note) => `• ${note}`).join('\n')}`] : []),
  ].join('\n\n')
}

export function answerFinanceQuery(plan, data, today) {
  if (plan.mode === 'advice' && plan.budgetView !== 'daily') {
    const answer = financialAdviceAnswer(data, plan, today)
    return `${answer}\n\n_Myoui • berdasarkan data FinanceMy • ${displayDate(today)}_`
  }
  const answers = plan.topics.map((topic) => {
    if (topic === 'overview') return overviewAnswer(data, today)
    if (topic === 'accounts') return accountsAnswer(data, plan)
    if (topic === 'budgets') return budgetsAnswer(data, plan, today)
    if (topic === 'debts') return obligationAnswer('Utang aktif', data.debts, plan)
    if (topic === 'receivables') return obligationAnswer('Piutang aktif', data.receivables, plan)
    if (topic === 'installments') return obligationAnswer('Cicilan aktif', data.installments, plan)
    if (topic === 'recurring') return recurringAnswer(data, plan)
    if (topic === 'goals') return goalsAnswer(data, plan)
    return transactionsAnswer(data, plan, today)
  })
  const combined = answers.join('\n\n──────────\n\n')
  const shortened = combined.length > 3650
    ? `${combined.slice(0, 3650).replace(/\n[^\n]*$/, '')}\n\n_Buka FinanceMy untuk melihat data lainnya._`
    : combined
  return `${shortened}\n\n_Myoui • data FinanceMy • ${displayDate(today)}_`
}
