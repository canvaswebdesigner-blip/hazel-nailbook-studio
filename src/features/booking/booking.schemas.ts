import { z } from "zod";

const uuidSchema = z.string().uuid();
const policyVersionSchema = z
  .string()
  .trim()
  .min(1)
  .max(50)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/);
const localDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isRealIsoDate, "Geçerli bir tarih seç.");
const plainTextSchema = (minimum: number, maximum: number) =>
  z.preprocess(
    (value) => (typeof value === "string" ? normalizePlainText(value) : value),
    z
      .string()
      .min(minimum)
      .max(maximum)
      .refine((value) => !containsForbiddenControlCharacter(value), "Geçersiz karakter içeriyor."),
  );

export const bookingAvailabilityRequestSchema = z
  .object({
    fromDate: localDateSchema,
    serviceId: uuidSchema,
    toDate: localDateSchema,
  })
  .strict()
  .superRefine((value, context) => {
    const from = isoDateToEpochDay(value.fromDate);
    const to = isoDateToEpochDay(value.toDate);
    const dayCount = to - from + 1;

    if (dayCount < 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Bitiş tarihi başlangıç tarihinden önce olamaz.",
        path: ["toDate"],
      });
    } else if (dayCount > 60) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Tek seferde en fazla 60 günlük müsaitlik görüntülenebilir.",
        path: ["toDate"],
      });
    }
  });

export const bookingSubmissionSchema = z
  .object({
    acceptedBookingTerms: z.literal(true),
    acceptedPrivacyNotice: z.literal(true),
    bookingTermsVersion: policyVersionSchema,
    customer: z
      .object({
        email: z
          .union([
            z.literal(""),
            z
              .string()
              .trim()
              .email()
              .max(320)
              .transform((value) => value.toLowerCase()),
          ])
          .optional(),
        fullName: plainTextSchema(2, 80),
        note: z.union([z.literal(""), plainTextSchema(1, 500)]).optional(),
        phone: z
          .string()
          .trim()
          .min(10)
          .max(32)
          .transform((value, context) => {
            const normalized = normalizeTurkishPhoneNumber(value);
            if (!normalized) {
              context.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Geçerli bir Türkiye telefon numarası gir.",
              });
              return z.NEVER;
            }
            return normalized;
          }),
      })
      .strict(),
    formStartedAt: z.number().int().positive(),
    idempotencyKey: uuidSchema,
    privacyNoticeVersion: policyVersionSchema,
    serviceId: uuidSchema,
    startAt: z
      .string()
      .datetime({ offset: true })
      .transform((value) => new Date(value).toISOString()),
    website: z.string().max(0),
  })
  .strict();

export const appointmentRescheduleAvailabilityRequestSchema = z
  .object({
    fromDate: localDateSchema,
    toDate: localDateSchema,
  })
  .strict()
  .superRefine((value, context) => {
    const from = isoDateToEpochDay(value.fromDate);
    const to = isoDateToEpochDay(value.toDate);
    const dayCount = to - from + 1;

    if (dayCount < 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Bitiş tarihi başlangıç tarihinden önce olamaz.",
        path: ["toDate"],
      });
    } else if (dayCount > 60) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Tek seferde en fazla 60 günlük müsaitlik görüntülenebilir.",
        path: ["toDate"],
      });
    }
  });

export const appointmentRescheduleSubmissionSchema = z
  .object({
    expectedRowVersion: z.number().int().nonnegative(),
    idempotencyKey: uuidSchema,
    startAt: z
      .string()
      .datetime({ offset: true })
      .transform((value) => new Date(value).toISOString()),
  })
  .strict();

export const appointmentCancellationSubmissionSchema = z
  .object({
    expectedRowVersion: z.number().int().nonnegative(),
    idempotencyKey: uuidSchema,
    reason: z.union([z.literal(""), plainTextSchema(2, 500)]),
  })
  .strict();

export type BookingAvailabilityRequest = z.infer<typeof bookingAvailabilityRequestSchema>;
export type ValidatedBookingSubmission = z.infer<typeof bookingSubmissionSchema>;

export function normalizeTurkishPhoneNumber(value: string): string | null {
  let digits = value.replace(/\D/g, "");

  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = `90${digits.slice(1)}`;
  if (digits.length === 10) digits = `90${digits}`;

  return /^90[2-9][0-9]{9}$/.test(digits) ? `+${digits}` : null;
}

function containsForbiddenControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined) return false;

    return (
      codePoint <= 0x08 ||
      codePoint === 0x0b ||
      codePoint === 0x0c ||
      (codePoint >= 0x0e && codePoint <= 0x1f) ||
      codePoint === 0x7f
    );
  });
}

function normalizePlainText(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/gu, " ");
}

function isRealIsoDate(value: string): boolean {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!parts) return false;

  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function isoDateToEpochDay(value: string): number {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}
