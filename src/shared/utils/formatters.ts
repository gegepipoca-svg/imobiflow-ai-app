import { parse, format as dfFormat, isValid } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
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
 * Format a date to pt-BR (dd/MM/yyyy).
 *
 * Date-only strings (yyyy-MM-dd) are parsed as LOCAL dates to avoid the
 * UTC-midnight bug where BRT users see the day one off. ISO timestamps with
 * time are parsed normally.
 */
export function formatDate(date: string | Date): string {
  if (typeof date === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const parsed = parse(date, 'yyyy-MM-dd', new Date())
      return isValid(parsed) ? dfFormat(parsed, 'dd/MM/yyyy', { locale: ptBR }) : date
    }
    const d = new Date(date)
    return isValid(d) ? dfFormat(d, 'dd/MM/yyyy', { locale: ptBR }) : date
  }
  return dfFormat(date, 'dd/MM/yyyy', { locale: ptBR })
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
