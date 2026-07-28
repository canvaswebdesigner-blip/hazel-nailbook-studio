import { createFileRoute, Link } from "@tanstack/react-router";
import { Instagram, MapPin, MessageCircle } from "lucide-react";

import { Section, SectionHeading, PlaceholderNote } from "@/components/site/Layout";
import { business, businessHours } from "@/lib/content";

const title = "İletişim | Hazel Ağaoğlu Nail Art Studio";
const description =
  "Stüdyo konumu, çalışma saatleri ve iletişim kanalları. Randevu için online takvimi kullanabilirsin.";

export const Route = createFileRoute("/iletisim")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <Section>
      <SectionHeading
        as="h1"
        eyebrow="İletişim"
        title="Bize ulaş"
        description="Randevu oluşturmak için online takvimi kullanman en hızlı yol. Diğer sorular için aşağıdaki kanallardan yazabilirsin."
      />

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-border bg-card p-6">
          <ul className="space-y-5 text-sm">
            <li className="flex items-start gap-3">
              <MapPin className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              <div>
                <p className="font-medium">Adres</p>
                <p className="text-muted-foreground">{business.address}</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <MessageCircle
                className="mt-0.5 size-5 shrink-0 text-primary"
                aria-hidden
              />
              <div>
                <p className="font-medium">Telefon / WhatsApp</p>
                <p className="text-muted-foreground">{business.phoneDisplay}</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <Instagram
                className="mt-0.5 size-5 shrink-0 text-primary"
                aria-hidden
              />
              <div>
                <p className="font-medium">Instagram</p>
                <a
                  href={business.instagramUrl}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Profili gör
                </a>
              </div>
            </li>
          </ul>

          <Link
            to="/randevu"
            className="mt-8 inline-flex h-12 items-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground"
          >
            Online Randevu Al
          </Link>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6">
          <p className="eyebrow mb-4">Çalışma saatleri</p>
          <ul className="text-sm">
            {businessHours.map((h) => (
              <li
                key={h.day}
                className="flex justify-between gap-4 border-b border-border/60 py-2 last:border-0"
              >
                <span className="text-muted-foreground">{h.day}</span>
                <span>{h.hours}</span>
              </li>
            ))}
          </ul>
          <div
            className="mt-6 aspect-[16/10] rounded-2xl border border-dashed border-border bg-muted/60"
            aria-hidden
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Harita, adres bilgisi kesinleştiğinde eklenecek.
          </p>
        </div>
      </div>

      <PlaceholderNote>
        İletişim formu, mesajların güvenli şekilde kaydedilmesi için backend
        aşamasında devreye alınacak.
      </PlaceholderNote>
    </Section>
  );
}
