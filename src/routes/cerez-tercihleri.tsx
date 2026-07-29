import { createFileRoute, Link } from "@tanstack/react-router";

import { Section, SectionHeading } from "@/components/site/Layout";

const title = "Çerez Tercihleri | Hazel Ağaoğlu Nail Art Studio";
const description =
  "Hazel Ağaoğlu Nail Art Studio web sitesinin mevcut çerez ve analiz kullanımı hakkında bilgi.";

export const Route = createFileRoute("/cerez-tercihleri")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: CookiePreferencesPage,
});

function CookiePreferencesPage() {
  return (
    <Section>
      <SectionHeading
        as="h1"
        eyebrow="Gizlilik"
        title="Çerez Tercihleri"
        description="Bu sayfa, sitenin mevcut sürümünde hangi izleme teknolojilerinin kullanıldığını açıklar."
      />

      <div className="mt-8 max-w-3xl space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section className="rounded-3xl border border-border bg-card p-6">
          <p className="eyebrow mb-3">Mevcut durum</p>
          <h2 className="text-xl text-foreground">
            İsteğe bağlı analiz veya reklam çerezi kullanılmıyor.
          </h2>
          <p className="mt-3">
            Sitenin bu sürümünde ziyaretçi analizi, reklam hedefleme, oturum kaydı veya sosyal medya
            takip kodu çalıştırılmıyor. Bu nedenle şu anda açıp kapatabileceğin isteğe bağlı bir
            çerez kategorisi yok.
          </p>
        </section>

        <section>
          <h2 className="text-lg text-foreground">Zorunlu teknolojiler</h2>
          <p className="mt-2">
            Online randevu, kötüye kullanım koruması ve özel randevu yönetim sayfaları güvenlik
            amacıyla HttpOnly oturum çerezleri kullanabilir. Bu çerezler reklam veya ziyaretçi
            profilleme amacıyla kullanılmaz; talep edilen özelliğin güvenli biçimde çalışması için
            gereklidir.
          </p>
        </section>

        <section>
          <h2 className="text-lg text-foreground">Sonradan bir şey değişirse</h2>
          <p className="mt-2">
            Analiz veya başka bir isteğe bağlı teknoloji eklenirse, bu sayfa gerçek kullanım
            bilgileriyle güncellenecek ve gerekli olduğu durumlarda tercih kontrolü sunulacaktır.
            Onay verilmeden isteğe bağlı izleme başlatılmayacaktır.
          </p>
        </section>

        <p>
          Kişisel verilerle ilgili genel bilgiler için{" "}
          <Link to="/gizlilik" className="font-medium text-primary underline underline-offset-4">
            Gizlilik Politikası
          </Link>
          ’nı inceleyebilirsin.
        </p>
      </div>
    </Section>
  );
}
