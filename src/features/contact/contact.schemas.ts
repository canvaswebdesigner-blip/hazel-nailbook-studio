import { z } from "zod";

import { normalizeTurkishPhoneNumber } from "@/features/booking/booking.schemas";

const plainTextSchema = (minimum: number, maximum: number) =>
  z.preprocess(
    (value) => (typeof value === "string" ? normalizePlainText(value) : value),
    z
      .string()
      .min(minimum)
      .max(maximum)
      .refine((value) => !containsForbiddenControlCharacter(value), "Geçersiz karakter içeriyor."),
  );

const policyVersionSchema = z
  .string()
  .trim()
  .min(1)
  .max(50)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/);

export const contactSubmissionSchema = z
  .object({
    acceptedPrivacyNotice: z.literal(true),
    email: z
      .union([
        z.literal("").transform(() => null),
        z
          .string()
          .trim()
          .email("Geçerli bir e-posta adresi gir.")
          .max(320)
          .transform((value) => value.toLowerCase()),
        z.null(),
      ])
      .optional()
      .transform((value) => value ?? null),
    formStartedAt: z.number().int().positive(),
    fullName: plainTextSchema(2, 100),
    idempotencyKey: z.string().uuid(),
    message: plainTextSchema(10, 3000),
    phone: z
      .union([
        z.literal("").transform(() => null),
        z
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
        z.null(),
      ])
      .optional()
      .transform((value) => value ?? null),
    privacyNoticeVersion: policyVersionSchema,
    website: z.string().max(0),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.phone && !value.email) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Telefon veya e-posta bilgilerinden en az birini gir.",
        path: ["phone"],
      });
    }
  });

function normalizePlainText(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/gu, " ");
}

function containsForbiddenControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && codePoint < 32 && character !== "\n" && character !== "\t";
  });
}
