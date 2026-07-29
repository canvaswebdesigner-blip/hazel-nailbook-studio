import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Copy,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Section, SectionHeading } from "@/components/site/Layout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatBookingDateTime, formatBookingPrice } from "@/features/booking/booking.formatters";
import { bookingSubmissionSchema } from "@/features/booking/booking.schemas";
import {
  createBookingServerFn,
  getBookingAvailabilityServerFn,
} from "@/features/booking/booking.server-fns";
import type {
  AvailabilityDay,
  AvailabilitySlot,
  BookableService,
  BookingBootstrapReady,
  BookingFailure,
  BookingStep,
  BookingSuccess,
} from "@/features/booking/booking.types";
import { cn } from "@/lib/utils";

type BookingFlowProps = Readonly<{
  bootstrap: BookingBootstrapReady;
  initialServiceSlug?: string;
}>;

type CustomerDraft = Readonly<{
  acceptedBookingTerms: boolean;
  acceptedPrivacyNotice: boolean;
  email: string;
  fullName: string;
  note: string;
  phone: string;
  website: string;
}>;

const steps: ReadonlyArray<Readonly<{ number: BookingStep; title: string }>> = [
  { number: 1, title: "Hizmet" },
  { number: 2, title: "Tarih ve saat" },
  { number: 3, title: "Bilgilerin" },
  { number: 4, title: "Onay" },
];
const emptyCustomer: CustomerDraft = {
  acceptedBookingTerms: false,
  acceptedPrivacyNotice: false,
  email: "",
  fullName: "",
  note: "",
  phone: "",
  website: "",
};
const availabilityWindowDays = 14;

export function BookingFlow({ bootstrap, initialServiceSlug }: BookingFlowProps) {
  const initialService = useMemo(
    () => bootstrap.services.find((service) => service.slug === initialServiceSlug) ?? null,
    [bootstrap.services, initialServiceSlug],
  );
  const today = useMemo(getIstanbulToday, []);
  const lastBookableDate = useMemo(
    () => addIsoDays(today, bootstrap.maximumBookingDays),
    [bootstrap.maximumBookingDays, today],
  );
  const formStartedAt = useRef(Date.now());
  const [step, setStep] = useState<BookingStep>(1);
  const [service, setService] = useState<BookableService | null>(initialService);
  const [windowStart, setWindowStart] = useState(today);
  const [availability, setAvailability] = useState<readonly AvailabilityDay[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<AvailabilitySlot | null>(null);
  const [customer, setCustomer] = useState<CustomerDraft>(emptyCustomer);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submissionError, setSubmissionError] = useState<BookingFailure | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [success, setSuccess] = useState<BookingSuccess | null>(null);

  const windowEnd = useMemo(
    () => minIsoDate(addIsoDays(windowStart, availabilityWindowDays - 1), lastBookableDate),
    [lastBookableDate, windowStart],
  );

  useEffect(() => {
    if (!service || step < 2 || success) return;

    let active = true;
    setAvailabilityLoading(true);
    setAvailabilityError(null);

    void getBookingAvailabilityServerFn({
      data: {
        fromDate: windowStart,
        serviceId: service.id,
        toDate: windowEnd,
      },
    })
      .then((result) => {
        if (!active) return;

        if (result.status === "error") {
          setAvailability([]);
          setSelectedDate(null);
          setSlot(null);
          setAvailabilityError(result.message);
          return;
        }

        setAvailability(result.availability.days);
        setSelectedDate((current) => {
          const currentDay = result.availability.days.find(
            (day) => day.localDate === current && day.slots.length > 0,
          );
          return (
            currentDay?.localDate ??
            result.availability.days.find((day) => day.slots.length > 0)?.localDate ??
            null
          );
        });
        setSlot((current) => {
          if (
            current &&
            result.availability.days.some((day) =>
              day.slots.some((candidate) => candidate.startAt === current.startAt),
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
        setSlot(null);
        setAvailabilityError(
          "Müsait saatler şu anda yüklenemiyor. Lütfen biraz sonra tekrar dene.",
        );
      })
      .finally(() => {
        if (active) setAvailabilityLoading(false);
      });

    return () => {
      active = false;
    };
  }, [service, step, success, windowEnd, windowStart]);

  if (success) {
    return <BookingSuccessPanel result={success} />;
  }

  function chooseService(nextService: BookableService) {
    setService(nextService);
    setStep(1);
    setWindowStart(today);
    setAvailability([]);
    setSelectedDate(null);
    setSlot(null);
    invalidateSubmission();
  }

  function chooseSlot(nextSlot: AvailabilitySlot, localDate: string) {
    setSelectedDate(localDate);
    setSlot(nextSlot);
    invalidateSubmission();
  }

  function updateCustomer<Key extends keyof CustomerDraft>(key: Key, value: CustomerDraft[Key]) {
    setCustomer((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[`customer.${key}`];
      delete next[key];
      return next;
    });
    invalidateSubmission();
  }

  function invalidateSubmission() {
    setIdempotencyKey(null);
    setSubmissionError(null);
  }

  function goToCustomerStep() {
    if (!service || !slot) return;
    setStep(3);
  }

  function goToSummaryStep() {
    const validated = validateDraft();
    if (!validated) return;
    setStep(4);
  }

  function validateDraft(idempotencyKeyOverride = idempotencyKey ?? crypto.randomUUID()) {
    if (!service || !slot) return null;

    const result = bookingSubmissionSchema.safeParse({
      acceptedBookingTerms: customer.acceptedBookingTerms,
      acceptedPrivacyNotice: customer.acceptedPrivacyNotice,
      bookingTermsVersion: bootstrap.policies.bookingTerms.version,
      customer: {
        email: customer.email,
        fullName: customer.fullName,
        note: customer.note,
        phone: customer.phone,
      },
      formStartedAt: formStartedAt.current,
      idempotencyKey: idempotencyKeyOverride,
      privacyNoticeVersion: bootstrap.policies.privacyNotice.version,
      serviceId: service.id,
      startAt: slot.startAt,
      website: customer.website,
    });

    if (!result.success) {
      setFieldErrors(issuesToFieldErrors(result.error.issues));
      setStep(3);
      return null;
    }

    setFieldErrors({});
    return result.data;
  }

  async function submitBooking() {
    if (submitting) return;

    const activeIdempotencyKey = idempotencyKey ?? crypto.randomUUID();
    const payload = validateDraft(activeIdempotencyKey);
    if (!payload) return;

    setIdempotencyKey(activeIdempotencyKey);
    setSubmitting(true);
    setSubmissionError(null);

    try {
      const result = await createBookingServerFn({ data: payload });
      if (result.status === "success") {
        setSuccess(result);
        return;
      }

      setSubmissionError(result);
      if (result.code === "slot_conflict" || result.code === "service_unavailable") {
        setSlot(null);
        setStep(result.code === "service_unavailable" ? 1 : 2);
        setIdempotencyKey(null);
      } else if (result.code === "validation_error") {
        setStep(3);
      }
    } catch {
      setSubmissionError({
        code: "unavailable",
        message: "Randevu yanıtı alınamadı. Aynı bilgileri değiştirmeden tekrar deneyebilirsin.",
        status: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const selectedDay = availability.find((day) => day.localDate === selectedDate) ?? null;

  return (
    <Section>
      <SectionHeading
        as="h1"
        eyebrow="Online randevu"
        title="Sana uygun zamanı seç."
        description="Hizmetini seç, gerçek müsait saatleri gör ve randevunu birkaç adımda oluştur."
      />

      <BookingSteps currentStep={step} onBackToStep={setStep} />

      <div className="mt-10 grid items-start gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.65fr)]">
        <div className="min-w-0 rounded-[2rem] border border-border bg-card p-5 shadow-[var(--shadow-atelier)] sm:p-8">
          {step === 1 && (
            <ServiceStep
              services={bootstrap.services}
              selectedService={service}
              onSelect={chooseService}
              onContinue={() => service && setStep(2)}
            />
          )}

          {step === 2 && service && (
            <DateTimeStep
              availability={availability}
              error={availabilityError}
              lastBookableDate={lastBookableDate}
              loading={availabilityLoading}
              selectedDate={selectedDate}
              selectedDay={selectedDay}
              selectedSlot={slot}
              today={today}
              windowEnd={windowEnd}
              windowStart={windowStart}
              onBack={() => setStep(1)}
              onChooseDate={(date) => {
                setSelectedDate(date);
                setSlot(null);
                invalidateSubmission();
              }}
              onChooseSlot={chooseSlot}
              onContinue={goToCustomerStep}
              onWindowChange={setWindowStart}
            />
          )}

          {step === 3 && service && slot && (
            <CustomerStep
              customer={customer}
              errors={fieldErrors}
              onBack={() => setStep(2)}
              onContinue={goToSummaryStep}
              onUpdate={updateCustomer}
            />
          )}

          {step === 4 && service && slot && (
            <ConfirmationStep
              customer={customer}
              error={submissionError}
              service={service}
              slot={slot}
              submitting={submitting}
              onBack={() => setStep(3)}
              onSubmit={submitBooking}
            />
          )}
        </div>

        <BookingSidebar customer={customer} service={service} slot={slot} step={step} />
      </div>
    </Section>
  );
}

function BookingSteps({
  currentStep,
  onBackToStep,
}: Readonly<{
  currentStep: BookingStep;
  onBackToStep: (step: BookingStep) => void;
}>) {
  return (
    <nav className="mt-8" aria-label="Randevu adımları">
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {steps.map((item) => {
          const completed = item.number < currentStep;
          const current = item.number === currentStep;
          const content = (
            <>
              <span
                className={cn(
                  "grid size-7 place-items-center rounded-full border text-xs font-semibold",
                  current && "border-primary bg-primary text-primary-foreground",
                  completed && "border-primary bg-primary/10 text-primary",
                  !current && !completed && "border-border text-muted-foreground",
                )}
              >
                {completed ? <Check className="size-3.5" aria-hidden="true" /> : item.number}
              </span>
              <span>{item.title}</span>
            </>
          );

          return (
            <li key={item.number}>
              {completed ? (
                <button
                  type="button"
                  className="flex min-h-12 w-full items-center gap-2 rounded-xl border border-border px-3 text-left text-sm transition-colors hover:border-primary/50"
                  onClick={() => onBackToStep(item.number)}
                >
                  {content}
                </button>
              ) : (
                <div
                  aria-current={current ? "step" : undefined}
                  className={cn(
                    "flex min-h-12 items-center gap-2 rounded-xl border px-3 text-sm",
                    current ? "border-primary bg-primary/5" : "border-border text-muted-foreground",
                  )}
                >
                  {content}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function ServiceStep({
  onContinue,
  onSelect,
  selectedService,
  services,
}: Readonly<{
  onContinue: () => void;
  onSelect: (service: BookableService) => void;
  selectedService: BookableService | null;
  services: readonly BookableService[];
}>) {
  return (
    <div>
      <StepHeading
        title="Hizmetini seç"
        description="Fiyat ve süreyi görmeden takvime geçmezsin."
      />
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {services.map((service) => {
          const active = selectedService?.id === service.id;
          return (
            <li key={service.id}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(service)}
                className={cn(
                  "min-h-36 w-full rounded-2xl border bg-background p-5 text-left transition-[border-color,box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "border-primary shadow-[0_0_0_2px_color-mix(in_oklch,var(--primary)_20%,transparent)]"
                    : "border-border hover:-translate-y-0.5 hover:border-primary/50",
                )}
              >
                <span className="text-lg font-semibold">{service.name}</span>
                <span className="mt-2 block text-sm leading-6 text-muted-foreground">
                  {service.shortDescription}
                </span>
                <span className="mt-4 flex flex-wrap gap-x-2 gap-y-1 text-sm">
                  <span>{formatBookingPrice(service)}</span>
                  <span className="text-muted-foreground">{service.durationMinutes} dakika</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-7 flex justify-end">
        <Button
          type="button"
          className="h-12 rounded-xl px-6"
          disabled={!selectedService}
          onClick={onContinue}
        >
          Müsait saatleri gör
          <ArrowRight aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

function DateTimeStep({
  availability,
  error,
  lastBookableDate,
  loading,
  onBack,
  onChooseDate,
  onChooseSlot,
  onContinue,
  onWindowChange,
  selectedDate,
  selectedDay,
  selectedSlot,
  today,
  windowEnd,
  windowStart,
}: Readonly<{
  availability: readonly AvailabilityDay[];
  error: string | null;
  lastBookableDate: string;
  loading: boolean;
  onBack: () => void;
  onChooseDate: (date: string) => void;
  onChooseSlot: (slot: AvailabilitySlot, date: string) => void;
  onContinue: () => void;
  onWindowChange: (date: string) => void;
  selectedDate: string | null;
  selectedDay: AvailabilityDay | null;
  selectedSlot: AvailabilitySlot | null;
  today: string;
  windowEnd: string;
  windowStart: string;
}>) {
  return (
    <div>
      <StepHeading
        title="Tarih ve saat seç"
        description="Yalnızca gerçekten müsait olan saatleri gösteriyoruz."
      />

      <div className="mt-6 flex items-center justify-between gap-3">
        <Button
          type="button"
          className="h-11 rounded-xl"
          variant="outline"
          disabled={windowStart <= today || loading}
          onClick={() =>
            onWindowChange(maxIsoDate(today, addIsoDays(windowStart, -availabilityWindowDays)))
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
          className="h-11 rounded-xl"
          variant="outline"
          disabled={windowEnd >= lastBookableDate || loading}
          onClick={() => onWindowChange(addIsoDays(windowEnd, 1))}
        >
          Sonraki
          <ArrowRight aria-hidden="true" />
        </Button>
      </div>

      <div className="mt-5" aria-live="polite">
        {loading ? (
          <AvailabilitySkeleton />
        ) : error ? (
          <div
            role="alert"
            className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4"
          >
            <p className="font-medium text-destructive">Müsaitlik yüklenemedi</p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          </div>
        ) : (
          <>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-3">
              {availability.map((day) => {
                const active = selectedDate === day.localDate;
                return (
                  <button
                    key={day.localDate}
                    type="button"
                    aria-pressed={active}
                    disabled={day.slots.length === 0}
                    onClick={() => onChooseDate(day.localDate)}
                    className={cn(
                      "min-h-20 min-w-24 rounded-xl border px-3 py-2 text-center text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:border-primary/50",
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
              <div className="mt-5">
                <h3 className="font-semibold">Uygun saatler</h3>
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {selectedDay.slots.map((candidate) => {
                    const active = selectedSlot?.startAt === candidate.startAt;
                    return (
                      <button
                        key={candidate.startAt}
                        type="button"
                        aria-pressed={active}
                        onClick={() => onChooseSlot(candidate, selectedDay.localDate)}
                        className={cn(
                          "min-h-12 rounded-xl border px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background hover:border-primary/50",
                        )}
                      >
                        {formatTime(candidate.startAt)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-border bg-muted/35 p-5 text-sm text-muted-foreground">
                Bu tarih aralığında uygun saat görünmüyor. Sonraki günleri inceleyebilirsin.
              </div>
            )}
          </>
        )}
      </div>

      <StepActions
        continueDisabled={!selectedSlot || loading}
        continueLabel="Bilgilerimi gir"
        onBack={onBack}
        onContinue={onContinue}
      />
    </div>
  );
}

function CustomerStep({
  customer,
  errors,
  onBack,
  onContinue,
  onUpdate,
}: Readonly<{
  customer: CustomerDraft;
  errors: Record<string, string>;
  onBack: () => void;
  onContinue: () => void;
  onUpdate: <Key extends keyof CustomerDraft>(key: Key, value: CustomerDraft[Key]) => void;
}>) {
  return (
    <div>
      <StepHeading
        title="Bilgilerini gir"
        description="Randevu için yalnızca gerekli bilgileri istiyoruz."
      />

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <Field error={errors["customer.fullName"]} id="booking-full-name" label="Ad soyad">
          <Input
            id="booking-full-name"
            className="h-12 rounded-xl"
            autoComplete="name"
            value={customer.fullName}
            aria-invalid={Boolean(errors["customer.fullName"])}
            aria-describedby={errors["customer.fullName"] ? "booking-full-name-error" : undefined}
            onChange={(event) => onUpdate("fullName", event.target.value)}
          />
        </Field>
        <Field error={errors["customer.phone"]} id="booking-phone" label="Telefon">
          <Input
            id="booking-phone"
            className="h-12 rounded-xl"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="05xx xxx xx xx"
            value={customer.phone}
            aria-invalid={Boolean(errors["customer.phone"])}
            aria-describedby={errors["customer.phone"] ? "booking-phone-error" : undefined}
            onChange={(event) => onUpdate("phone", event.target.value)}
          />
        </Field>
        <Field error={errors["customer.email"]} id="booking-email" label="E-posta (isteğe bağlı)">
          <Input
            id="booking-email"
            className="h-12 rounded-xl"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={customer.email}
            aria-invalid={Boolean(errors["customer.email"])}
            aria-describedby={errors["customer.email"] ? "booking-email-error" : undefined}
            onChange={(event) => onUpdate("email", event.target.value)}
          />
        </Field>
        <Field error={errors["customer.note"]} id="booking-note" label="Not (isteğe bağlı)">
          <Textarea
            id="booking-note"
            className="min-h-24 rounded-xl"
            maxLength={500}
            value={customer.note}
            aria-invalid={Boolean(errors["customer.note"])}
            aria-describedby={errors["customer.note"] ? "booking-note-error" : undefined}
            onChange={(event) => onUpdate("note", event.target.value)}
          />
        </Field>
      </div>

      <div className="pointer-events-none absolute -left-[10000px] top-auto h-px w-px overflow-hidden">
        <label htmlFor="booking-website">Website</label>
        <input
          id="booking-website"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={customer.website}
          onChange={(event) => onUpdate("website", event.target.value)}
        />
      </div>

      <div className="mt-6 space-y-4 rounded-2xl border border-border bg-muted/25 p-5">
        <ConsentCheckbox
          checked={customer.acceptedPrivacyNotice}
          error={errors.acceptedPrivacyNotice}
          id="booking-privacy"
          onCheckedChange={(checked) => onUpdate("acceptedPrivacyNotice", checked)}
        >
          <Link
            to="/gizlilik"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Gizlilik bildirimini
          </Link>{" "}
          okudum ve kişisel verilerimin randevu için işlenmesini kabul ediyorum.
        </ConsentCheckbox>
        <ConsentCheckbox
          checked={customer.acceptedBookingTerms}
          error={errors.acceptedBookingTerms}
          id="booking-terms"
          onCheckedChange={(checked) => onUpdate("acceptedBookingTerms", checked)}
        >
          <Link
            to="/randevu-ve-iptal-kosullari"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Randevu ve iptal koşullarını
          </Link>{" "}
          okudum ve kabul ediyorum.
        </ConsentCheckbox>
      </div>

      <StepActions
        continueDisabled={false}
        continueLabel="Randevuyu gözden geçir"
        onBack={onBack}
        onContinue={onContinue}
      />
    </div>
  );
}

function ConfirmationStep({
  customer,
  error,
  onBack,
  onSubmit,
  service,
  slot,
  submitting,
}: Readonly<{
  customer: CustomerDraft;
  error: BookingFailure | null;
  onBack: () => void;
  onSubmit: () => void;
  service: BookableService;
  slot: AvailabilitySlot;
  submitting: boolean;
}>) {
  return (
    <div>
      <StepHeading
        title="Son kez kontrol et"
        description="Onaylamadan önce hizmet, saat ve iletişim bilgilerini gözden geçir."
      />

      <dl className="mt-6 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2">
        <SummaryItem label="Hizmet" value={service.name} />
        <SummaryItem label="Fiyat" value={formatBookingPrice(service)} />
        <SummaryItem
          label="Tarih ve saat"
          value={formatBookingDateTime(slot.startAt, {
            dateStyle: "long",
            timeStyle: "short",
          })}
        />
        <SummaryItem label="Tahmini süre" value={`${service.durationMinutes} dakika`} />
        <SummaryItem label="Ad soyad" value={customer.fullName} />
        <SummaryItem label="Telefon" value={customer.phone} />
      </dl>

      <div className="mt-5 flex gap-3 rounded-2xl border border-border bg-muted/25 p-4 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        <p>
          Onay sırasında müsaitlik sunucuda tekrar kontrol edilir. Bu saat az önce dolduysa randevu
          oluşturulmaz ve sana başka saat seçmen söylenir.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-5 rounded-2xl border border-destructive/30 bg-destructive/5 p-4"
        >
          <p className="font-semibold text-destructive">Randevu oluşturulamadı</p>
          <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
          {error.retryAfterSeconds && (
            <p className="mt-2 text-xs text-muted-foreground">
              Yaklaşık {Math.ceil(error.retryAfterSeconds / 60)} dakika sonra tekrar dene.
            </p>
          )}
        </div>
      )}

      <div className="mt-7 flex flex-wrap justify-between gap-3">
        <Button
          type="button"
          className="h-12 rounded-xl px-5"
          variant="outline"
          disabled={submitting}
          onClick={onBack}
        >
          <ArrowLeft aria-hidden="true" />
          Bilgileri düzenle
        </Button>
        <Button
          type="button"
          className="h-12 rounded-xl px-6"
          disabled={submitting}
          onClick={onSubmit}
        >
          {submitting ? (
            <>
              <LoaderCircle className="animate-spin" aria-hidden="true" />
              Randevu oluşturuluyor
            </>
          ) : (
            <>
              Randevuyu onayla
              <Check aria-hidden="true" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function BookingSidebar({
  customer,
  service,
  slot,
  step,
}: Readonly<{
  customer: CustomerDraft;
  service: BookableService | null;
  slot: AvailabilitySlot | null;
  step: BookingStep;
}>) {
  return (
    <aside className="rounded-[2rem] border border-border bg-card p-6 shadow-[var(--shadow-atelier)] lg:sticky lg:top-28">
      <p className="eyebrow">Randevu özeti</p>
      <dl className="mt-5 space-y-5 text-sm">
        <SidebarItem label="Hizmet" value={service?.name ?? "Henüz seçilmedi"} />
        <SidebarItem
          label="Tarih ve saat"
          value={
            slot
              ? formatBookingDateTime(slot.startAt, {
                  dateStyle: "long",
                  timeStyle: "short",
                })
              : "Henüz seçilmedi"
          }
        />
        <SidebarItem
          label="Fiyat"
          value={service ? formatBookingPrice(service) : "Hizmete göre gösterilecek"}
        />
        {step >= 3 && (
          <SidebarItem
            label="İletişim"
            value={
              customer.fullName || customer.phone ? `${customer.fullName} ${customer.phone}` : "—"
            }
          />
        )}
      </dl>
      <div className="mt-6 flex items-start gap-2 border-t border-border pt-5 text-xs leading-5 text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <p>Randevu, yalnızca son onaydan sonra oluşturulur.</p>
      </div>
    </aside>
  );
}

function BookingSuccessPanel({ result }: Readonly<{ result: BookingSuccess }>) {
  const [copied, setCopied] = useState(false);

  async function copyManagementLink() {
    if (!result.managementExchangeUrl) return;
    try {
      await navigator.clipboard.writeText(result.managementExchangeUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Section>
      <div className="mx-auto max-w-3xl rounded-[2rem] border border-border bg-card p-6 shadow-[var(--shadow-atelier)] sm:p-10">
        <div className="grid size-12 place-items-center rounded-full bg-success/10 text-success">
          <Check className="size-6" aria-hidden="true" />
        </div>
        <div className="mt-5">
          <SectionHeading
            as="h1"
            eyebrow="Randevun onaylandı"
            title="Her şey hazır."
            description={`${result.serviceName} randevun oluşturuldu. Randevu kodunu ve özel yönetim bağlantını güvenli bir yerde sakla.`}
          />
        </div>

        <dl className="mt-7 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2">
          <SummaryItem label="Randevu kodu" value={result.bookingCode} />
          <SummaryItem
            label="Tarih ve saat"
            value={formatBookingDateTime(result.startAt, {
              dateStyle: "long",
              timeStyle: "short",
            })}
          />
          <SummaryItem label="Tahmini süre" value={`${result.durationMinutes} dakika`} />
          <SummaryItem label="Fiyat" value={formatSuccessPrice(result)} />
        </dl>

        {result.managementExchangeUrl && (
          <div className="mt-6 rounded-2xl border border-primary/25 bg-primary/5 p-5">
            <p className="font-semibold">Özel yönetim bağlantın</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Bu bağlantıya sahip olan kişi randevunu yönetebilir. Herkese açık bir yerde paylaşma.
            </p>
            <label className="mt-4 block text-sm font-medium" htmlFor="management-link">
              Bağlantı
            </label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <Input
                id="management-link"
                className="h-12 min-w-0 rounded-xl font-mono text-xs"
                readOnly
                value={result.managementExchangeUrl}
                onFocus={(event) => event.currentTarget.select()}
              />
              <Button
                type="button"
                className="h-12 shrink-0 rounded-xl"
                variant="outline"
                onClick={copyManagementLink}
              >
                <Copy aria-hidden="true" />
                {copied ? "Kopyalandı" : "Kopyala"}
              </Button>
            </div>
          </div>
        )}

        <div className="mt-7 flex flex-wrap gap-3">
          {result.receiptExchangeUrl && (
            <Button className="h-12 rounded-xl px-6" asChild>
              <a href={result.receiptExchangeUrl} rel="noreferrer">
                <CalendarDays aria-hidden="true" />
                Randevu bilgilerimi aç
              </a>
            </Button>
          )}
          <Button className="h-12 rounded-xl px-6" variant="outline" asChild>
            <Link to="/">Ana sayfa</Link>
          </Button>
        </div>
      </div>
    </Section>
  );
}

function StepHeading({ description, title }: Readonly<{ description: string; title: string }>) {
  return (
    <div>
      <h2 className="text-3xl sm:text-4xl">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
        {description}
      </p>
    </div>
  );
}

function StepActions({
  continueDisabled,
  continueLabel,
  onBack,
  onContinue,
}: Readonly<{
  continueDisabled: boolean;
  continueLabel: string;
  onBack: () => void;
  onContinue: () => void;
}>) {
  return (
    <div className="mt-7 flex flex-wrap justify-between gap-3">
      <Button type="button" className="h-12 rounded-xl px-5" variant="outline" onClick={onBack}>
        <ArrowLeft aria-hidden="true" />
        Geri
      </Button>
      <Button
        type="button"
        className="h-12 rounded-xl px-6"
        disabled={continueDisabled}
        onClick={onContinue}
      >
        {continueLabel}
        <ArrowRight aria-hidden="true" />
      </Button>
    </div>
  );
}

function Field({
  children,
  error,
  id,
  label,
}: Readonly<{
  children: React.ReactNode;
  error?: string;
  id: string;
  label: string;
}>) {
  return (
    <div>
      <label className="text-sm font-semibold" htmlFor={id}>
        {label}
      </label>
      <div className="mt-2">{children}</div>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function ConsentCheckbox({
  checked,
  children,
  error,
  id,
  onCheckedChange,
}: Readonly<{
  checked: boolean;
  children: React.ReactNode;
  error?: string;
  id: string;
  onCheckedChange: (checked: boolean) => void;
}>) {
  return (
    <div>
      <div className="flex items-start gap-3">
        <Checkbox
          id={id}
          className="mt-0.5 size-5"
          checked={checked}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          onCheckedChange={(value) => onCheckedChange(value === true)}
        />
        <label htmlFor={id} className="text-sm leading-6 text-muted-foreground">
          {children}
        </label>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 pl-8 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function SummaryItem({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="bg-card p-5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1.5 font-semibold">{value}</dd>
    </div>
  );
}

function SidebarItem({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium text-foreground">{value}</dd>
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
      <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="h-12 rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}

function issuesToFieldErrors(
  issues: readonly Readonly<{ message: string; path: readonly PropertyKey[] }>[],
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const path = issue.path.map(String).join(".");
    if (path && !errors[path]) errors[path] = issue.message;
  }
  return errors;
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

function formatSuccessPrice(result: BookingSuccess): string {
  if (result.priceType === "quote_required") return "Fiyat için görüşelim";
  if (result.quotedPrice === null) return "Fiyat bilgisi yok";

  const value = Number(result.quotedPrice);
  if (!Number.isFinite(value)) return "Fiyat bilgisi yok";
  const formatted = new Intl.NumberFormat("tr-TR", {
    currency: result.currency,
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
    style: "currency",
  }).format(value);
  return result.priceType === "starting_from" ? `${formatted}'den başlayan` : formatted;
}
