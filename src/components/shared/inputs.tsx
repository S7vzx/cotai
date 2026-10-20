import * as React from 'react'
import { Input } from '@/components/ui/input'
import { maskCnpj, maskMoney, maskPhone, moneyToInput, parseMoney } from '@/lib/masks'
import { cn } from '@/lib/utils'

type BaseProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>

/** Campo de moeda: guarda número (reais), mostra "1.234,56". */
export const MoneyInput = React.forwardRef<
  HTMLInputElement,
  BaseProps & { value: number | null | undefined; onValueChange: (value: number) => void }
>(({ value, onValueChange, className, ...props }, ref) => {
  const [text, setText] = React.useState(moneyToInput(value))
  React.useEffect(() => {
    if (parseMoney(text) !== (value ?? 0)) setText(moneyToInput(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[17px] text-fg-2">R$</span>
      <Input
        ref={ref}
        inputMode="numeric"
        className={cn('tabular pl-11', className)}
        value={text}
        placeholder="0,00"
        onChange={(e) => {
          const masked = maskMoney(e.target.value)
          setText(masked)
          onValueChange(parseMoney(masked))
        }}
        {...props}
      />
    </div>
  )
})
MoneyInput.displayName = 'MoneyInput'

export const PhoneInput = React.forwardRef<HTMLInputElement, BaseProps & { value: string; onValueChange: (value: string) => void }>(
  ({ value, onValueChange, ...props }, ref) => (
    <Input
      ref={ref}
      type="tel"
      inputMode="tel"
      autoComplete="tel-national"
      placeholder="(00) 00000-0000"
      value={value}
      onChange={(e) => onValueChange(maskPhone(e.target.value))}
      {...props}
    />
  ),
)
PhoneInput.displayName = 'PhoneInput'

export const CnpjInput = React.forwardRef<HTMLInputElement, BaseProps & { value: string; onValueChange: (value: string) => void }>(
  ({ value, onValueChange, ...props }, ref) => (
    <Input
      ref={ref}
      inputMode="numeric"
      placeholder="00.000.000/0000-00"
      value={value}
      onChange={(e) => onValueChange(maskCnpj(e.target.value))}
      {...props}
    />
  ),
)
CnpjInput.displayName = 'CnpjInput'
