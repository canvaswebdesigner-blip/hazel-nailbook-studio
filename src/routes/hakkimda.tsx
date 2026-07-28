import { createFileRoute, Link } from "@tanstack/react-router";

import { Section, SectionHeading, PlaceholderNote } from "@/components/site/Layout";
import { business } from "@/lib/content";

const title = "Hakkımda | Hazel Ağaoğlu Nail Art Studio";
const description =
  "Hazel Ağaoğlu'nun nail art yaklaşımı, stüdyo anlayışı ve kişiye özel çalışma yöntemi hakkında.";

export const Route = createFileRoute("/hakkimda")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <Section>
      <div className="grid gap-12 lg:grid-cols-[1fr_0.8fr]">
        <div>
          <SectionHeading
            as="h1"
            eyebrow="Hakkımda"
            title="Sakin bir atölye, kişiye özel bir yaklaşım"
          />
          <div className="mt-8 space-y-5 text-base leading-relaxed text-muted-foreground">
            <p>
              {business.shortName}, tırnak bakımını aceleye getirmeden, tek
              müşteriye odaklanarak çalışan küçük bir stüdyo anlayışıyla
              kuruldu. Amacım, her randevunun hem bakım hem de dinlenme anı
              olması.
            </p>
            <p>
              Her uygulamada önce tırnak yapını değerlendiriyor, sonra sana
              uygun form, renk ve bakım planını birlikte belirliyoruz. Trend
              olan her şeyi değil, sana yakışanı öneriyorum.
            </p>
            <p>
              Kullanılan ürünlerde kalite ve tırnak sağlığı önceliğim. Hijyen
              kurallarını şeffaf biçimde paylaşıyorum; merak ettiğin her adımı
              uygulama sırasında sorabilirsin.
            </p>
          </div>

          <Link
            to="/randevu"
            className="mt-10 inline-flex h-12 items-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            Randevu Al
          </Link>

          <PlaceholderNote>
            Bu metin taslaktır; nihai içerik onaylandığında güncellenecek.
          </PlaceholderNote>
        </div>

        <div>
          <div
            className="aspect-[4/5] rounded-[2rem] border border-border bg-gradient-to-br from-[#E7DBD6] to-[#C98998]/45 shadow-[var(--shadow-atelier)]"
            aria-hidden
          />
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Portre fotoğrafı yakında eklenecek.
          </p>
        </div>
      </div>
    </Section>
  );
}
