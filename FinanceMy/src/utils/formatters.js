import { format } from 'date-fns'
import { id } from 'date-fns/locale'

export const formatCurrency = (value = 0) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value))

export const formatCompact = (value = 0) =>
  new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value))

export const formatDate = (date, pattern = 'd MMMM yyyy') => format(new Date(date), pattern, { locale: id })
export const formatInputCurrency = (value) => String(value || '').replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
export const parseCurrency = (value) => Number(String(value || '').replace(/\D/g, ''))
