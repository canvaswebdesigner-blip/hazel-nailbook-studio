export type ContactPrivacyNotice = Readonly<{
  publishedAt: string;
  version: string;
}>;

export type ContactBootstrap =
  | Readonly<{
      privacyNotice: ContactPrivacyNotice;
      status: "ready";
    }>
  | Readonly<{
      message: string;
      status: "not_configured" | "unavailable";
    }>;

export type ContactSubmission = Readonly<{
  acceptedPrivacyNotice: true;
  email: string | null;
  formStartedAt: number;
  fullName: string;
  idempotencyKey: string;
  message: string;
  phone: string | null;
  privacyNoticeVersion: string;
  website: string;
}>;

export type ContactSubmissionResult =
  | Readonly<{
      status: "success";
    }>
  | Readonly<{
      code:
        | "idempotency_key_reuse"
        | "policy_changed"
        | "rate_limited"
        | "unavailable"
        | "validation_error";
      fieldErrors?: Readonly<Record<string, readonly string[]>>;
      message: string;
      retryAfterSeconds?: number;
      status: "error";
    }>;
