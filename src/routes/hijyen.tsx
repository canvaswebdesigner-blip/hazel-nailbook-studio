import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";

import { Section, SectionHeading } from "@/components/site/Layout";
import { trustPoints } from "@/lib/content";

const title = "Hijyen Yaklaşımı Taslağı | Hazel Ağaoğlu Nail Art Studio";
const description =
  "Hazel'in onayıyla kesinleşecek örnek stüdyo hijyeni ve çalışma düzeni başlıkları.";

export const Route = createFileRoute("/hijyen")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: HygienePage,
});

const steps = [
  {
    title: "Randevu öncesi hazırlık",
    text: "Çalışma alanı ve yüzeyler her müşteriden önce temizlenir, kullanılacak malzemeler ayrı olarak hazırlanır.",
  },
  {
    title: "Tek kullanımlık malzemeler",
    text: "Törpü, sünger, portakal çubuğu gibi malzemeler her müşteri için yeni açılır ve uygulama sonunda atılır.",
  },
  {
    title: "Metal aletler",
    text: "Tekrar kullanılan metal aletler önce temizlenir, ardından dezenfekte edilerek kapalı şekilde saklanır.",
  },
  {
    title: "El hijyeni",
    text: "Uygulama öncesi ve sonrası el hijyeni sağlanır; gerektiğinde eldiven kullanılır.",
  },
  {
    title: "Cihaz ve yüzeyler",
    text: "Lamba, freze uçları ve masa yüzeyi her uygulamadan sonra temizlenir.",
  },
];

function HygienePage() {
  return (
    <Section>
      <SectionHeading
        as="h1"
        eyebrow="Hijyen taslağı"
        title="Planlanan hijyen yaklaşımı"
        description="Bu sayfadaki maddeler taslak içeriktir. Hazel'in gerçek uygulamaları doğrulanıp onaylandıktan sonra kesin bilgi olarak yayımlanacaktır."
      />

      <ol className="mt-10 space-y-4">
        {steps.map((step, i) => (
          <li key={step.title} className="flex gap-4 rounded-3xl border border-border bg-card p-6">
            <span className="font-display text-2xl text-primary">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <h2 className="text-lg">{step.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-12 grid gap-4 sm:grid-cols-3">
        {trustPoints.map((point) => (
          <div key={point.title} className="rounded-3xl border border-border p-6">
            <ShieldCheck className="size-5 text-primary" aria-hidden />
            <p className="mt-3 font-medium">{point.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{point.text}</p>
          </div>
        ))}
      </div>

      <Link
        to="/hizmetler"
        className="mt-10 inline-flex h-12 items-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground"
      >
        Hizmetleri İncele
      </Link>
    </Section>
  );
}
