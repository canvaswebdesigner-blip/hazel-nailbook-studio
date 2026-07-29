import { Link } from "@tanstack/react-router";
import { CalendarDays, Clock3, Copy, MapPin, MessageCircle } from "lucide-react";
import { useState } from "react";

import { Section, SectionHeading } from "@/components/site/Layout";
import { Button } from "@/components/ui/button";
import { ManageAppointmentActions } from "@/features/booking/ManageAppointmentActions";
import { formatBookingDateTime } from "@/features/booking/booking.formatters";
import type {
  AppointmentAccessResult,
  AppointmentAccessView,
  AppointmentMutationSuccess,
} from "@/features/booking/booking.types";

type AppointmentAccessPanelProps = Readonly<{
  mode: "manage" | "receipt";
  result: AppointmentAccessResult;
}>;

const statusLabels: Record<AppointmentAccessView["appointmentStatus"], string> = {
  cancelled: "İptal edildi",
  completed: "Tamamlandı",
  confirmed: "Onaylandı",
  no_show: "Gelmedi",
};

export function AppointmentAccessPanel({ mode, result }: AppointmentAccessPanelProps) {
  if (result.status !== "ready") {
    return (
      <Section>
        <div className="mx-auto max-w-2xl rounded-[2rem] border border-border bg-card p-6 shadow-[var(--shadow-atelier)] sm:p-10">
          <SectionHeading
            as="h1"
            eyebrow="Randevu bağlantısı"
            title={
              result.status === "invalid" ? "Bu bağlantı artık kullanılamıyor" : "Bir sorun oluştu"
            }
            description={result.message}
          />
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/randevu">Yeni randevu al</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/iletisim">İletişim bilgileri</Link>
            </Button>
          </div>
        </div>
      </Section>
    );
  }

  return <ReadyAppointmentAccess mode={mode} appointment={result.appointment} />;
}

function ReadyAppointmentAccess({
  appointment,
  mode,
}: Readonly<{
  appointment: AppointmentAccessView;
  mode: AppointmentAccessPanelProps["mode"];
}>) {
  const [copied, setCopied] = useState(false);
  const [currentAppointment, setCurrentAppointment] = useState(appointment);
  const whatsappUrl = buildWhatsappUrl(currentAppointment);

  async function copyBookingCode() {
    try {
      await navigator.clipboard.writeText(currentAppointment.bookingCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      setCopied(false);
    }
  }

  function applyMutation(result: AppointmentMutationSuccess) {
    setCurrentAppointment((current) => ({
      ...current,
      appointmentStatus: result.appointmentStatus,
      canCancel: result.canCancel,
      canReschedule: result.canReschedule,
      endAt: result.endAt,
      rowVersion: result.rowVersion,
      startAt: result.startAt,
    }));
  }

  return (
    <Section>
      <div className="mx-auto max-w-3xl">
        <SectionHeading
          as="h1"
          eyebrow={mode === "receipt" ? "Randevun alındı" : "Randevunu yönet"}
          title={
            mode === "receipt"
              ? "Randevu bilgilerin hazır."
              : `${currentAppointment.serviceName} randevun`
          }
          description={
            mode === "receipt"
              ? "Bu sayfayı güvenli bir yerde sakla. Özel yönetim bağlantını yalnızca güvendiğin kişilerle paylaş."
              : "Tarih, saat ve durum bilgilerini burada kontrol edebilirsin."
          }
        />

        <div className="mt-8 overflow-hidden rounded-[2rem] border border-border bg-card shadow-[var(--shadow-atelier)]">
          <div className="flex flex-col gap-4 border-b border-border bg-muted/45 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Randevu kodu</p>
              <p className="mt-1 font-mono text-xl font-semibold tracking-[0.16em]">
                {currentAppointment.bookingCode}
              </p>
            </div>
            <Button type="button" variant="outline" onClick={copyBookingCode}>
              <Copy aria-hidden="true" />
              {copied ? "Kopyalandı" : "Kodu kopyala"}
            </Button>
          </div>

          <dl className="grid gap-px bg-border sm:grid-cols-2">
            <AppointmentDetail label="Hizmet" value={currentAppointment.serviceName} />
            <AppointmentDetail
              label="Durum"
              value={statusLabels[currentAppointment.appointmentStatus]}
            />
            <AppointmentDetail
              icon={<CalendarDays aria-hidden="true" />}
              label="Tarih ve saat"
              value={formatBookingDateTime(currentAppointment.startAt, {
                dateStyle: "long",
                timeStyle: "short",
              })}
            />
            <AppointmentDetail
              icon={<Clock3 aria-hidden="true" />}
              label="Tahmini süre"
              value={`${currentAppointment.durationMinutes} dakika`}
            />
            <AppointmentDetail label="Fiyat" value={formatAppointmentPrice(currentAppointment)} />
            <AppointmentDetail
              icon={<MapPin aria-hidden="true" />}
              label="Stüdyo"
              value={currentAppointment.address ?? currentAppointment.businessName}
            />
          </dl>

          <div className="space-y-5 p-6">
            {mode === "manage" && (
              <ManageAppointmentActions
                appointment={currentAppointment}
                onUpdated={applyMutation}
              />
            )}

            <div className="flex flex-wrap gap-3">
              {currentAppointment.mapUrl && (
                <Button variant="outline" asChild>
                  <a href={currentAppointment.mapUrl} target="_blank" rel="noreferrer">
                    <MapPin aria-hidden="true" />
                    Yol tarifi
                  </a>
                </Button>
              )}
              {whatsappUrl && (
                <Button variant="outline" asChild>
                  <a href={whatsappUrl} target="_blank" rel="noreferrer">
                    <MessageCircle aria-hidden="true" />
                    WhatsApp
                  </a>
                </Button>
              )}
              <Button variant="ghost" asChild>
                <Link to="/">Ana sayfa</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

function AppointmentDetail({
  icon,
  label,
  value,
}: Readonly<{
  icon?: React.ReactNode;
  label: string;
  value: string;
}>) {
  return (
    <div className="bg-card p-6">
      <dt className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon && <span className="[&_svg]:size-4">{icon}</span>}
        {label}
      </dt>
      <dd className="mt-2 font-medium text-foreground">{value}</dd>
    </div>
  );
}

function formatAppointmentPrice(appointment: AppointmentAccessView): string {
  if (appointment.priceType === "quote_required") return "Fiyat için görüşelim";
  if (appointment.quotedPrice === null) return "Fiyat bilgisi yok";

  const value = Number(appointment.quotedPrice);
  if (!Number.isFinite(value)) return "Fiyat bilgisi yok";

  const formatted = new Intl.NumberFormat("tr-TR", {
    currency: appointment.currency,
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
    style: "currency",
  }).format(value);
  return appointment.priceType === "starting_from" ? `${formatted}'den başlayan` : formatted;
}

function buildWhatsappUrl(appointment: AppointmentAccessView): string | null {
  if (!appointment.whatsapp) return null;

  const number = appointment.whatsapp.replace(/\D/gu, "");
  const message = [
    `Merhaba, ${appointment.bookingCode} kodlu randevum hakkında bilgi almak istiyorum.`,
    appointment.serviceName,
    formatBookingDateTime(appointment.startAt, {
      dateStyle: "long",
      timeStyle: "short",
    }),
  ].join(" · ");

  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
