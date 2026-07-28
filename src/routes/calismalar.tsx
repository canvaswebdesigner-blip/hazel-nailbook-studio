import { createFileRoute } from "@tanstack/react-router";

import { Section, SectionHeading, PlaceholderNote } from "@/components/site/Layout";
import { GalleryGrid } from "@/components/site/GalleryGrid";

const title = "Çalışmalar | Hazel Ağaoğlu Nail Art Studio";
const description =
  "Manikür, protez tırnak ve nail art çalışmalarından seçkiler. Kategorilere göre inceleyip randevunu oluştur.";

export const Route = createFileRoute("/calismalar")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: GalleryPage,
});

function GalleryPage() {
  return (
    <Section>
      <SectionHeading
        as="h1"
        eyebrow="Portfolyo"
        title="Çalışmalar"
        description="Kategori seçerek ilgilendiğin uygulamaları filtreleyebilirsin."
      />
      <div className="mt-10">
        <GalleryGrid />
      </div>
      <PlaceholderNote>
        Görseller örnek amaçlıdır; gerçek çalışma fotoğrafları admin panelinden
        yüklenecek.
      </PlaceholderNote>
    </Section>
  );
}
