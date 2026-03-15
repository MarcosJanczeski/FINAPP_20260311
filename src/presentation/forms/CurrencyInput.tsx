import { useMemo } from 'react';

const MONEY_FORMATTER = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

interface CurrencyInputProps {
  id?: string;
  valueCents: number;
  onChangeCents(value: number): void;
  placeholder?: string;
}

function formatCents(valueCents: number): string {
  const normalized = Number.isFinite(valueCents) ? Math.max(0, Math.trunc(valueCents)) : 0;
  return MONEY_FORMATTER.format(normalized / 100);
}

export function CurrencyInput({
  id,
  valueCents,
  onChangeCents,
  placeholder,
}: CurrencyInputProps) {
  const displayValue = useMemo(() => formatCents(valueCents), [valueCents]);

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      value={displayValue}
      placeholder={placeholder}
      style={{ textAlign: 'right' }}
      onFocus={(event) => {
        const input = event.currentTarget;
        input.select();
        if (input.selectionStart === null || input.selectionEnd === null) {
          const end = input.value.length;
          input.setSelectionRange(end, end);
        }
      }}
      onChange={(event) => {
        const digits = event.target.value.replace(/\D/g, '');
        const cents = digits ? Number.parseInt(digits, 10) : 0;
        onChangeCents(Number.isNaN(cents) ? 0 : cents);
      }}
    />
  );
}

export function formatCurrencyFromCents(valueCents: number): string {
  return `R$ ${formatCents(valueCents)}`;
}
