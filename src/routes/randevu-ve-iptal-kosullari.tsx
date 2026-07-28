import { createFileRoute, Link } from "@tanstack/react-router";

import { Section, SectionHeading, PlaceholderNote } from "@/components/site/Layout";

const title = "Randevu ve İptal Koşulları | Hazel Ağaoğlu Nail Art Studio";
const description =
  "Randevu oluşturma, erteleme, iptal ve gecikme durumlarında geçerli kurallar.";

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
      <SectionHeading
        as="h1"
        eyebrow="Yasal"
        title="Randevu ve İptal Koşulları"
      />
      <div className="mt-8 max-w-3xl space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-lg text-foreground">Randevu oluşturma</h2>
          <p className="mt-2">
            Randevular online takvim üzerinden oluşturulur. Seçtiğin saat,
            randevu tamamlandığı anda sana ayrılır ve başka bir müşteriye
            açılmaz.
          </p>
        </section>
        <section>
          <h2 className="text-lg text-foreground">İptal ve erteleme</h2>
          <p className="mt-2">
            Randevunu, sana özel yönetim bağlantısından iptal edebilir veya
            uygun başka bir saate erteleyebilirsin. Planlamanın aksamaması için
            değişiklikleri mümkün olduğunca erken yapmanı rica ediyoruz.
          </p>
        </section>
        <section>
          <h2 className="text-lg text-foreground">Gecikme</h2>
          <p className="mt-2">
            Gecikmeler sonraki randevuları etkilediği için uygulama kapsamı
            kısaltılabilir veya randevunun yeniden planlanması gerekebilir.
          </p>
        </section>
        <section>
          <h2 className="text-lg text-foreground">Gelmeyen randevular</h2>
          <p className="mt-2">
            Haber verilmeden gelinmeyen randevularda sonraki randevu talepleri
            için ön görüşme istenebilir.
          </p>
        </section>
      </div>

      <Link
        to="/randevu"
        className="mt-8 inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
      >
        Randevu Al
      </Link>

      <PlaceholderNote>
        Süre bazlı kurallar (örneğin iptal için son saat) işletme onayından
        sonra netleştirilecek.
      </PlaceholderNote>
    </Section>
  );
}
