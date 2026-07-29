import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, Instagram, MapPin, MessageCircle } from "lucide-react";

import { Section, SectionHeading } from "@/components/site/Layout";
import { Button } from "@/components/ui/button";
import { ContactForm } from "@/features/contact/ContactForm";
import { getContactBootstrapServerFn } from "@/features/contact/contact.server-fns";
import { business, businessHours } from "@/lib/content";

const title = "İletişim | Hazel Ağaoğlu Nail Art Studio";
const description = "Hazel Ağaoğlu Nail Art Studio iletişim, konum ve online randevu seçenekleri.";

export const Route = createFileRoute("/iletisim")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  loader: () => getContactBootstrapServerFn(),
  component: ContactPage,
});

function ContactPage() {
  const bootstrap = Route.useLoaderData();

  return (
    <>
      <Section className="pb-8 sm:pb-12">
        <div className="rounded-[2rem] border border-primary/15 bg-primary/[0.045] p-6 sm:p-10">
          <div className="grid items-center gap-6 lg:grid-cols-[1fr_auto]">
            <SectionHeading
              as="h1"
              eyebrow="İletişim"
              title="Randevu için mesaj bekleme."
              description="Hizmetini seç, gerçek müsait saatleri gör ve randevunu online oluştur. Özel bir sorun veya soru için aşağıdaki iletişim formunu kullanabilirsin."
            />
            <Button className="h-13 rounded-xl px-7" asChild>
              <Link to="/randevu">
                <CalendarDays aria-hidden="true" />
                Online randevu al
              </Link>
            </Button>
          </div>
        </div>
      </Section>

      <Section className="pt-8 sm:pt-12">
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div className="space-y-6">
            <div className="rounded-[2rem] border border-border bg-card p-6 sm:p-8">
              <h2 className="text-2xl">Stüdyo bilgileri</h2>
              <ul className="mt-6 space-y-5 text-sm">
                <li className="flex items-start gap-3">
                  <MapPin className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                  <div>
                    <p className="font-medium">Adres</p>
                    <p className="mt-1 text-muted-foreground">{business.address}</p>
                    {business.mapsUrl !== "#" ? (
                      <a
                        href={business.mapsUrl}
                        className="mt-2 inline-flex font-medium text-primary underline underline-offset-4"
                      >
                        Yol tarifi al
                      </a>
                    ) : null}
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <MessageCircle
                    className="mt-0.5 size-5 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="font-medium">Telefon / WhatsApp</p>
                    <p className="mt-1 text-muted-foreground">{business.phoneDisplay}</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Instagram className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                  <div>
                    <p className="font-medium">Instagram</p>
                    {business.instagramUrl === "#" ? (
                      <p className="mt-1 text-muted-foreground">
                        Onaylı profil bağlantısı yayın öncesi eklenecek.
                      </p>
                    ) : (
                      <a
                        href={business.instagramUrl}
                        className="mt-1 inline-flex text-muted-foreground hover:text-foreground"
                      >
                        Profili gör
                      </a>
                    )}
                  </div>
                </li>
              </ul>
            </div>

            <div className="rounded-[2rem] border border-border bg-card p-6 sm:p-8">
              <p className="eyebrow mb-2">Örnek çalışma saatleri</p>
              <p className="mb-4 text-xs leading-5 text-muted-foreground">
                Bu saatler işletme tarafından henüz onaylanmadı ve yayına alınmadan önce
                değiştirilecek.
              </p>
              <ul className="text-sm">
                {businessHours.map((item) => (
                  <li
                    key={item.day}
                    className="flex justify-between gap-4 border-b border-border/60 py-2 last:border-0"
                  >
                    <span className="text-muted-foreground">{item.day}</span>
                    <span>{item.hours}</span>
                  </li>
                ))}
              </ul>
              <div
                className="mt-6 grid aspect-[16/9] place-items-center rounded-2xl border border-dashed border-border bg-muted/60 px-6 text-center text-sm text-muted-foreground"
                role="img"
                aria-label="Harita alanı henüz yapılandırılmadı"
              >
                Harita, gerçek adres ve izin tercihi tamamlandığında yüklenecek.
              </div>
            </div>
          </div>

          {bootstrap.status === "ready" ? (
            <ContactForm privacyNotice={bootstrap.privacyNotice} />
          ) : (
            <div
              className="rounded-[2rem] border border-border bg-card p-6 shadow-[var(--shadow-atelier)] sm:p-8"
              role="status"
            >
              <p className="eyebrow">Genel iletişim</p>
              <h2 className="mt-2 text-2xl">Mesaj formu şu anda kullanılamıyor.</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{bootstrap.message}</p>
              <Button className="mt-6 h-12 rounded-xl px-6" asChild>
                <Link to="/randevu">Online randevuya git</Link>
              </Button>
            </div>
          )}
        </div>
      </Section>
    </>
  );
}
