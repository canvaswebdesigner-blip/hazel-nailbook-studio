export type AdminIdentity = Readonly<{
  email: string;
  fullName: string;
  userId: string;
}>;

export type AdminAccessState =
  | Readonly<{ status: "anonymous" }>
  | Readonly<{ status: "forbidden" }>
  | Readonly<{ identity: AdminIdentity; status: "needs_mfa_enrollment" }>
  | Readonly<{
      factorId: string;
      identity: AdminIdentity;
      status: "needs_mfa_verification";
    }>
  | Readonly<{
      absoluteExpiresAt: string;
      identity: AdminIdentity;
      idleExpiresAt: string;
      recentlyReauthenticatedAt: string;
      status: "ready";
    }>
  | Readonly<{ status: "session_expired" }>;

export type AdminLoginResult =
  | Readonly<{ message: string; status: "error" }>
  | Readonly<{ retryAfterSeconds: number; status: "rate_limited" }>
  | Readonly<{
      nextPath: "/admin" | "/admin/mfa" | "/admin/mfa-dogrula";
      status: "success";
    }>;

export type MfaEnrollmentResult =
  | Readonly<{ message: string; status: "error" }>
  | Readonly<{
      factorId: string;
      qrCodeDataUrl: string;
      secret: string;
      status: "success";
    }>;

export type MfaVerificationResult =
  | Readonly<{ message: string; status: "error" }>
  | Readonly<{ nextPath: "/admin"; status: "success" }>;

export type ForgotPasswordResult =
  | Readonly<{ retryAfterSeconds: number; status: "rate_limited" }>
  | Readonly<{ status: "success" }>;

export type ResetPasswordResult =
  | Readonly<{ message: string; status: "error" }>
  | Readonly<{ status: "success" }>;
