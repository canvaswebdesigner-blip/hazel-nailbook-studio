import { createFileRoute } from "@tanstack/react-router";

import { Section, SectionHeading, PlaceholderNote } from "@/components/site/Layout";

const title = "Gizlilik Politikası | Hazel Ağaoğlu Nail Art Studio";
const description =
  "Randevu sırasında paylaştığın kişisel verilerin nasıl işlendiği, saklandığı ve korunduğu hakkında bilgi.";

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
      <div className="mt-8 max-w-3xl space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-lg text-foreground">Hangi verileri topluyoruz?</h2>
          <p className="mt-2">
            Randevu oluştururken adın, iletişim bilgin ve seçtiğin hizmet
            bilgisi kaydedilir. Bu veriler yalnızca randevunun planlanması ve
            hatırlatılması için kullanılır.
          </p>
        </section>
        <section>
          <h2 className="text-lg text-foreground">Verilerin saklanması</h2>
          <p className="mt-2">
            Kayıtlar güvenli bir veritabanında tutulur ve yalnızca yetkili
            stüdyo hesabı tarafından görüntülenebilir. Randevu geçmişi, yasal
            saklama süresi boyunca korunur.
          </p>
        </section>
        <section>
          <h2 className="text-lg text-foreground">Üçüncü taraflarla paylaşım</h2>
          <p className="mt-2">
            Kişisel verilerin pazarlama amacıyla üçüncü taraflarla paylaşılmaz
            veya satılmaz.
          </p>
        </section>
        <section>
          <h2 className="text-lg text-foreground">Haklarınız</h2>
          <p className="mt-2">
            Verilerine erişme, düzeltilmesini veya silinmesini talep etme
            hakkına sahipsin. Bu talepler için iletişim sayfasındaki kanallardan
            bize ulaşabilirsin.
          </p>
        </section>
      </div>
      <PlaceholderNote>
        Bu metin taslaktır ve hukuki danışmanlık yerine geçmez; yayına
        alınmadan önce güncellenecektir.
      </PlaceholderNote>
    </Section>
  );
}
