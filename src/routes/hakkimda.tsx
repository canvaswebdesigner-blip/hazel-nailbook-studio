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
          <PlaceholderNote>
            Bu sayfadaki anlatım taslaktır; Hazel tarafından onaylanmadan marka hikâyesi olarak
            yayımlanmayacaktır.
          </PlaceholderNote>
          <div className="mt-8 space-y-5 text-base leading-relaxed text-muted-foreground">
            <p>
              Önerilen marka anlatımı, {business.shortName} için sakin, tek müşteriye odaklanan
              butik bir stüdyo yaklaşımı kuruyor. Bu yön Hazel'in onayıyla kesinleştirilecek.
            </p>
            <p>
              Taslak içerik; tırnak yapısına, istenen forma ve tasarım tercihine göre kişisel
              planlama fikrini öne çıkarıyor. Gerçek uygulama adımları doğrulanmadan kesin bir süreç
              olarak sunulmayacak.
            </p>
            <p>
              Ürün seçimi, bakım yaklaşımı ve hijyen kuralları hakkında kullanılacak nihai ifadeler
              Hazel'in gerçek çalışma düzeni ve onayıyla hazırlanacak.
            </p>
          </div>

          <Link
            to="/hizmetler"
            className="mt-10 inline-flex h-12 items-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            Hizmetleri İncele
          </Link>
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
