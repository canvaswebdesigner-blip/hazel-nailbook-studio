import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import { Section } from "@/components/site/Layout";
import { formatDuration, formatPrice } from "@/components/site/ServiceCard";
import { serviceCategories, services } from "@/lib/content";

export const Route = createFileRoute("/hizmetler/$slug")({
  loader: ({ params }) => {
    const service = services.find((s) => s.slug === params.slug);
    if (!service) throw notFound();
    return { service };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Hizmet bulunamadı | Hazel Ağaoğlu Nail Art Studio" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const { service } = loaderData;
    const title = `${service.name} | Hazel Ağaoğlu Nail Art Studio`;
    return {
      meta: [
        { title },
        { name: "description", content: service.shortDescription },
        { property: "og:title", content: title },
        { property: "og:description", content: service.shortDescription },
      ],
    };
  },
  notFoundComponent: ServiceNotFound,
  component: ServiceDetailPage,
});

function ServiceNotFound() {
  return (
    <Section>
      <h1 className="text-3xl">Bu hizmeti bulamadık</h1>
      <p className="mt-3 text-muted-foreground">
        Aradığın hizmet kaldırılmış olabilir.
      </p>
      <Link
        to="/hizmetler"
        className="mt-6 inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
      >
        Tüm hizmetler
      </Link>
    </Section>
  );
}

function ServiceDetailPage() {
  const { service } = Route.useLoaderData();
  const category = serviceCategories.find((c) => c.id === service.category);
  const related = services
    .filter((s) => s.category === service.category && s.slug !== service.slug)
    .slice(0, 3);

  return (
    <Section>
      <nav aria-label="Sayfa yolu" className="mb-6 text-sm text-muted-foreground">
        <Link to="/hizmetler" className="hover:text-foreground">
          Hizmetler
        </Link>
        <span className="px-2" aria-hidden>
          /
        </span>
        <span className="text-foreground">{service.name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <p className="eyebrow mb-3">{category?.label}</p>
          <h1 className="text-4xl leading-tight">{service.name}</h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            {service.description}
          </p>

          <div className="mt-10 space-y-8">
            <DetailBlock title="Kimler için uygun?" text={service.suitableFor} />
            <DetailBlock title="Randevu öncesi" text={service.preparation} />
            <DetailBlock title="Uygulama sonrası bakım" text={service.aftercare} />
          </div>

          {related.length > 0 ? (
            <div className="mt-12">
              <h2 className="text-2xl">Benzer hizmetler</h2>
              <ul className="mt-4 flex flex-wrap gap-2">
                {related.map((r) => (
                  <li key={r.slug}>
                    <Link
                      to="/hizmetler/$slug"
                      params={{ slug: r.slug }}
                      className="inline-flex h-10 items-center rounded-full border border-border px-4 text-sm hover:bg-muted"
                    >
                      {r.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <aside className="h-fit rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-atelier)] lg:sticky lg:top-28">
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="eyebrow">Fiyat</dt>
              <dd className="mt-1 text-lg">{formatPrice(service)}</dd>
            </div>
            <div>
              <dt className="eyebrow">Tahmini süre</dt>
              <dd className="mt-1 text-lg">
                {formatDuration(service.durationMinutes)}
              </dd>
            </div>
          </dl>
          <Link
            to="/randevu"
            search={{ hizmet: service.slug }}
            className="mt-6 flex h-12 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            Bu hizmet için randevu al
          </Link>
          <p className="mt-3 text-xs text-muted-foreground">
            Fiyat ve süre tırnak yapına göre değişebilir.
          </p>
        </aside>
      </div>
    </Section>
  );
}

function DetailBlock({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h2 className="text-xl">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}
