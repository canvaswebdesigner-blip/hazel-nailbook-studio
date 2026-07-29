import { createFileRoute } from "@tanstack/react-router";

import { Section, SectionHeading, PlaceholderNote } from "@/components/site/Layout";
import { GalleryGrid } from "@/components/site/GalleryGrid";

const title = "Çalışmalar | Hazel Ağaoğlu Nail Art Studio";
const description =
  "Gerçek portfolyo fotoğrafları eklenene kadar kullanılan örnek manikür, protez tırnak ve nail art kategorileri.";

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
        title="Portfolyo hazırlık alanı"
        description="Kategori yapısını inceleyebilirsin; görünen kartlar Hazel'in gerçek çalışmaları değildir."
      />
      <div className="mt-10">
        <GalleryGrid />
      </div>
      <PlaceholderNote>
        Görseller örnek amaçlıdır; gerçek çalışma fotoğrafları admin panelinden yüklenecek.
      </PlaceholderNote>
    </Section>
  );
}
