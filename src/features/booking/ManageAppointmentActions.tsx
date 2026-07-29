import { ArrowLeft, ArrowRight, CalendarClock, LoaderCircle, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  cancelAppointmentServerFn,
  getAppointmentRescheduleAvailabilityServerFn,
  rescheduleAppointmentServerFn,
} from "@/features/booking/appointment-access.server-fns";
import type {
  AppointmentAccessView,
  AppointmentManageFailure,
  AppointmentMutationSuccess,
  AvailabilityDay,
  AvailabilitySlot,
} from "@/features/booking/booking.types";
import { cn } from "@/lib/utils";

type ManageAppointmentActionsProps = Readonly<{
  appointment: AppointmentAccessView;
  onUpdated: (result: AppointmentMutationSuccess) => void;
}>;

const availabilityWindowDays = 14;

export function ManageAppointmentActions({
  appointment,
  onUpdated,
}: ManageAppointmentActionsProps) {
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (appointment.appointmentStatus !== "confirmed") {
    return (
      <div
        role="status"
        className="rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground"
      >
        Bu randevu artık değiştirilemez. Güncel durumu yukarıda görebilirsin.
      </div>
    );
  }

  if (!appointment.canCancel && !appointment.canReschedule) {
    return (
      <div className="rounded-2xl border border-border bg-background p-4 text-sm">
        <p className="font-semibold">Online işlem süresi doldu</p>
        <p className="mt-1 text-muted-foreground">
          İptal veya tarih değişikliği için Hazel ile doğrudan iletişime geçebilirsin.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-background p-4">
        <p className="font-semibold">Randevu işlemleri</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Müsait başka bir saat seçebilir veya koşullardaki süre dolmadan randevunu iptal
          edebilirsin.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {appointment.canReschedule && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setNotice(null);
                setRescheduleOpen((current) => !current);
              }}
            >
              <CalendarClock aria-hidden="true" />
              Tarihi değiştir
            </Button>
          )}
          {appointment.canCancel && (
            <Button
              type="button"
              variant="outline"
              className="border-destructive/35 text-destructive hover:bg-destructive/5 hover:text-destructive"
              onClick={() => {
                setNotice(null);
                setCancelOpen(true);
              }}
            >
              <XCircle aria-hidden="true" />
              Randevuyu iptal et
            </Button>
          )}
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className="rounded-2xl border border-success/30 bg-success/5 p-4 text-sm text-foreground"
        >
          {notice}
        </div>
      )}

      {rescheduleOpen && (
        <ReschedulePanel
          appointment={appointment}
          onCancel={() => setRescheduleOpen(false)}
          onUpdated={(result) => {
            setRescheduleOpen(false);
            setNotice("Randevu tarihi başarıyla güncellendi.");
            onUpdated(result);
          }}
        />
      )}

      <CancelAppointmentDialog
        appointment={appointment}
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        onUpdated={(result) => {
          setCancelOpen(false);
          setNotice("Randevun iptal edildi.");
          onUpdated(result);
        }}
      />
    </div>
  );
}

function ReschedulePanel({
  appointment,
  onCancel,
  onUpdated,
}: Readonly<{
  appointment: AppointmentAccessView;
  onCancel: () => void;
  onUpdated: (result: AppointmentMutationSuccess) => void;
}>) {
  const today = useMemo(getIstanbulToday, []);
  const lastBookableDate = useMemo(
    () => addIsoDays(today, appointment.maximumBookingDays),
    [appointment.maximumBookingDays, today],
  );
  const [windowStart, setWindowStart] = useState(today);
  const windowEnd = useMemo(
    () => minIsoDate(addIsoDays(windowStart, availabilityWindowDays - 1), lastBookableDate),
    [lastBookableDate, windowStart],
  );
  const [availability, setAvailability] = useState<readonly AvailabilityDay[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<AppointmentManageFailure | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    void getAppointmentRescheduleAvailabilityServerFn({
      data: { fromDate: windowStart, toDate: windowEnd },
    })
      .then((result) => {
        if (!active) return;
        if (result.status === "error") {
          setAvailability([]);
          setSelectedDate(null);
          setSelectedSlot(null);
          setError(result);
          return;
        }

        setAvailability(result.availability.days);
        setSelectedDate((current) => {
          const currentDay = result.availability.days.find(
            (day) => day.localDate === current && hasAlternativeSlot(day, appointment.startAt),
          );
          return (
            currentDay?.localDate ??
            result.availability.days.find((day) => hasAlternativeSlot(day, appointment.startAt))
              ?.localDate ??
            null
          );
        });
        setSelectedSlot((current) => {
          if (
            current &&
            current.startAt !== appointment.startAt &&
            result.availability.days.some((day) =>
              day.slots.some((slot) => slot.startAt === current.startAt),
            )
          ) {
            return current;
          }
          return null;
        });
      })
      .catch(() => {
        if (!active) return;
        setAvailability([]);
        setSelectedDate(null);
        setSelectedSlot(null);
        setError(unavailableFailure());
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [appointment.startAt, windowEnd, windowStart]);

  const selectedDay = availability.find((day) => day.localDate === selectedDate) ?? null;

  async function submitReschedule() {
    if (!selectedSlot || submitting) return;

    const activeIdempotencyKey = idempotencyKey ?? crypto.randomUUID();
    setIdempotencyKey(activeIdempotencyKey);
    setSubmitting(true);
    setError(null);

    try {
      const result = await rescheduleAppointmentServerFn({
        data: {
          expectedRowVersion: appointment.rowVersion,
          idempotencyKey: activeIdempotencyKey,
          startAt: selectedSlot.startAt,
        },
      });
      if (result.status === "success") {
        onUpdated(result);
        return;
      }

      setError(result);
      if (result.code === "slot_conflict" || result.code === "stale") {
        setSelectedSlot(null);
        setIdempotencyKey(null);
      }
    } catch {
      setError(unavailableFailure());
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/[0.035] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl">Yeni tarih ve saat</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Mevcut randevun, yeni saat kesinleşene kadar korunur.
          </p>
        </div>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Kapat
        </Button>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <Button
          type="button"
          className="h-11"
          variant="outline"
          disabled={windowStart <= today || loading}
          onClick={() =>
            setWindowStart(maxIsoDate(today, addIsoDays(windowStart, -availabilityWindowDays)))
          }
        >
          <ArrowLeft aria-hidden="true" />
          Önceki
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          {formatDateRange(windowStart, windowEnd)}
        </p>
        <Button
          type="button"
          className="h-11"
          variant="outline"
          disabled={windowEnd >= lastBookableDate || loading}
          onClick={() => setWindowStart(addIsoDays(windowEnd, 1))}
        >
          Sonraki
          <ArrowRight aria-hidden="true" />
        </Button>
      </div>

      <div className="mt-5" aria-live="polite">
        {loading ? (
          <AvailabilitySkeleton />
        ) : error ? (
          <ManageError failure={error} />
        ) : (
          <>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-3">
              {availability.map((day) => {
                const active = selectedDate === day.localDate;
                const hasAlternatives = hasAlternativeSlot(day, appointment.startAt);
                return (
                  <button
                    key={day.localDate}
                    type="button"
                    aria-pressed={active}
                    disabled={!hasAlternatives}
                    onClick={() => {
                      setSelectedDate(day.localDate);
                      setSelectedSlot(null);
                      setIdempotencyKey(null);
                    }}
                    className={cn(
                      "min-h-20 min-w-24 rounded-xl border px-3 py-2 text-center text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:border-primary/50",
                    )}
                  >
                    <time dateTime={day.localDate}>
                      <span className="block font-semibold">{formatDayName(day.localDate)}</span>
                      <span className="mt-1 block text-xs opacity-80">
                        {formatShortDate(day.localDate)}
                      </span>
                    </time>
                  </button>
                );
              })}
            </div>

            {selectedDay ? (
              <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {selectedDay.slots.map((slot) => {
                  const current = slot.startAt === appointment.startAt;
                  const active = selectedSlot?.startAt === slot.startAt;
                  return (
                    <button
                      key={slot.startAt}
                      type="button"
                      aria-pressed={active}
                      disabled={current}
                      onClick={() => {
                        setSelectedSlot(slot);
                        setIdempotencyKey(null);
                        setError(null);
                      }}
                      className={cn(
                        "min-h-12 rounded-xl border px-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card hover:border-primary/50",
                      )}
                    >
                      {current ? "Mevcut" : formatTime(slot.startAt)}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="mt-4 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
                Bu aralıkta farklı bir müsait saat görünmüyor.
              </p>
            )}
          </>
        )}
      </div>

      <div className="mt-5 flex flex-wrap justify-end gap-3">
        <Button type="button" variant="outline" disabled={submitting} onClick={onCancel}>
          Vazgeç
        </Button>
        <Button
          type="button"
          disabled={!selectedSlot || submitting || Boolean(error)}
          onClick={() => void submitReschedule()}
        >
          {submitting ? (
            <>
              <LoaderCircle className="animate-spin" aria-hidden="true" />
              Güncelleniyor
            </>
          ) : (
            "Yeni saati onayla"
          )}
        </Button>
      </div>
    </div>
  );
}

function CancelAppointmentDialog({
  appointment,
  onOpenChange,
  onUpdated,
  open,
}: Readonly<{
  appointment: AppointmentAccessView;
  onOpenChange: (open: boolean) => void;
  onUpdated: (result: AppointmentMutationSuccess) => void;
  open: boolean;
}>) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<AppointmentManageFailure | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);

  async function submitCancellation() {
    if (submitting) return;

    const activeIdempotencyKey = idempotencyKey ?? crypto.randomUUID();
    setIdempotencyKey(activeIdempotencyKey);
    setSubmitting(true);
    setError(null);

    try {
      const result = await cancelAppointmentServerFn({
        data: {
          expectedRowVersion: appointment.rowVersion,
          idempotencyKey: activeIdempotencyKey,
          reason,
        },
      });
      if (result.status === "success") {
        onUpdated(result);
        return;
      }

      setError(result);
      if (result.code === "stale") setIdempotencyKey(null);
    } catch {
      setError(unavailableFailure());
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (submitting) return;
        onOpenChange(nextOpen);
        if (!nextOpen) {
          setError(null);
          setIdempotencyKey(null);
        }
      }}
    >
      <AlertDialogContent className="max-w-xl rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Randevuyu iptal etmek istediğine emin misin?</AlertDialogTitle>
          <AlertDialogDescription>
            Bu işlemden sonra özel yönetim bağlantın kapatılır. Yeni bir randevu için yeniden müsait
            saat seçmen gerekir.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div>
          <label htmlFor="cancellation-reason" className="text-sm font-semibold">
            İptal nedeni (isteğe bağlı)
          </label>
          <Textarea
            id="cancellation-reason"
            className="mt-2 min-h-24 rounded-xl"
            maxLength={500}
            value={reason}
            disabled={submitting}
            onChange={(event) => {
              setReason(event.target.value);
              setError(null);
              setIdempotencyKey(null);
            }}
          />
        </div>

        {error && <ManageError failure={error} />}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Vazgeç</AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={submitting}
            onClick={() => void submitCancellation()}
          >
            {submitting ? (
              <>
                <LoaderCircle className="animate-spin" aria-hidden="true" />
                İptal ediliyor
              </>
            ) : (
              "Randevuyu iptal et"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ManageError({ failure }: Readonly<{ failure: AppointmentManageFailure }>) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
    >
      <p className="font-semibold text-destructive">İşlem tamamlanamadı</p>
      <p className="mt-1 text-muted-foreground">{failure.message}</p>
    </div>
  );
}

function AvailabilitySkeleton() {
  return (
    <div aria-label="Müsait saatler yükleniyor" className="animate-pulse">
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="h-20 min-w-24 rounded-xl bg-muted" />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="h-12 rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}

function hasAlternativeSlot(day: AvailabilityDay, currentStartAt: string): boolean {
  return day.slots.some((slot) => slot.startAt !== currentStartAt);
}

function unavailableFailure(): AppointmentManageFailure {
  return {
    code: "unavailable",
    message: "Randevu işlemi şu anda tamamlanamıyor. Lütfen biraz sonra tekrar dene.",
    status: "error",
  };
}

function getIstanbulToday(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Istanbul",
    year: "numeric",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addIsoDays(value: string, days: number): string {
  const date = isoDateToUtcDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isoDateToUtcDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function minIsoDate(left: string, right: string): string {
  return left < right ? left : right;
}

function maxIsoDate(left: string, right: string): string {
  return left > right ? left : right;
}

function formatDayName(value: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "UTC",
    weekday: "short",
  }).format(isoDateToUtcDate(value));
}

function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(isoDateToUtcDate(value));
}

function formatDateRange(start: string, end: string): string {
  return `${formatShortDate(start)} – ${formatShortDate(end)}`;
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  }).format(new Date(value));
}
