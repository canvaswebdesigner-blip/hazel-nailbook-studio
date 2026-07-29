import { Link } from "@tanstack/react-router";
import {
  Bell,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleOff,
  Clock3,
  Mail,
  MessageCircle,
  UserRound,
} from "lucide-react";

import type { AdminIdentity } from "@/features/admin-auth/admin-auth.types";
import type { AdminDashboardData } from "@/features/admin/admin.types";
import { Button } from "@/components/ui/button";

export function AdminDashboard({
  data,
  identity,
}: {
  data: AdminDashboardData;
  identity: AdminIdentity;
}) {
  const dateLabel = formatLocalDate(data.localDate);
  const stats = [
    {
      icon: CalendarCheck2,
      label: "Bugün onaylı",
      tone: "bg-primary/10 text-primary",
      value: data.confirmedToday,
    },
    {
      icon: CheckCircle2,
      label: "Tamamlandı",
      tone: "bg-success/10 text-success",
      value: data.completedToday,
    },
    {
      icon: CircleOff,
      label: "İptal",
      tone: "bg-error/10 text-error",
      value: data.cancelledToday,
    },
    {
      icon: UserRound,
      label: "Gelmedi",
      tone: "bg-muted text-muted-foreground",
      value: data.noShowToday,
    },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow mb-2">{dateLabel}</p>
          <h1 className="font-sans text-2xl font-bold tracking-tight sm:text-3xl">
            Hoş geldin, {identity.fullName}.
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Bugünün randevuları, sıradaki müşteri ve bekleyen işler burada.
          </p>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-success/25 bg-success/10 px-3 py-2 text-xs font-bold text-success">
          <CheckCircle2 className="size-4" aria-hidden />
          Güvenli oturum aktif
        </div>
      </div>

      <section aria-label="Bugünün özeti" className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ icon: Icon, label, tone, value }) => (
          <article
            key={label}
            className="rounded-2xl border border-border bg-card p-5 shadow-atelier"
          >
            <div className={`flex size-10 items-center justify-center rounded-xl ${tone}`}>
              <Icon className="size-5" aria-hidden />
            </div>
            <p className="mt-4 text-3xl font-bold tracking-tight">{value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{label}</p>
          </article>
        ))}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(17rem,.65fr)]">
        <section className="rounded-3xl border border-border bg-card p-6 shadow-atelier">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="eyebrow mb-2">Sıradaki müşteri</p>
              <h2 className="text-lg font-bold">Yaklaşan randevu</h2>
            </div>
            <Clock3 className="size-5 text-primary" aria-hidden />
          </div>

          {data.nextAppointment ? (
            <div className="mt-6">
              <p className="text-2xl font-bold">{data.nextAppointment.customerName}</p>
              <p className="mt-1 text-sm font-semibold text-primary">
                {data.nextAppointment.serviceName}
              </p>
              <dl className="mt-5 grid gap-4 rounded-2xl bg-muted/45 p-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold text-muted-foreground">Tarih ve saat</dt>
                  <dd className="mt-1 text-sm font-semibold">
                    {formatAppointmentDateTime(data.nextAppointment.startAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-muted-foreground">Randevu kodu</dt>
                  <dd className="mt-1 text-sm font-semibold">{data.nextAppointment.bookingCode}</dd>
                </div>
              </dl>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button asChild className="rounded-xl">
                  <a
                    href={createWhatsAppUrl(
                      data.nextAppointment.customerPhone,
                      data.nextAppointment.customerName,
                    )}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MessageCircle aria-hidden />
                    WhatsApp’tan yaz
                  </a>
                </Button>
                <Button asChild variant="outline" className="rounded-xl">
                  <Link to="/admin/randevular">
                    Tüm randevular
                    <ChevronRight aria-hidden />
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-dashed border-border px-5 py-8 text-center">
              <CalendarDays className="mx-auto size-7 text-muted-foreground" aria-hidden />
              <p className="mt-3 font-semibold">Yaklaşan onaylı randevu yok.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Yeni bir randevu oluştuğunda burada görünecek.
              </p>
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-border bg-card p-6 shadow-atelier">
          <p className="eyebrow mb-2">Bekleyen işler</p>
          <h2 className="text-lg font-bold">Gelen kutusu</h2>
          <div className="mt-6 space-y-3">
            <StatusLink
              icon={Mail}
              label="Yeni iletişim mesajı"
              to="/admin/mesajlar"
              value={data.unreadContactMessages}
            />
            <StatusLink icon={Bell} label="Okunmamış bildirim" value={data.unreadNotifications} />
          </div>
          <p className="mt-5 text-xs leading-5 text-muted-foreground">
            Mesajlar ve bildirimler için işlem ekranları sonraki operasyon modülünde açılacak.
          </p>
        </section>
      </div>
    </div>
  );
}

function StatusLink({
  icon: Icon,
  label,
  to,
  value,
}: {
  icon: typeof Mail;
  label: string;
  to?: "/admin/mesajlar";
  value: number;
}) {
  const content = (
    <>
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-primary">
        <Icon className="size-4" aria-hidden />
      </div>
      <p className="min-w-0 flex-1 text-sm font-semibold">{label}</p>
      <span className="flex min-w-8 justify-center rounded-full bg-primary px-2 py-1 text-xs font-bold text-primary-foreground">
        {value}
      </span>
    </>
  );

  return to ? (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-2xl border border-border p-4 transition-colors hover:bg-muted/45"
    >
      {content}
    </Link>
  ) : (
    <div className="flex items-center gap-3 rounded-2xl border border-border p-4">{content}</div>
  );
}

function formatLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "full",
    timeZone: "Europe/Istanbul",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function formatAppointmentDateTime(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Istanbul",
  }).format(new Date(value));
}

function createWhatsAppUrl(phone: string, customerName: string) {
  const normalizedPhone = phone.replace(/\D/g, "");
  const message = encodeURIComponent(`Merhaba ${customerName}, randevunuzla ilgili yazıyorum.`);
  return `https://wa.me/${normalizedPhone}?text=${message}`;
}
