import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";

import { Section, SectionHeading } from "@/components/site/Layout";
import { trustPoints } from "@/lib/content";

const title = "Hijyen Protokolü | Hazel Ağaoğlu Nail Art Studio";
const description =
  "Tek kullanımlık malzemeler, alet dezenfeksiyonu ve çalışma alanı temizliği: stüdyoda uygulanan hijyen adımları.";

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
        eyebrow="Hijyen"
        title="Hijyen protokolü"
        description="Rahat hissetmen için uyguladığımız adımları açıkça paylaşıyoruz."
      />

      <ol className="mt-10 space-y-4">
        {steps.map((step, i) => (
          <li
            key={step.title}
            className="flex gap-4 rounded-3xl border border-border bg-card p-6"
          >
            <span className="font-display text-2xl text-primary">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <h2 className="text-lg">{step.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {step.text}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-12 grid gap-4 sm:grid-cols-3">
        {trustPoints.map((point) => (
          <div
            key={point.title}
            className="rounded-3xl border border-border p-6"
          >
            <ShieldCheck className="size-5 text-primary" aria-hidden />
            <p className="mt-3 font-medium">{point.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{point.text}</p>
          </div>
        ))}
      </div>

      <Link
        to="/randevu"
        className="mt-10 inline-flex h-12 items-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground"
      >
        Randevu Al
      </Link>
    </Section>
  );
}
