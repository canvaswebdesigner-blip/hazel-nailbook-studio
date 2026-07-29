export type AdminDashboardData = Readonly<{
  cancelledToday: number;
  completedToday: number;
  confirmedToday: number;
  localDate: string;
  nextAppointment:
    | Readonly<{
        bookingCode: string;
        customerName: string;
        customerPhone: string;
        endAt: string;
        id: string;
        serviceName: string;
        startAt: string;
      }>
    | undefined;
  noShowToday: number;
  unreadContactMessages: number;
  unreadNotifications: number;
}>;

export type AdminAppointmentListItem = Readonly<{
  adminNote?: string;
  bookingCode: string;
  currency: string;
  customerEmail?: string;
  customerId: string;
  customerName: string;
  customerNote?: string;
  customerPhone: string;
  endAt: string;
  id: string;
  price?: number;
  priceType: "fixed" | "quote_required" | "starting_from";
  rowVersion: number;
  serviceId: string;
  serviceName: string;
  source: "admin" | "public_booking";
  startAt: string;
  status: "cancelled" | "completed" | "confirmed" | "no_show";
}>;

export type AdminAppointmentListData = Readonly<{
  items: readonly AdminAppointmentListItem[];
  rangeEnd: string;
  rangeStart: string;
  totalCount: number;
}>;

export type AdminServiceItem = Readonly<{
  bufferAfterMinutes: number;
  bufferBeforeMinutes: number;
  category: string;
  coverImagePath?: string;
  currency: string;
  description: string;
  displayOrder: number;
  durationMinutes: number;
  id: string;
  isActive: boolean;
  isBookable: boolean;
  name: string;
  price?: number;
  priceType: "fixed" | "quote_required" | "starting_from";
  rowVersion: number;
  shortDescription: string;
  slug: string;
}>;

export type AdminServiceMutationResult =
  | Readonly<{
      id: string;
      rowVersion: number;
      status: "success";
    }>
  | Readonly<{
      code: "invalid" | "slug_conflict" | "stale" | "unknown";
      message: string;
      status: "error";
    }>;

export type AdminContactMessageItem = Readonly<{
  createdAt: string;
  email?: string;
  fullName: string;
  handledAt?: string;
  id: string;
  message: string;
  phone?: string;
  rowVersion: number;
  status: "in_progress" | "new" | "resolved" | "spam";
}>;

export type AdminContactMessageListData = Readonly<{
  items: readonly AdminContactMessageItem[];
  totalCount: number;
}>;

export type AdminContactStatusMutationResult =
  | Readonly<{
      rowVersion: number;
      status: "success";
    }>
  | Readonly<{
      code: "invalid" | "stale" | "unknown";
      message: string;
      status: "error";
    }>;
