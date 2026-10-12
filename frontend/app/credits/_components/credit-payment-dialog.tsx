"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getApiErrorMessage } from "@/lib/api";
import { createCreditPayment, getCreditById } from "@/services/credits.service";
import type { CreateCreditPaymentPayload, CreditDto } from "@/types/credits";

type PaymentMethod = CreateCreditPaymentPayload["metodoPago"];

type CreditPaymentDialogProps = {
  credit: CreditDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPaymentSuccess: () => void;
};

function formatMoney(value: number): string {
  return value.toLocaleString("es-GT", {
    style: "currency",
    currency: "GTQ",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function CreditPaymentDialog({
  credit: initialCredit,
  open,
  onOpenChange,
  onPaymentSuccess,
}: CreditPaymentDialogProps) {
  const { user } = useAuth();
  const [credit, setCredit] = useState<CreditDto | null>(initialCredit);
  const [isLoadingCredit, setIsLoadingCredit] = useState(true);
  const [creditLoadError, setCreditLoadError] = useState<string | null>(null);
  const [step, setStep] = useState<"form" | "review">("form");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("EFECTIVO");
  const [reference, setReference] = useState("");
  const [bank, setBank] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submissionInFlight = useRef(false);
  const idempotency = useRef<{ fingerprint: string; key: string } | null>(null);

  useEffect(() => {
    if (!open || !initialCredit) {
      return;
    }

    let active = true;
    void getCreditById(initialCredit.id)
      .then((freshCredit) => {
        if (active) {
          setCredit(freshCredit);
          setCreditLoadError(null);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          const message = getApiErrorMessage(error, "No se pudo actualizar el saldo de la cuenta");
          setCreditLoadError(message);
          toast.error(message);
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingCredit(false);
        }
      });

    return () => {
      active = false;
    };
  }, [initialCredit, open]);

  function handleReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numericAmount = Number(amount);

    if (
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0 ||
      Math.abs(numericAmount * 100 - Math.round(numericAmount * 100)) > 1e-8
    ) {
      toast.error("Ingresa un importe positivo con máximo dos decimales");
      return;
    }

    if (!credit || numericAmount > credit.saldo) {
      toast.error("El importe no puede superar el saldo pendiente vigente");
      return;
    }

    if ((method === "TRANSFERENCIA" || method === "CHEQUE" || method === "POS") && !reference.trim()) {
      toast.error("La referencia es obligatoria para el método seleccionado");
      return;
    }

    if ((method === "TRANSFERENCIA" || method === "CHEQUE") && !bank.trim()) {
      toast.error("El banco es obligatorio para transferencia y cheque");
      return;
    }

    setStep("review");
  }

  async function handleConfirmPayment() {
    if (submissionInFlight.current || !user || !credit) {
      return;
    }

    const payload: CreateCreditPaymentPayload = {
      idUsuario: user.id,
      monto: Number(Number(amount).toFixed(2)),
      metodoPago: method,
      numeroReferencia: reference.trim() || undefined,
      banco: bank.trim() || undefined,
      observaciones: notes.trim() || undefined,
      fechaPago: new Date().toISOString().slice(0, 10),
    };
    const fingerprint = JSON.stringify({ idCredit: credit.id, payload });

    if (!idempotency.current || idempotency.current.fingerprint !== fingerprint) {
      idempotency.current = { fingerprint, key: crypto.randomUUID() };
    }

    submissionInFlight.current = true;
    setIsSubmitting(true);
    try {
      await createCreditPayment(credit.id, payload, idempotency.current.key);
      idempotency.current = null;
      toast.success("Abono registrado correctamente");
      onOpenChange(false);
      onPaymentSuccess();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo registrar el abono"));
      try {
        setCredit(await getCreditById(credit.id));
      } catch (refreshError) {
        toast.error(getApiErrorMessage(refreshError, "No se pudo actualizar el saldo tras el intento"));
      }
    } finally {
      submissionInFlight.current = false;
      setIsSubmitting(false);
    }
  }

  const numericAmount = Number(amount);
  const expectedBalance = credit ? Math.max(0, credit.saldo - numericAmount) : 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isSubmitting) {
          onOpenChange(nextOpen);
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{step === "form" ? "Registrar abono" : "Confirmar abono"}</DialogTitle>
          <DialogDescription>
            {credit
              ? `${credit.cliente.nombre} · Venta #${credit.venta.numeroVenta}`
              : "Selecciona un documento con saldo pendiente"}
          </DialogDescription>
        </DialogHeader>

        {isLoadingCredit ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Actualizando saldo vigente...
          </div>
        ) : creditLoadError ? (
          <div className="space-y-4">
            <p className="text-sm text-destructive">{creditLoadError}</p>
            <p className="text-sm text-muted-foreground">Cierra y vuelve a abrir la cuenta para reintentar.</p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cerrar
              </Button>
            </DialogFooter>
          </div>
        ) : credit ? (
          <>
            <section className="grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Importe original</p>
                <p className="font-semibold">{formatMoney(credit.totalOriginal)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Abonos aplicados</p>
                <p className="font-semibold">{formatMoney(credit.totalAbonado)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Saldo actual</p>
                <p className="font-semibold text-amber-700">{formatMoney(credit.saldo)}</p>
              </div>
            </section>

            {step === "form" ? (
              <form className="space-y-4" onSubmit={handleReview}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="credit-payment-amount">Importe del abono</Label>
                    <Input
                      id="credit-payment-amount"
                      type="number"
                      inputMode="decimal"
                      min="0.01"
                      max={credit.saldo.toFixed(2)}
                      step="0.01"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      required
                      disabled={credit.saldo <= 0 || credit.anulado || credit.venta.anulado}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Método de pago</Label>
                    <Select value={method} onValueChange={(value) => setMethod(value as PaymentMethod)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                        <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
                        <SelectItem value="CHEQUE">Cheque</SelectItem>
                        <SelectItem value="POS">POS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {method !== "EFECTIVO" ? (
                    <div className="space-y-1.5">
                      <Label htmlFor="credit-payment-reference">Referencia</Label>
                      <Input
                        id="credit-payment-reference"
                        value={reference}
                        onChange={(event) => setReference(event.target.value)}
                        maxLength={100}
                        required
                      />
                    </div>
                  ) : null}
                  {method === "TRANSFERENCIA" || method === "CHEQUE" ? (
                    <div className="space-y-1.5">
                      <Label htmlFor="credit-payment-bank">Banco</Label>
                      <Input
                        id="credit-payment-bank"
                        value={bank}
                        onChange={(event) => setBank(event.target.value)}
                        maxLength={100}
                        required
                      />
                    </div>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="credit-payment-notes">Observaciones</Label>
                  <Input
                    id="credit-payment-notes"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    maxLength={255}
                  />
                </div>
                {credit.saldo <= 0 || credit.anulado || credit.venta.anulado ? (
                  <p className="text-sm text-amber-700">
                    Este documento no tiene un saldo habilitado para recibir abonos.
                  </p>
                ) : null}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={credit.saldo <= 0 || credit.anulado || credit.venta.anulado}>
                    Revisar abono
                  </Button>
                </DialogFooter>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="space-y-3 rounded-lg border p-4 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Documento</span>
                    <span className="text-right font-medium">Venta #{credit.venta.numeroVenta}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Abono a registrar</span>
                    <span className="font-semibold">{formatMoney(numericAmount)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Método</span>
                    <span>{method}</span>
                  </div>
                  {reference.trim() ? (
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Referencia</span>
                      <span className="text-right">{reference.trim()}</span>
                    </div>
                  ) : null}
                  {bank.trim() ? (
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Banco</span>
                      <span>{bank.trim()}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between gap-4 border-t pt-3">
                    <span className="font-medium">Saldo estimado después del abono</span>
                    <span className="font-semibold">{formatMoney(expectedBalance)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    El servidor volverá a validar el saldo vigente al confirmar el registro.
                  </p>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setStep("form")} disabled={isSubmitting}>
                    Volver
                  </Button>
                  <Button type="button" onClick={() => void handleConfirmPayment()} disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                    Confirmar abono
                  </Button>
                </DialogFooter>
              </div>
            )}
          </>
        ) : (
          <p className="py-6 text-sm text-muted-foreground">No se pudo cargar la cuenta por cobrar.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
