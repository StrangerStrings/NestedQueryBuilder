type ValueDataShape = 'single' | 'list' | 'range'

export type ValueDataType =
  'text' | 'number' | 'boolean' | 'date' | 'time' | 'datetime' | 'duration' | 'field'

type ValueInput =
  | { hasValue: false }
  | {
      hasValue: true
      dataShape: ValueDataShape
      dataTypes: ValueDataType[]
    }

export type DatabaseOperator = {
  id: string
  label: string
  description: string
  valueInput: ValueInput
}
