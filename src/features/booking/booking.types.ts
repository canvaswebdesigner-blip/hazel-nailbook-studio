export type BookingPriceType = "fixed" | "starting_from" | "quote_required";

export type BookingPolicy = Readonly<{
  content: string;
  publishedAt: string;
  type: "privacy_notice" | "booking_terms";
  version: string;
}>;

export type BookableService = Readonly<{
  category: string;
  currency: string;
  durationMinutes: number;
  id: string;
  name: string;
  price: string | null;
  priceType: BookingPriceType;
  shortDescription: string;
  slug: string;
}>;

export type BookingBootstrapReady = Readonly<{
  bookingDisabled: false;
  maximumBookingDays: number;
  minimumNoticeMinutes: number;
  policies: Readonly<{
    bookingTerms: BookingPolicy;
    privacyNotice: BookingPolicy;
  }>;
  services: readonly BookableService[];
  slotGranularityMinutes: number;
  status: "ready";
  timezone: "Europe/Istanbul";
}>;

export type BookingBootstrapUnavailable = Readonly<{
  message: string;
  status: "not_configured" | "temporarily_disabled" | "unavailable";
}>;

export type BookingBootstrap = BookingBootstrapReady | BookingBootstrapUnavailable;

export type AvailabilitySlot = Readonly<{
  endAt: string;
  startAt: string;
}>;

export type AvailabilityDay = Readonly<{
  localDate: string;
  slots: readonly AvailabilitySlot[];
}>;

export type BookingAvailability = Readonly<{
  days: readonly AvailabilityDay[];
  nextAvailableDate: string | null;
  timezone: "Europe/Istanbul";
}>;

export type BookingAvailabilityResult =
  | Readonly<{
      availability: BookingAvailability;
      status: "success";
    }>
  | Readonly<{
      code:
        | "booking_disabled"
        | "rate_limited"
        | "service_unavailable"
        | "unavailable"
        | "validation_error";
      fieldErrors?: Readonly<Record<string, readonly string[]>>;
      message: string;
      retryAfterSeconds?: number;
      status: "error";
    }>;

export type BookingCustomer = Readonly<{
  email?: string;
  fullName: string;
  note?: string;
  phone: string;
}>;

export type BookingSubmission = Readonly<{
  acceptedBookingTerms: true;
  acceptedPrivacyNotice: true;
  bookingTermsVersion: string;
  customer: BookingCustomer;
  formStartedAt: number;
  idempotencyKey: string;
  privacyNoticeVersion: string;
  serviceId: string;
  startAt: string;
  website: string;
}>;

export type BookingSuccess = Readonly<{
  appointmentStatus: "cancelled" | "completed" | "confirmed" | "no_show";
  bookingCode: string;
  currency: string;
  durationMinutes: number;
  endAt: string;
  managementExchangeUrl: string | null;
  managementLinkAvailable: boolean;
  priceType: BookingPriceType;
  quotedPrice: string | null;
  receiptExchangeUrl: string | null;
  serviceName: string;
  startAt: string;
  status: "success";
  timezone: "Europe/Istanbul";
}>;

export type BookingFailureCode =
  | "booking_disabled"
  | "idempotency_key_reuse"
  | "not_configured"
  | "policy_changed"
  | "rate_limited"
  | "service_unavailable"
  | "slot_conflict"
  | "unavailable"
  | "validation_error";

export type BookingFailure = Readonly<{
  alternatives?: readonly AvailabilitySlot[];
  code: BookingFailureCode;
  fieldErrors?: Readonly<Record<string, readonly string[]>>;
  message: string;
  retryAfterSeconds?: number;
  status: "error";
}>;

export type CreateBookingResult = BookingSuccess | BookingFailure;

export type AppointmentAccessScope = "appointment_manage" | "receipt_read";

export type AppointmentAccessView = Readonly<{
  accessScope: AppointmentAccessScope;
  address: string | null;
  appointmentStatus: "cancelled" | "completed" | "confirmed" | "no_show";
  bookingCode: string;
  businessName: string;
  canCancel: boolean;
  canReschedule: boolean;
  currency: string;
  durationMinutes: number;
  endAt: string;
  mapUrl: string | null;
  maximumBookingDays: number;
  phone: string | null;
  priceType: BookingPriceType;
  quotedPrice: string | null;
  rowVersion: number;
  serviceId: string;
  serviceName: string;
  sessionAbsoluteExpiresAt: string;
  sessionExpiresAt: string;
  startAt: string;
  timezone: "Europe/Istanbul";
  whatsapp: string | null;
}>;

export type AppointmentAccessResult =
  | Readonly<{
      appointment: AppointmentAccessView;
      status: "ready";
    }>
  | Readonly<{
      message: string;
      status: "invalid" | "unavailable";
    }>;

export type AppointmentManageFailureCode =
  | "deadline_passed"
  | "idempotency_key_reuse"
  | "invalid_session"
  | "rate_limited"
  | "slot_conflict"
  | "stale"
  | "unavailable"
  | "validation_error";

export type AppointmentManageFailure = Readonly<{
  code: AppointmentManageFailureCode;
  fieldErrors?: Readonly<Record<string, readonly string[]>>;
  message: string;
  retryAfterSeconds?: number;
  status: "error";
}>;

export type AppointmentMutationSuccess = Readonly<{
  appointmentStatus: "cancelled" | "completed" | "confirmed" | "no_show";
  canCancel: boolean;
  canReschedule: boolean;
  cancelledAt?: string;
  endAt: string;
  rowVersion: number;
  startAt: string;
  status: "success";
}>;

export type AppointmentMutationResult = AppointmentMutationSuccess | AppointmentManageFailure;

export type AppointmentRescheduleAvailabilityResult =
  | Readonly<{
      availability: BookingAvailability;
      status: "success";
    }>
  | AppointmentManageFailure;

export type BookingStep = 1 | 2 | 3 | 4;

export type BookingFlowState = Readonly<{
  customer: Readonly<{
    acceptedBookingTerms: boolean;
    acceptedPrivacyNotice: boolean;
    email: string;
    fullName: string;
    note: string;
    phone: string;
  }>;
  idempotencyKey: string | null;
  localDate: string | null;
  service: BookableService | null;
  slot: AvailabilitySlot | null;
  step: BookingStep;
}>;
