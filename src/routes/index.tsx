import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarCheck, ShieldCheck, Sparkles } from "lucide-react";

import { Container, Section, SectionHeading } from "@/components/site/Layout";
import { ServiceCard } from "@/components/site/ServiceCard";
import { GalleryGrid } from "@/components/site/GalleryGrid";
import { FaqAccordion } from "@/components/site/FaqAccordion";
import {
  bookingSteps,
  business,
  businessHours,
  faqItems,
  services,
  trustPoints,
} from "@/lib/content";

const title = "Hazel Ağaoğlu Nail Art Studio | Online Randevu";
const description =
  "Buca İzmir'de manikür, kalıcı oje, protez tırnak ve nail art. Uygun saatleri gör, randevunu birkaç adımda online oluştur.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const featured = services.filter((s) => s.featured).slice(0, 4);

  return (
    <>
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_75%_10%,rgba(201,137,152,0.22),transparent_70%)]"
          aria-hidden
        />
        <Container className="relative py-16 sm:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="eyebrow mb-4">{business.district}</p>
              <h1 className="text-balance text-4xl leading-[1.08] sm:text-5xl lg:text-6xl">
                Tırnaklarında sakin, zarif ve sana ait bir detay.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                {business.promise} Mesaj beklemeden, gerçek takvim üzerinden.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/randevu"
                  className="inline-flex h-13 items-center rounded-full bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
                >
                  Uygun Saatleri Gör
                </Link>
                <Link
                  to="/hizmetler"
                  className="inline-flex h-13 items-center rounded-full border border-border px-7 py-3.5 text-sm font-medium transition-colors hover:bg-muted"
                >
                  Hizmetleri İncele
                </Link>
              </div>

              <ul className="mt-10 grid gap-3 sm:grid-cols-3">
                {[
                  { icon: CalendarCheck, text: "7/24 online randevu" },
                  { icon: ShieldCheck, text: "Hijyen odaklı uygulama" },
                  { icon: Sparkles, text: "Kişiye özel tasarım" },
                ].map(({ icon: Icon, text }) => (
                  <li
                    key={text}
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                  >
                    <Icon className="size-4 shrink-0 text-primary" aria-hidden />
                    {text}
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative">
              <div
                className="aspect-[4/5] rounded-[2rem] border border-border bg-gradient-to-br from-[#F3E6E7] via-[#E7DBD6] to-[#C98998]/50 shadow-[var(--shadow-atelier-lg)]"
                aria-hidden
              />
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Stüdyo fotoğrafları yakında eklenecek.
              </p>
            </div>
          </div>
        </Container>
      </section>

      <Section className="border-y border-border bg-card">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <SectionHeading
            eyebrow="Bugünün durumu"
            title="En yakın uygun saatleri randevu ekranında canlı olarak görebilirsin."
            description="Takvim gerçek doluluk üzerinden çalışır; seçtiğin saat başkasına açık kalmaz."
          />
          <div className="rounded-3xl border border-border bg-background p-6">
            <p className="eyebrow mb-4">Çalışma saatleri</p>
            <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
              {businessHours.map((h) => (
                <li
                  key={h.day}
                  className="flex justify-between gap-4 border-b border-border/60 py-1.5"
                >
                  <span className="text-muted-foreground">{h.day}</span>
                  <span>{h.hours}</span>
                </li>
              ))}
            </ul>
            <Link
              to="/randevu"
              className="mt-6 inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
            >
              Randevu Al
            </Link>
          </div>
        </div>
      </Section>

      <Section>
        <SectionHeading
          eyebrow="Hizmetler"
          title="Öne çıkan uygulamalar"
          description="Her hizmetin süresi ve fiyat bilgisi randevu adımında tekrar gösterilir."
        />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((service) => (
            <ServiceCard key={service.slug} service={service} />
          ))}
        </div>
        <Link
          to="/hizmetler"
          className="mt-8 inline-flex h-11 items-center rounded-full border border-border px-5 text-sm font-medium hover:bg-muted"
        >
          Tüm hizmetler
        </Link>
      </Section>

      <Section className="bg-card">
        <SectionHeading
          eyebrow="Nasıl çalışır"
          title="Dört adımda randevu"
        />
        <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {bookingSteps.map((step, i) => (
            <li
              key={step.title}
              className="rounded-3xl border border-border bg-background p-6"
            >
              <span className="font-display text-3xl text-primary">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-3 text-lg">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {step.text}
              </p>
            </li>
          ))}
        </ol>
      </Section>

      <Section>
        <SectionHeading
          eyebrow="Çalışmalar"
          title="Son işlerden bir seçki"
          description="Gerçek çalışma fotoğrafları yüklenene kadar bu alan örnek görsellerle gösteriliyor."
        />
        <div className="mt-10">
          <GalleryGrid limit={8} withFilters={false} />
        </div>
        <Link
          to="/calismalar"
          className="mt-8 inline-flex h-11 items-center rounded-full border border-border px-5 text-sm font-medium hover:bg-muted"
        >
          Tüm çalışmalar
        </Link>
      </Section>

      <Section className="bg-card">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <SectionHeading
              eyebrow="Hijyen"
              title="Rahat hissetmen için net kurallar"
            />
            <ul className="mt-8 space-y-4">
              {trustPoints.map((point) => (
                <li key={point.title} className="flex gap-3">
                  <ShieldCheck
                    className="mt-0.5 size-5 shrink-0 text-primary"
                    aria-hidden
                  />
                  <div>
                    <p className="font-medium">{point.title}</p>
                    <p className="text-sm text-muted-foreground">{point.text}</p>
                  </div>
                </li>
              ))}
            </ul>
            <Link
              to="/hijyen"
              className="mt-8 inline-flex h-11 items-center rounded-full border border-border px-5 text-sm font-medium hover:bg-muted"
            >
              Hijyen protokolü
            </Link>
          </div>

          <div>
            <SectionHeading eyebrow="S.S.S." title="Sık sorulan sorular" />
            <div className="mt-6">
              <FaqAccordion items={faqItems.slice(0, 4)} />
            </div>
            <Link
              to="/sss"
              className="mt-6 inline-flex h-11 items-center rounded-full border border-border px-5 text-sm font-medium hover:bg-muted"
            >
              Tüm sorular
            </Link>
          </div>
        </div>
      </Section>

      <Section>
        <div className="rounded-[2rem] border border-border bg-gradient-to-br from-[#F3E6E7] to-[#E7DBD6] p-10 text-center sm:p-16">
          <h2 className="text-balance text-3xl sm:text-4xl">
            Uygun saatini şimdi ayırt.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-sm text-muted-foreground sm:text-base">
            Randevunu oluşturduktan sonra sana özel bağlantı ile dilediğin zaman
            görüntüleyebilir, erteleyebilir veya iptal edebilirsin.
          </p>
          <Link
            to="/randevu"
            className="mt-8 inline-flex h-13 items-center rounded-full bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            Online Randevu Al
          </Link>
        </div>
      </Section>
    </>
  );
}
