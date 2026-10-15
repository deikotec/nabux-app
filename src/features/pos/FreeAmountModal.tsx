import { useEffect, useState } from 'react';
import { Calculator, Plus } from 'lucide-react';
import { Button, Field, Input, Modal, NumberInput } from '@/components/ui';
import { FREE_AMOUNT_ITEM_NAME } from '@/config/app';

interface FreeAmountModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (name: string, amount: number) => void;
  currencySymbol: string;
}

/** Captura de un artículo no catalogado (monto libre). */
export function FreeAmountModal({ open, onClose, onAdd, currencySymbol }: FreeAmountModalProps) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setAmount('');
      setTouched(false);
    }
  }, [open]);

  const valid = typeof amount === 'number' && amount > 0;

  const submit = () => {
    setTouched(true);
    if (!valid) return;
    onAdd(name.trim() || FREE_AMOUNT_ITEM_NAME, amount);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Monto libre"
      subtitle="Cobra un artículo o servicio que no está en el catálogo. No descuenta inventario."
      icon={Calculator}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button icon={Plus} onClick={submit} disabled={touched && !valid}>
            Agregar al ticket
          </Button>
        </>
      }
    >
      <div
        className="flex flex-col gap-4"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
            e.preventDefault();
            submit();
          }
        }}
      >
        <Field label="Monto" required error={touched && !valid ? 'Ingresa un monto mayor a cero.' : undefined}>
          <NumberInput
            autoFocus
            data-autofocus
            inputSize="lg"
            prefix={currencySymbol}
            value={amount}
            onValueChange={setAmount}
            placeholder="0.00"
            invalid={touched && !valid}
            aria-label="Monto a cobrar"
          />
        </Field>
        <Field label="Descripción" hint={`Si la dejas vacía se registra como “${FREE_AMOUNT_ITEM_NAME}”.`}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={FREE_AMOUNT_ITEM_NAME} maxLength={80} />
        </Field>
      </div>
    </Modal>
  );
}
