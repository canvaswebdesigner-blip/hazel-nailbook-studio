import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Section, SectionHeading, PlaceholderNote } from "@/components/site/Layout";
import { ServiceCard } from "@/components/site/ServiceCard";
import { serviceCategories, services, type ServiceCategory } from "@/lib/content";
import { cn } from "@/lib/utils";

const title = "Hizmetler ve Fiyatlar | Hazel Ağaoğlu Nail Art Studio";
const description =
  "Hazel Ağaoğlu Nail Art Studio için hazırlanan örnek hizmet, süre ve fiyat yapısını incele.";

export const Route = createFileRoute("/hizmetler/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: ServicesPage,
});

function ServicesPage() {
  const [active, setActive] = useState<ServiceCategory | "all">("all");
  const filtered = services.filter((s) => active === "all" || s.category === active);

  return (
    <Section>
      <SectionHeading
        as="h1"
        eyebrow="Hizmetler"
        title="Hizmet taslakları ve örnek süreler"
        description="Bu sayfadaki hizmetler, süreler ve fiyat yapısı örnektir; Hazel tarafından onaylandıktan sonra kesinleşecektir."
      />

      <div role="group" aria-label="Hizmet kategorisi" className="mt-8 flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={active === "all"}
          onClick={() => setActive("all")}
          className={cn(
            "h-11 rounded-full border px-4 text-sm",
            active === "all"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-muted-foreground hover:text-foreground",
          )}
        >
          Tümü
        </button>
        {serviceCategories.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={active === c.id}
            onClick={() => setActive(c.id)}
            className={cn(
              "h-11 rounded-full border px-4 text-sm",
              active === c.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {filtered.length} hizmet gösteriliyor.
      </p>

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((service) => (
          <ServiceCard key={service.slug} service={service} />
        ))}
      </div>

      <PlaceholderNote>
        Fiyat bilgileri henüz onaylanmadı; bu alan admin panelinden güncellenecek.
      </PlaceholderNote>
    </Section>
  );
}
