import { CalendarDays, MessageCircle } from "lucide-react";

import type {
  AdminAppointmentListData,
  AdminAppointmentListItem,
} from "@/features/admin/admin.types";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const statusLabels: Record<AdminAppointmentListItem["status"], string> = {
  cancelled: "İptal",
  completed: "Tamamlandı",
  confirmed: "Onaylı",
  no_show: "Gelmedi",
};

const statusClasses: Record<AdminAppointmentListItem["status"], string> = {
  cancelled: "border-error/20 bg-error/10 text-error",
  completed: "border-success/20 bg-success/10 text-success",
  confirmed: "border-primary/20 bg-primary/10 text-primary",
  no_show: "border-border bg-muted text-muted-foreground",
};

export function AdminAppointments({ data }: { data: AdminAppointmentListData }) {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow mb-2">Randevular</p>
          <h1 className="font-sans text-2xl font-bold tracking-tight sm:text-3xl">
            Randevu listesi
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Son yedi gün ve önümüzdeki 31 gün içindeki randevular gösteriliyor.
          </p>
        </div>
        <div className="w-fit rounded-full border border-border bg-card px-3 py-2 text-xs font-bold text-muted-foreground">
          {data.totalCount} kayıt
        </div>
      </div>

      {data.items.length === 0 ? (
        <section className="mt-8 rounded-3xl border border-dashed border-border bg-card px-6 py-14 text-center">
          <CalendarDays className="mx-auto size-8 text-muted-foreground" aria-hidden />
          <h2 className="mt-4 text-lg font-bold">Bu tarih aralığında randevu yok.</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Yeni randevular oluştuğunda müşteri, hizmet ve saat bilgileri burada görünecek.
          </p>
        </section>
      ) : (
        <>
          <div className="mt-8 space-y-3 md:hidden">
            {data.items.map((appointment) => (
              <AppointmentCard appointment={appointment} key={appointment.id} />
            ))}
          </div>

          <div className="mt-8 hidden overflow-hidden rounded-3xl border border-border bg-card shadow-atelier md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/35 hover:bg-muted/35">
                  <TableHead className="px-5">Tarih</TableHead>
                  <TableHead>Müşteri</TableHead>
                  <TableHead>Hizmet</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Fiyat</TableHead>
                  <TableHead className="px-5 text-right">İletişim</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((appointment) => (
                  <TableRow key={appointment.id}>
                    <TableCell className="px-5 py-4">
                      <p className="font-semibold">{formatAppointmentDay(appointment.startAt)}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatAppointmentTime(appointment.startAt, appointment.endAt)}
                      </p>
                    </TableCell>
                    <TableCell className="py-4">
                      <p className="font-semibold">{appointment.customerName}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {appointment.bookingCode}
                      </p>
                    </TableCell>
                    <TableCell className="py-4">{appointment.serviceName}</TableCell>
                    <TableCell className="py-4">
                      <StatusBadge status={appointment.status} />
                    </TableCell>
                    <TableCell className="py-4">{formatPrice(appointment)}</TableCell>
                    <TableCell className="px-5 py-4 text-right">
                      <a
                        className="inline-flex size-10 items-center justify-center rounded-xl border border-border text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                        href={createWhatsAppUrl(appointment)}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`${appointment.customerName} kişisine WhatsApp üzerinden yaz`}
                      >
                        <MessageCircle className="size-4" aria-hidden />
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}

function AppointmentCard({ appointment }: { appointment: AdminAppointmentListItem }) {
  return (
    <article className="rounded-2xl border border-border bg-card p-5 shadow-atelier">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-bold">{appointment.customerName}</p>
          <p className="mt-1 text-sm text-primary">{appointment.serviceName}</p>
        </div>
        <StatusBadge status={appointment.status} />
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-4">
        <div>
          <dt className="text-xs font-semibold text-muted-foreground">Tarih</dt>
          <dd className="mt-1 text-sm font-semibold">
            {formatAppointmentDay(appointment.startAt)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-muted-foreground">Saat</dt>
          <dd className="mt-1 text-sm font-semibold">
            {formatAppointmentTime(appointment.startAt, appointment.endAt)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-muted-foreground">Randevu kodu</dt>
          <dd className="mt-1 text-sm">{appointment.bookingCode}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-muted-foreground">Fiyat</dt>
          <dd className="mt-1 text-sm">{formatPrice(appointment)}</dd>
        </div>
      </dl>

      <a
        className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border text-sm font-bold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
        href={createWhatsAppUrl(appointment)}
        target="_blank"
        rel="noreferrer"
      >
        <MessageCircle className="size-4" aria-hidden />
        WhatsApp’tan yaz
      </a>
    </article>
  );
}

function StatusBadge({ status }: { status: AdminAppointmentListItem["status"] }) {
  return (
    <Badge
      variant="outline"
      className={cn("shrink-0 rounded-lg shadow-none", statusClasses[status])}
    >
      {statusLabels[status]}
    </Badge>
  );
}

function formatAppointmentDay(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Istanbul",
    weekday: "short",
  }).format(new Date(value));
}

function formatAppointmentTime(startAt: string, endAt: string) {
  const formatter = new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  });
  return `${formatter.format(new Date(startAt))}–${formatter.format(new Date(endAt))}`;
}

function formatPrice(appointment: AdminAppointmentListItem) {
  if (appointment.priceType === "quote_required") return "Görüşülecek";
  if (appointment.price === undefined) return "Belirtilmedi";

  const formatted = new Intl.NumberFormat("tr-TR", {
    currency: appointment.currency,
    maximumFractionDigits: Number.isInteger(appointment.price) ? 0 : 2,
    style: "currency",
  }).format(appointment.price);

  return appointment.priceType === "starting_from" ? `${formatted} başlangıç` : formatted;
}

function createWhatsAppUrl(appointment: AdminAppointmentListItem) {
  const normalizedPhone = appointment.customerPhone.replace(/\D/g, "");
  const message = encodeURIComponent(
    `Merhaba ${appointment.customerName}, ${appointment.bookingCode} kodlu randevunuzla ilgili yazıyorum.`,
  );
  return `https://wa.me/${normalizedPhone}?text=${message}`;
}
