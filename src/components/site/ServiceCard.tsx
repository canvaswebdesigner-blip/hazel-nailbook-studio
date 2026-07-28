import { Link } from "@tanstack/react-router";
import { Clock } from "lucide-react";

import type { Service } from "@/lib/content";

export function formatPrice(service: Service) {
  if (service.priceType === "quote_required") return "Fiyat için görüşelim";
  if (!service.price) return "Fiyat yakında";
  const value = new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(service.price);
  return service.priceType === "starting_from" ? `${value}'den başlayan` : value;
}

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} dk`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} sa ${m} dk` : `${h} sa`;
}

export function ServiceCard({ service }: { service: Service }) {
  return (
    <article className="flex h-full flex-col rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-atelier)] transition-transform duration-200 hover:-translate-y-0.5">
      <h3 className="text-xl">{service.name}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
        {service.shortDescription}
      </p>

      <dl className="mt-5 space-y-1.5 text-sm">
        <div className="flex items-center gap-2">
          <dt className="sr-only">Fiyat</dt>
          <dd className="font-medium text-foreground">{formatPrice(service)}</dd>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="size-4 shrink-0" aria-hidden />
          <dt className="sr-only">Süre</dt>
          <dd>{formatDuration(service.durationMinutes)}</dd>
        </div>
      </dl>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          to="/randevu"
          search={{ hizmet: service.slug }}
          className="inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          Randevu Al
        </Link>
        <Link
          to="/hizmetler/$slug"
          params={{ slug: service.slug }}
          className="inline-flex h-11 items-center rounded-full border border-border px-5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          Detaylar
        </Link>
      </div>
    </article>
  );
}
