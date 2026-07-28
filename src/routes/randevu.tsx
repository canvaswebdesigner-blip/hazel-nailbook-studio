import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";

import { Section, SectionHeading, PlaceholderNote } from "@/components/site/Layout";
import { formatDuration, formatPrice } from "@/components/site/ServiceCard";
import { bookingSteps, services } from "@/lib/content";
import { cn } from "@/lib/utils";

const title = "Online Randevu | Hazel Ağaoğlu Nail Art Studio";
const description =
  "Hizmetini seç, uygun saatleri gör ve randevunu birkaç adımda online oluştur.";

const searchSchema = z.object({
  hizmet: z.string().optional(),
});

export const Route = createFileRoute("/randevu")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BookingPage,
});

function BookingPage() {
  const { hizmet } = Route.useSearch();
  const navigate = Route.useNavigate();
  const selected = services.find((s) => s.slug === hizmet);

  return (
    <Section>
      <SectionHeading
        as="h1"
        eyebrow="Randevu"
        title="Online randevu"
        description="İlk adım hizmet seçimi. Uygun saatler, seçtiğin hizmetin süresine göre hesaplanır."
      />

      <ol className="mt-8 flex flex-wrap gap-2" aria-label="Randevu adımları">
        {bookingSteps.map((step, i) => (
          <li
            key={step.title}
            className={cn(
              "flex items-center gap-2 rounded-full border px-4 py-2 text-sm",
              i === 0
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border text-muted-foreground",
            )}
          >
            <span className="font-medium">{i + 1}.</span>
            {step.title}
          </li>
        ))}
      </ol>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
        <div>
          <h2 className="text-2xl">Hizmet seç</h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {services.map((service) => {
              const active = service.slug === hizmet;
              return (
                <li key={service.slug}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      navigate({ search: { hizmet: service.slug } })
                    }
                    className={cn(
                      "w-full rounded-3xl border bg-card p-5 text-left transition-colors",
                      active
                        ? "border-primary ring-2 ring-ring/40"
                        : "border-border hover:border-primary/50",
                    )}
                  >
                    <p className="text-lg">{service.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {service.shortDescription}
                    </p>
                    <p className="mt-3 text-sm">
                      {formatPrice(service)}
                      <span className="text-muted-foreground">
                        {" · "}
                        {formatDuration(service.durationMinutes)}
                      </span>
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <aside className="h-fit rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-atelier)] lg:sticky lg:top-28">
          <p className="eyebrow">Randevu özeti</p>
          {selected ? (
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Hizmet</dt>
                <dd className="text-base">{selected.name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Süre</dt>
                <dd>{formatDuration(selected.durationMinutes)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Fiyat</dt>
                <dd>{formatPrice(selected)}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              Devam etmek için bir hizmet seç.
            </p>
          )}

          <button
            type="button"
            disabled
            className="mt-6 flex h-12 w-full items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            Uygun saatleri gör
          </button>
          <p className="mt-3 text-xs text-muted-foreground">
            Takvim ve saat seçimi bir sonraki aşamada devreye alınacak.
          </p>
        </aside>
      </div>

      <PlaceholderNote>
        Randevu oluşturma akışı (takvim, müsaitlik hesabı, çift rezervasyon
        engeli ve onay ekranı) backend fazında tamamlanacak. Şu an yalnızca
        hizmet seçimi çalışıyor.
      </PlaceholderNote>

      <Link
        to="/iletisim"
        className="mt-8 inline-flex h-11 items-center rounded-full border border-border px-5 text-sm hover:bg-muted"
      >
        Sorun mu var? Bize ulaş
      </Link>
    </Section>
  );
}
