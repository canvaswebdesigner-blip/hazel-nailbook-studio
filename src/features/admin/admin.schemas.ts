import { z } from "zod";

const nullableOptionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value || null);

export const adminServiceMutationSchema = z
  .object({
    bufferAfterMinutes: z.number().int().min(0).max(240),
    bufferBeforeMinutes: z.number().int().min(0).max(240),
    category: z.string().trim().min(2).max(80),
    coverImagePath: nullableOptionalText(500),
    currency: z
      .string()
      .trim()
      .regex(/^[A-Z]{3}$/),
    description: z.string().trim().min(10).max(5000),
    displayOrder: z.number().int().min(0).max(100_000),
    durationMinutes: z.number().int().min(15).max(720),
    expectedRowVersion: z.number().int().min(0).nullable(),
    id: z.string().uuid().nullable(),
    isActive: z.boolean(),
    isBookable: z.boolean(),
    name: z.string().trim().min(2).max(120),
    price: z.number().min(0).max(99_999_999.99).nullable(),
    priceType: z.enum(["fixed", "starting_from", "quote_required"]),
    shortDescription: z.string().trim().min(10).max(240),
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(160),
  })
  .superRefine((value, context) => {
    if (value.id === null && value.expectedRowVersion !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Yeni hizmette satır sürümü olmamalı.",
        path: ["expectedRowVersion"],
      });
    }
    if (value.id !== null && value.expectedRowVersion === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Düzenlemede satır sürümü gerekli.",
        path: ["expectedRowVersion"],
      });
    }
    if (value.priceType === "quote_required" && value.price !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Görüşülecek fiyat türünde fiyat boş olmalı.",
        path: ["price"],
      });
    }
    if (value.priceType !== "quote_required" && value.price === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Bu fiyat türünde fiyat gerekli.",
        path: ["price"],
      });
    }
  });

export const adminContactStatusMutationSchema = z.object({
  expectedRowVersion: z.number().int().min(0),
  id: z.string().uuid(),
  status: z.enum(["new", "in_progress", "resolved", "spam"]),
});
