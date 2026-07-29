import { z } from "zod";

export const adminLoginSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(256),
});

export const mfaVerificationSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[0-9]{6}$/),
  factorId: z.string().uuid(),
});

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
});

export const resetPasswordSchema = z
  .object({
    confirmPassword: z.string(),
    password: z
      .string()
      .min(12)
      .max(128)
      .regex(/[0-9]/)
      .regex(/[A-Za-zÇĞİÖŞÜçğıöşü]/),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
  });
