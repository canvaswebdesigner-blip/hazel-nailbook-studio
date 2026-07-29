import { createFileRoute } from "@tanstack/react-router";

import { Section, SectionHeading, PlaceholderNote } from "@/components/site/Layout";

const title = "Gizlilik Politikası | Hazel Ağaoğlu Nail Art Studio";
const description = "İşletme ve hukuk onayıyla kesinleşecek kişisel veri işleme yaklaşımı taslağı.";

export const Route = createFileRoute("/gizlilik")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <Section>
      <SectionHeading as="h1" eyebrow="Yasal" title="Gizlilik Politikası" />
      <PlaceholderNote>
        Bu metin yürürlükte bir gizlilik politikası değildir. Veri sorumlusu, sağlayıcılar, işleme
        amaçları ve saklama süreleri işletme ve hukuk onayıyla tamamlanmadan formlar production
        ortamında etkinleştirilmemelidir.
      </PlaceholderNote>
      <div className="mt-8 max-w-3xl space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-lg text-foreground">Güvenli çalışma sınırı</h2>
          <p className="mt-2">
            Online randevu ve iletişim formu, yalnızca güncel bir gizlilik bildirimi veritabanında
            yayımlandığında veri kabul eder. Bildirim eksik veya güncel değilse işlem güvenli
            biçimde reddedilir.
          </p>
        </section>
        <section>
          <h2 className="text-lg text-foreground">Toplanabilecek bilgiler</h2>
          <p className="mt-2">
            Randevu için ad, telefon, isteğe bağlı e-posta ve not; genel iletişim için ad, telefon
            veya e-posta ve mesaj alınabilir. Hangi verinin hangi amaçla işlendiği ve ne kadar
            saklandığı nihai politikada açıkça belirtilecektir.
          </p>
        </section>
        <section>
          <h2 className="text-lg text-foreground">Sağlayıcılar ve saklama</h2>
          <p className="mt-2">
            Veritabanı, barındırma, e-posta veya mesajlaşma sağlayıcıları kesinleşmeden üçüncü taraf
            paylaşımı ya da saklama süresi hakkında kesin bir taahhüt verilmeyecektir.
          </p>
        </section>
        <section>
          <h2 className="text-lg text-foreground">Başvuru ve haklar</h2>
          <p className="mt-2">
            Veri sorumlusu bilgileri ve başvuru kanalı, gerçek işletme iletişim bilgileri
            onaylandığında bu sayfaya eklenecektir.
          </p>
        </section>
      </div>
    </Section>
  );
}
