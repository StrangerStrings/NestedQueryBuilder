export type TemporalType = 'date' | 'time' | 'datetime'

// Format one local clock snapshot at seconds precision without timezone conversion.
export function temporalDefaults(now: Date): Record<TemporalType, string> {
  // Pad local calendar and clock components to two digits.
  const pad = (value: number) => String(value).padStart(2, '0')
  const date = `${String(now.getFullYear()).padStart(4, '0')}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  return { date, time, datetime: `${date}T${time}` }
}

// Validate exact calendar and clock strings without accepting date-parser normalisation.
export function isValidTemporal(value: string, type: TemporalType): boolean {
  if (type === 'datetime') {
    return (
      value.length === 19 &&
      value[10] === 'T' &&
      isValidTemporal(value.slice(0, 10), 'date') &&
      isValidTemporal(value.slice(11), 'time')
    )
  }
  if (type === 'time') {
    if (value.length !== 8 || !/^\d{2}:\d{2}:\d{2}$/.test(value)) return false
    const [hours = 0, minutes = 0, seconds = 0] = value.split(':').map(Number)
    return hours < 24 && minutes < 60 && seconds < 60
  }
  if (value.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year = 0, month = 0, day = 0] = value.split('-').map(Number)
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return month >= 1 && month <= 12 && day >= 1 && day <= (days[month - 1] ?? 0)
}

