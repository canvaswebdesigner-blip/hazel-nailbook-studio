import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Section, SectionHeading } from "@/components/site/Layout";
import { FaqAccordion } from "@/components/site/FaqAccordion";
import { faqItems, IS_PLACEHOLDER_CONTENT } from "@/lib/content";
import { Input } from "@/components/ui/input";

const title = "Sık Sorulan Sorular | Hazel Ağaoğlu Nail Art Studio";
const description =
  "Randevu, uygulama süresi, bakım ve hijyen hakkında en sık sorulan sorular ve yanıtları.";

export const Route = createFileRoute("/sss")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
    scripts: IS_PLACEHOLDER_CONTENT
      ? []
      : [
          {
            type: "application/ld+json",
            children: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: faqItems.map((f) => ({
                "@type": "Question",
                name: f.question,
                acceptedAnswer: { "@type": "Answer", text: f.answer },
              })),
            }),
          },
        ],
  }),
  component: FaqPage,
});

function FaqPage() {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLocaleLowerCase("tr");
  const filtered = normalized
    ? faqItems.filter(
        (f) =>
          f.question.toLocaleLowerCase("tr").includes(normalized) ||
          f.answer.toLocaleLowerCase("tr").includes(normalized),
      )
    : faqItems;

  return (
    <Section>
      <SectionHeading
        as="h1"
        eyebrow="S.S.S."
        title="Sık sorulan sorular"
        description="Yanıtlar taslaktır; Hazel'in çalışma düzeni ve politikaları onaylandığında güncellenecektir."
      />

      <div className="mt-8 max-w-md">
        <label htmlFor="faq-search" className="sr-only">
          Sorularda ara
        </label>
        <Input
          id="faq-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Soru ara…"
          className="h-12 rounded-full"
        />
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {filtered.length} soru gösteriliyor.
      </p>

      <div className="mt-8 max-w-3xl">
        <FaqAccordion items={filtered} />
      </div>
    </Section>
  );
}
