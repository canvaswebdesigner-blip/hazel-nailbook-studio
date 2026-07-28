import { createFileRoute } from "@tanstack/react-router";

import { Section, SectionHeading, PlaceholderNote } from "@/components/site/Layout";

const title = "Kullanım Koşulları | Hazel Ağaoğlu Nail Art Studio";
const description =
  "Web sitesinin ve online randevu sisteminin kullanımına ilişkin koşullar.";

export const Route = createFileRoute("/kullanim-kosullari")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <Section>
      <SectionHeading as="h1" eyebrow="Yasal" title="Kullanım Koşulları" />
      <div className="mt-8 max-w-3xl space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-lg text-foreground">Sitenin kullanımı</h2>
          <p className="mt-2">
            Bu site, stüdyo hizmetleri hakkında bilgi vermek ve online randevu
            oluşturmayı sağlamak amacıyla sunulur. Siteyi kullanarak bu
            koşulları kabul etmiş olursun.
          </p>
        </section>
        <section>
          <h2 className="text-lg text-foreground">Randevu bilgileri</h2>
          <p className="mt-2">
            Randevu oluştururken verdiğin bilgilerin doğru olması gerekir.
            Hatalı iletişim bilgisi nedeniyle ulaşılamayan randevularda
            hatırlatma gönderilemeyebilir.
          </p>
        </section>
        <section>
          <h2 className="text-lg text-foreground">İçerik hakları</h2>
          <p className="mt-2">
            Sitedeki görseller, metinler ve tasarım stüdyoya aittir; izinsiz
            kullanılamaz.
          </p>
        </section>
        <section>
          <h2 className="text-lg text-foreground">Değişiklikler</h2>
          <p className="mt-2">
            Hizmet kapsamı, fiyatlar ve bu koşullar önceden bildirilmeksizin
            güncellenebilir.
          </p>
        </section>
      </div>
      <PlaceholderNote>
        Bu metin taslaktır ve yayına alınmadan önce güncellenecektir.
      </PlaceholderNote>
    </Section>
  );
}
