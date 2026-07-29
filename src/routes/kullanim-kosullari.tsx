import { createFileRoute } from "@tanstack/react-router";

import { Section, SectionHeading, PlaceholderNote } from "@/components/site/Layout";

const title = "Kullanım Koşulları | Hazel Ağaoğlu Nail Art Studio";
const description =
  "İşletme onayıyla kesinleşecek web sitesi ve online randevu kullanım koşulları taslağı.";

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
      <PlaceholderNote>
        Bu sayfa yürürlükte olan kullanım koşulları değildir. Gerçek işletme bilgileri, hizmet
        kuralları ve hukuki metinler onaylandıktan sonra yayımlanacaktır.
      </PlaceholderNote>
      <div className="mt-8 max-w-3xl space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-lg text-foreground">Sitenin amacı</h2>
          <p className="mt-2">
            Site hizmetleri, tahmini süreleri ve müsaitliği göstermeyi; uygun bir saat seçildiğinde
            online randevu oluşturmayı amaçlar. Randevu yalnızca sunucu onayı ve randevu kodu
            üretildikten sonra kesinleşir.
          </p>
        </section>
        <section>
          <h2 className="text-lg text-foreground">Randevu kullanımı</h2>
          <p className="mt-2">
            Kullanıcı sorumlulukları, iptal ve değişiklik süreleri işletme tarafından onaylanmış
            güncel randevu koşullarında açıklanmalıdır. Bu metin yayımlanmadan production randevusu
            kabul edilmemelidir.
          </p>
        </section>
        <section>
          <h2 className="text-lg text-foreground">İçerik ve görseller</h2>
          <p className="mt-2">
            Şu an kullanılan metinler ve görsel alanlar taslaktır. Gerçek marka içeriği ve kullanım
            izinleri teslim öncesinde doğrulanacaktır.
          </p>
        </section>
        <section>
          <h2 className="text-lg text-foreground">Nihai koşullar</h2>
          <p className="mt-2">
            Yürürlük tarihi, işletme kimliği ve güncelleme yöntemi nihai koşullarda açıkça
            belirtilecektir.
          </p>
        </section>
      </div>
    </Section>
  );
}
