import "@tanstack/react-start/server-only";

import { z } from "zod";

import {
  adminContactStatusMutationSchema,
  adminServiceMutationSchema,
} from "@/features/admin/admin.schemas";
import type {
  AdminAppointmentListData,
  AdminContactMessageListData,
  AdminContactStatusMutationResult,
  AdminDashboardData,
  AdminServiceItem,
  AdminServiceMutationResult,
} from "@/features/admin/admin.types";
import { createRequestId } from "@/lib/error-capture";
import { createAuthorizedAdminRequestContext } from "@/server/auth/admin-auth.server";

const dashboardRowSchema = z.object({
  cancelled_today: z.coerce.number().int().min(0),
  completed_today: z.coerce.number().int().min(0),
  confirmed_today: z.coerce.number().int().min(0),
  next_appointment_id: z.string().uuid().nullable(),
  next_booking_code: z.string().nullable(),
  next_customer_name: z.string().nullable(),
  next_customer_phone: z.string().nullable(),
  next_end_at: z.string().datetime({ offset: true }).nullable(),
  next_service_name: z.string().nullable(),
  next_start_at: z.string().datetime({ offset: true }).nullable(),
  no_show_today: z.coerce.number().int().min(0),
  unread_contact_messages: z.coerce.number().int().min(0),
  unread_notifications: z.coerce.number().int().min(0),
});

const appointmentRowSchema = z.object({
  admin_note: z.string().nullable(),
  appointment_id: z.string().uuid(),
  booking_code: z.string(),
  currency: z.string().length(3),
  customer_email: z.string().nullable(),
  customer_id: z.string().uuid(),
  customer_name: z.string(),
  customer_note: z.string().nullable(),
  customer_phone: z.string(),
  end_at: z.string().datetime({ offset: true }),
  price_type: z.enum(["fixed", "starting_from", "quote_required"]),
  quoted_price: z.coerce.number().min(0).nullable(),
  row_version: z.coerce.number().int().min(0),
  service_id: z.string().uuid(),
  service_name: z.string(),
  source: z.enum(["public_booking", "admin"]),
  start_at: z.string().datetime({ offset: true }),
  status: z.enum(["confirmed", "completed", "cancelled", "no_show"]),
  total_count: z.coerce.number().int().min(0),
});

const serviceRowSchema = z.object({
  buffer_after_minutes: z.coerce.number().int().min(0).max(240),
  buffer_before_minutes: z.coerce.number().int().min(0).max(240),
  category: z.string(),
  cover_image_path: z.string().nullable(),
  currency: z.string().length(3),
  description: z.string(),
  display_order: z.coerce.number().int().min(0),
  duration_minutes: z.coerce.number().int().min(15).max(720),
  id: z.string().uuid(),
  is_active: z.boolean(),
  is_bookable: z.boolean(),
  name: z.string(),
  price: z.coerce.number().min(0).nullable(),
  price_type: z.enum(["fixed", "starting_from", "quote_required"]),
  row_version: z.coerce.number().int().min(0),
  short_description: z.string(),
  slug: z.string(),
});

const contactMessageRowSchema = z.object({
  created_at: z.string().datetime({ offset: true }),
  email: z.string().nullable(),
  full_name: z.string(),
  handled_at: z.string().datetime({ offset: true }).nullable(),
  id: z.string().uuid(),
  message: z.string(),
  phone_e164: z.string().nullable(),
  row_version: z.coerce.number().int().min(0),
  status: z.enum(["new", "in_progress", "resolved", "spam"]),
});

export async function getAdminDashboard(): Promise<AdminDashboardData> {
  const localDate = getIstanbulLocalDate(new Date());
  const { client } = await createAuthorizedAdminRequestContext();
  const { data, error } = await client.rpc("admin_get_dashboard", {
    p_local_date: localDate,
  });
  if (error) throw new Error("Admin dashboard projection failed");

  const parsed = z.array(dashboardRowSchema).safeParse(data);
  if (!parsed.success || parsed.data.length !== 1) {
    throw new Error("Admin dashboard projection returned an invalid result");
  }

  const row = parsed.data[0];
  const hasNextAppointment =
    row.next_appointment_id &&
    row.next_booking_code &&
    row.next_customer_name &&
    row.next_customer_phone &&
    row.next_service_name &&
    row.next_start_at &&
    row.next_end_at;

  return {
    cancelledToday: row.cancelled_today,
    completedToday: row.completed_today,
    confirmedToday: row.confirmed_today,
    localDate,
    nextAppointment: hasNextAppointment
      ? {
          bookingCode: row.next_booking_code!,
          customerName: row.next_customer_name!,
          customerPhone: row.next_customer_phone!,
          endAt: row.next_end_at!,
          id: row.next_appointment_id!,
          serviceName: row.next_service_name!,
          startAt: row.next_start_at!,
        }
      : undefined,
    noShowToday: row.no_show_today,
    unreadContactMessages: row.unread_contact_messages,
    unreadNotifications: row.unread_notifications,
  };
}

export async function listAdminAppointments(): Promise<AdminAppointmentListData> {
  const now = new Date();
  const rangeStart = new Date(now);
  rangeStart.setUTCDate(rangeStart.getUTCDate() - 7);
  rangeStart.setUTCHours(0, 0, 0, 0);

  const rangeEnd = new Date(now);
  rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 31);
  rangeEnd.setUTCHours(0, 0, 0, 0);

  const { client } = await createAuthorizedAdminRequestContext();
  const { data, error } = await client.rpc("admin_list_appointments", {
    p_limit: 100,
    p_offset: 0,
    p_range_end: rangeEnd.toISOString(),
    p_range_start: rangeStart.toISOString(),
    p_search: null,
    p_status: null,
  });
  if (error) throw new Error("Admin appointment projection failed");

  const parsed = z.array(appointmentRowSchema).safeParse(data);
  if (!parsed.success) {
    throw new Error("Admin appointment projection returned an invalid result");
  }

  return {
    items: parsed.data.map((row) => ({
      adminNote: row.admin_note ?? undefined,
      bookingCode: row.booking_code,
      currency: row.currency,
      customerEmail: row.customer_email ?? undefined,
      customerId: row.customer_id,
      customerName: row.customer_name,
      customerNote: row.customer_note ?? undefined,
      customerPhone: row.customer_phone,
      endAt: row.end_at,
      id: row.appointment_id,
      price: row.quoted_price ?? undefined,
      priceType: row.price_type,
      rowVersion: row.row_version,
      serviceId: row.service_id,
      serviceName: row.service_name,
      source: row.source,
      startAt: row.start_at,
      status: row.status,
    })),
    rangeEnd: rangeEnd.toISOString(),
    rangeStart: rangeStart.toISOString(),
    totalCount: parsed.data[0]?.total_count ?? 0,
  };
}

export async function listAdminServices(): Promise<readonly AdminServiceItem[]> {
  const { client } = await createAuthorizedAdminRequestContext();
  const { data, error } = await client
    .from("services")
    .select(
      "id,name,slug,short_description,description,category,price,price_type,currency,duration_minutes,buffer_before_minutes,buffer_after_minutes,cover_image_path,is_active,is_bookable,display_order,row_version",
    )
    .order("display_order")
    .order("name");
  if (error) throw new Error("Admin service list failed");

  const parsed = z.array(serviceRowSchema).safeParse(data);
  if (!parsed.success) throw new Error("Admin service list returned an invalid result");

  return parsed.data.map((row) => ({
    bufferAfterMinutes: row.buffer_after_minutes,
    bufferBeforeMinutes: row.buffer_before_minutes,
    category: row.category,
    coverImagePath: row.cover_image_path ?? undefined,
    currency: row.currency,
    description: row.description,
    displayOrder: row.display_order,
    durationMinutes: row.duration_minutes,
    id: row.id,
    isActive: row.is_active,
    isBookable: row.is_bookable,
    name: row.name,
    price: row.price ?? undefined,
    priceType: row.price_type,
    rowVersion: row.row_version,
    shortDescription: row.short_description,
    slug: row.slug,
  }));
}

export async function upsertAdminService(input: unknown): Promise<AdminServiceMutationResult> {
  const parsed = adminServiceMutationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      code: "invalid",
      message: "Hizmet bilgilerini kontrol edip tekrar dene.",
      status: "error",
    };
  }

  const service = parsed.data;
  const { client } = await createAuthorizedAdminRequestContext();
  const { data, error } = await client.rpc("admin_upsert_service", {
    p_buffer_after_minutes: service.bufferAfterMinutes,
    p_buffer_before_minutes: service.bufferBeforeMinutes,
    p_category: service.category,
    p_cover_image_path: service.coverImagePath,
    p_currency: service.currency,
    p_description: service.description,
    p_display_order: service.displayOrder,
    p_duration_minutes: service.durationMinutes,
    p_expected_row_version: service.expectedRowVersion,
    p_id: service.id,
    p_is_active: service.isActive,
    p_is_bookable: service.isBookable,
    p_name: service.name,
    p_price: service.price,
    p_price_type: service.priceType,
    p_request_id: createRequestId(),
    p_short_description: service.shortDescription,
    p_slug: service.slug,
  });

  if (error) {
    if (error.code === "40001") {
      return {
        code: "stale",
        message: "Bu hizmet başka bir işlem sırasında güncellendi. Listeyi yenileyip tekrar dene.",
        status: "error",
      };
    }
    if (error.code === "23505") {
      return {
        code: "slug_conflict",
        message: "Bu URL kısa adı başka bir hizmette kullanılıyor.",
        status: "error",
      };
    }
    if (error.code === "22023" || error.code === "23514") {
      return {
        code: "invalid",
        message: "Hizmet bilgileri veritabanı kurallarıyla uyuşmuyor.",
        status: "error",
      };
    }
    return {
      code: "unknown",
      message: "Hizmet kaydedilemedi. Biraz sonra tekrar dene.",
      status: "error",
    };
  }

  const result = z
    .array(
      z.object({
        result_id: z.string().uuid(),
        result_row_version: z.coerce.number().int().min(0),
      }),
    )
    .safeParse(data);

  if (!result.success || result.data.length !== 1) {
    return {
      code: "unknown",
      message: "Hizmet kaydedildi ancak sonuç doğrulanamadı. Listeyi yenile.",
      status: "error",
    };
  }

  return {
    id: result.data[0].result_id,
    rowVersion: result.data[0].result_row_version,
    status: "success",
  };
}

export async function listAdminContactMessages(): Promise<AdminContactMessageListData> {
  const { client } = await createAuthorizedAdminRequestContext();
  const { count, data, error } = await client
    .from("contact_messages")
    .select("id,full_name,phone_e164,email,message,status,handled_at,row_version,created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("Admin contact-message list failed");

  const parsed = z.array(contactMessageRowSchema).safeParse(data);
  if (!parsed.success) throw new Error("Admin contact-message list returned an invalid result");

  return {
    items: parsed.data.map((row) => ({
      createdAt: row.created_at,
      email: row.email ?? undefined,
      fullName: row.full_name,
      handledAt: row.handled_at ?? undefined,
      id: row.id,
      message: row.message,
      phone: row.phone_e164 ?? undefined,
      rowVersion: row.row_version,
      status: row.status,
    })),
    totalCount: count ?? parsed.data.length,
  };
}

export async function updateAdminContactStatus(
  input: unknown,
): Promise<AdminContactStatusMutationResult> {
  const parsed = adminContactStatusMutationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      code: "invalid",
      message: "Mesaj durumu geçerli değil.",
      status: "error",
    };
  }

  const { client } = await createAuthorizedAdminRequestContext();
  const { data, error } = await client.rpc("admin_update_contact_status", {
    p_expected_row_version: parsed.data.expectedRowVersion,
    p_id: parsed.data.id,
    p_request_id: createRequestId(),
    p_status: parsed.data.status,
  });

  if (error) {
    if (error.code === "40001") {
      return {
        code: "stale",
        message: "Bu mesaj başka bir işlem sırasında güncellendi. En son hali yüklendi.",
        status: "error",
      };
    }
    if (error.code === "22023" || error.code === "23514") {
      return {
        code: "invalid",
        message: "Mesaj durumu kaydedilemedi.",
        status: "error",
      };
    }
    return {
      code: "unknown",
      message: "Mesaj durumu şu anda güncellenemedi.",
      status: "error",
    };
  }

  const rowVersion = z.coerce.number().int().min(0).safeParse(data);
  if (!rowVersion.success) {
    return {
      code: "unknown",
      message: "Durum güncellendi ancak sonuç doğrulanamadı. Listeyi yenile.",
      status: "error",
    };
  }

  return { rowVersion: rowVersion.data, status: "success" };
}

function getIstanbulLocalDate(value: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Istanbul",
    year: "numeric",
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
