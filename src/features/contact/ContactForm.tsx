import { Link } from "@tanstack/react-router";
import { CheckCircle2, LoaderCircle, Send } from "lucide-react";
import { useRef, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { contactSubmissionSchema } from "@/features/contact/contact.schemas";
import { submitContactMessageServerFn } from "@/features/contact/contact.server-fns";
import type {
  ContactPrivacyNotice,
  ContactSubmissionResult,
} from "@/features/contact/contact.types";

type ContactFormProps = Readonly<{
  privacyNotice: ContactPrivacyNotice;
}>;

type ContactDraft = Readonly<{
  acceptedPrivacyNotice: boolean;
  email: string;
  fullName: string;
  message: string;
  phone: string;
  website: string;
}>;

const emptyDraft: ContactDraft = {
  acceptedPrivacyNotice: false,
  email: "",
  fullName: "",
  message: "",
  phone: "",
  website: "",
};

export function ContactForm({ privacyNotice }: ContactFormProps) {
  const formStartedAt = useRef(Date.now());
  const [draft, setDraft] = useState<ContactDraft>(emptyDraft);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [result, setResult] = useState<ContactSubmissionResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function updateField<Key extends keyof ContactDraft>(key: Key, value: ContactDraft[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[key];
      if (key === "email") delete next.phone;
      if (key === "phone") delete next.email;
      return next;
    });
    setIdempotencyKey(null);
    setResult(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const activeIdempotencyKey = idempotencyKey ?? crypto.randomUUID();
    const parsed = contactSubmissionSchema.safeParse({
      acceptedPrivacyNotice: draft.acceptedPrivacyNotice,
      email: draft.email,
      formStartedAt: formStartedAt.current,
      fullName: draft.fullName,
      idempotencyKey: activeIdempotencyKey,
      message: draft.message,
      phone: draft.phone,
      privacyNoticeVersion: privacyNotice.version,
      website: draft.website,
    });

    if (!parsed.success) {
      setFieldErrors(issuesToFieldErrors(parsed.error.issues));
      setResult({
        code: "validation_error",
        message: "İletişim bilgilerini ve mesajını kontrol et.",
        status: "error",
      });
      return;
    }

    setFieldErrors({});
    setIdempotencyKey(activeIdempotencyKey);
    setSubmitting(true);
    setResult(null);

    try {
      const submissionResult = await submitContactMessageServerFn({ data: parsed.data });
      setResult(submissionResult);

      if (submissionResult.status === "error") {
        setFieldErrors(firstMessages(submissionResult.fieldErrors));
        if (
          submissionResult.code === "idempotency_key_reuse" ||
          submissionResult.code === "policy_changed" ||
          submissionResult.code === "validation_error"
        ) {
          setIdempotencyKey(null);
        }
      }
    } catch {
      setResult({
        code: "unavailable",
        message:
          "Mesaj yanıtı alınamadı. Bilgilerini değiştirmeden aynı gönderim düğmesine tekrar basabilirsin.",
        status: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function startAnotherMessage() {
    formStartedAt.current = Date.now();
    setDraft(emptyDraft);
    setFieldErrors({});
    setIdempotencyKey(null);
    setResult(null);
  }

  if (result?.status === "success") {
    return (
      <div
        className="rounded-[2rem] border border-success/30 bg-success/5 p-6 sm:p-8"
        role="status"
      >
        <CheckCircle2 className="size-8 text-success" aria-hidden="true" />
        <h2 className="mt-4 text-2xl">Mesajın alındı.</h2>
        <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
          Hazel mesajını panelden görebilecek. Bu form randevu oluşturmaz; randevu almak için online
          takvimi kullanabilirsin.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button type="button" className="h-12 rounded-xl px-6" onClick={startAnotherMessage}>
            Yeni mesaj gönder
          </Button>
          <Button className="h-12 rounded-xl px-6" variant="outline" asChild>
            <Link to="/randevu">Online randevu al</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="rounded-[2rem] border border-border bg-card p-6 shadow-[var(--shadow-atelier)] sm:p-8"
      noValidate
      onSubmit={submit}
    >
      <div>
        <p className="eyebrow">Genel iletişim</p>
        <h2 className="mt-2 text-2xl">Hazel’e mesaj bırak</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Özel bir sorun veya soru için yazabilirsin. Boş saatleri görmek ve randevu oluşturmak için
          online randevu ekranı daha hızlıdır.
        </p>
      </div>

      {result?.status === "error" ? (
        <Alert
          className="mt-6 border-destructive/30 bg-destructive/5"
          variant="destructive"
          aria-live="assertive"
        >
          <AlertTitle>Mesaj gönderilemedi</AlertTitle>
          <AlertDescription>{result.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="mt-7 grid gap-5">
        <Field error={fieldErrors.fullName} id="contact-full-name" label="Ad soyad" required>
          <Input
            id="contact-full-name"
            name="fullName"
            autoComplete="name"
            className="h-12 rounded-xl"
            maxLength={100}
            value={draft.fullName}
            aria-invalid={Boolean(fieldErrors.fullName)}
            aria-describedby={fieldErrors.fullName ? "contact-full-name-error" : undefined}
            onChange={(event) => updateField("fullName", event.target.value)}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            error={fieldErrors.phone}
            id="contact-phone"
            label="Telefon"
            hint="Telefon veya e-postadan en az biri gerekli."
          >
            <Input
              id="contact-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              className="h-12 rounded-xl"
              maxLength={32}
              placeholder="05xx xxx xx xx"
              value={draft.phone}
              aria-invalid={Boolean(fieldErrors.phone)}
              aria-describedby={fieldErrors.phone ? "contact-phone-error" : "contact-phone-hint"}
              onChange={(event) => updateField("phone", event.target.value)}
            />
          </Field>

          <Field
            error={fieldErrors.email}
            id="contact-email"
            label="E-posta"
            hint="Telefon paylaşmak istemezsen e-posta yazabilirsin."
          >
            <Input
              id="contact-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              className="h-12 rounded-xl"
              maxLength={320}
              value={draft.email}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? "contact-email-error" : "contact-email-hint"}
              onChange={(event) => updateField("email", event.target.value)}
            />
          </Field>
        </div>

        <Field error={fieldErrors.message} id="contact-message" label="Mesaj" required>
          <Textarea
            id="contact-message"
            name="message"
            className="min-h-36 resize-y rounded-xl"
            maxLength={3000}
            value={draft.message}
            aria-invalid={Boolean(fieldErrors.message)}
            aria-describedby={fieldErrors.message ? "contact-message-error" : undefined}
            onChange={(event) => updateField("message", event.target.value)}
          />
        </Field>

        <div className="absolute -left-[9999px]" aria-hidden="true">
          <label htmlFor="contact-website">Website</label>
          <input
            id="contact-website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={draft.website}
            onChange={(event) => updateField("website", event.target.value)}
          />
        </div>

        <div>
          <div className="flex items-start gap-3">
            <Checkbox
              id="contact-privacy"
              checked={draft.acceptedPrivacyNotice}
              aria-invalid={Boolean(fieldErrors.acceptedPrivacyNotice)}
              aria-describedby={
                fieldErrors.acceptedPrivacyNotice ? "contact-privacy-error" : undefined
              }
              onCheckedChange={(checked) => updateField("acceptedPrivacyNotice", checked === true)}
            />
            <label htmlFor="contact-privacy" className="text-sm leading-6">
              Mesajımın yanıtlanması için bilgilerimin{" "}
              <Link
                to="/gizlilik"
                className="font-medium text-primary underline underline-offset-4"
              >
                Gizlilik Politikası
              </Link>{" "}
              kapsamında işlenmesini kabul ediyorum.
            </label>
          </div>
          {fieldErrors.acceptedPrivacyNotice ? (
            <p id="contact-privacy-error" className="mt-2 text-sm text-destructive" role="alert">
              {fieldErrors.acceptedPrivacyNotice}
            </p>
          ) : null}
        </div>
      </div>

      <Button
        type="submit"
        className="mt-7 h-12 w-full rounded-xl px-6 sm:w-auto"
        disabled={submitting}
      >
        {submitting ? (
          <>
            <LoaderCircle className="animate-spin" aria-hidden="true" />
            Gönderiliyor
          </>
        ) : (
          <>
            <Send aria-hidden="true" />
            Mesajı gönder
          </>
        )}
      </Button>
    </form>
  );
}

function Field({
  children,
  error,
  hint,
  id,
  label,
  required = false,
}: Readonly<{
  children: React.ReactNode;
  error?: string;
  hint?: string;
  id: string;
  label: string;
  required?: boolean;
}>) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-2 text-xs leading-5 text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function issuesToFieldErrors(
  issues: ReadonlyArray<Readonly<{ message: string; path: readonly PropertyKey[] }>>,
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] ??= issue.message;
  }

  return errors;
}

function firstMessages(
  fieldErrors?: Readonly<Record<string, readonly string[]>>,
): Record<string, string> {
  if (!fieldErrors) return {};

  return Object.fromEntries(
    Object.entries(fieldErrors)
      .filter((entry): entry is [string, readonly string[]] => Boolean(entry[1]?.length))
      .map(([key, messages]) => [key, messages[0]]),
  );
}
