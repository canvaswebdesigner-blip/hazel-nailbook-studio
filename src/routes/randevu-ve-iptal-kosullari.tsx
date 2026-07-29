import { createFileRoute, Link } from "@tanstack/react-router";

import { Section, SectionHeading, PlaceholderNote } from "@/components/site/Layout";

const title = "Randevu ve İptal Koşulları | Hazel Ağaoğlu Nail Art Studio";
const description =
  "İşletme onayıyla kesinleşecek randevu oluşturma, erteleme, iptal ve gecikme kuralları taslağı.";

export const Route = createFileRoute("/randevu-ve-iptal-kosullari")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: PolicyPage,
});

function PolicyPage() {
  return (
    <Section>
      <SectionHeading as="h1" eyebrow="Yasal" title="Randevu ve İptal Koşulları" />
      <PlaceholderNote>
        Bu sayfa hukuki veya operasyonel olarak yürürlükte olan bir politika değildir. Kurallar,
        süreler ve işletme bilgileri Hazel tarafından onaylandıktan sonra yayımlanacaktır.
      </PlaceholderNote>
      <div className="mt-8 max-w-3xl space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-lg text-foreground">Randevu oluşturma akışı</h2>
          <p className="mt-2">
            Randevular online takvim üzerinden oluşturulur. Bir saat ancak güvenli sunucu
            doğrulaması tamamlanıp randevu kodu üretildikten sonra ayrılmış sayılır.
          </p>
        </section>
        <section>
          <h2 className="text-lg text-foreground">İptal ve erteleme akışı</h2>
          <p className="mt-2">
            Müşteriler randevu onayında verilen özel bağlantıyla randevularını görüntüleyebilir,
            iptal edebilir veya uygun başka bir saate taşıyabilir. Geçerli süre sınırları işletme
            tarafından henüz kesinleştirilmemiştir.
          </p>
        </section>
        <section>
          <h2 className="text-lg text-foreground">Gecikme</h2>
          <p className="mt-2">
            Gecikme durumunda izlenecek süreç ve olası yeniden planlama kuralı işletme onayıyla
            belirlenecektir.
          </p>
        </section>
        <section>
          <h2 className="text-lg text-foreground">Gelmeyen randevular</h2>
          <p className="mt-2">
            Haber verilmeden gelinmeyen randevular için uygulanacak süreç henüz onaylanmamıştır.
          </p>
        </section>
      </div>

      <Link
        to="/randevu"
        className="mt-8 inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
      >
        Online Randevu Al
      </Link>
    </Section>
  );
}
