const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

/**
 * Format a number as Brazilian Real currency.
 * @example formatCurrency(1500.5) => "R$ 1.500,50"
 */
export function formatCurrency(value: number): string {
  return brlFormatter.format(value)
}

/**
 * Convert a decimal to percentage display.
 * @example formatPercentage(0.15) => "15%"
 */
export function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(2).replace(/\.?0+$/, '')}%`
}

/**
 * Format a date string or Date object to pt-BR format.
 * @example formatDate("2024-03-15") => "15/03/2024"
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return dateFormatter.format(d)
}

/**
 * Parse a percentage display string to decimal.
 * @example parsePercentage("15") => 0.15
 */
export function parsePercentage(display: string): number {
  const cleaned = display.replace(/[%\s]/g, '').replace(',', '.')
  return parseFloat(cleaned) / 100
}

/**
 * Parse a Brazilian currency string to number.
 * @example parseCurrency("1.000,50") => 1000.50
 */
export function parseCurrency(display: string): number {
  const cleaned = display
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  return parseFloat(cleaned)
}
