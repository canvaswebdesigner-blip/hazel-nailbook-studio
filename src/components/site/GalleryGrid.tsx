import { useState } from "react";

import { galleryItems, serviceCategories, type ServiceCategory } from "@/lib/content";
import { cn } from "@/lib/utils";

const gradients: Record<ServiceCategory, string> = {
  manikur: "from-[#F3E6E7] to-[#E7DBD6]",
  protez: "from-[#E7DBD6] to-[#C98998]/50",
  "nail-art": "from-[#C98998]/40 to-[#6F394A]/30",
  bakim: "from-[#FBF7F3] to-[#B8A79C]/40",
};

export function GalleryGrid({
  limit,
  withFilters = true,
}: {
  limit?: number;
  withFilters?: boolean;
}) {
  const [active, setActive] = useState<ServiceCategory | "all">("all");
  const [lightbox, setLightbox] = useState<string | null>(null);

  const filtered = galleryItems.filter(
    (item) => active === "all" || item.category === active,
  );
  const visible = limit ? filtered.slice(0, limit) : filtered;

  return (
    <div>
      {withFilters ? (
        <div
          role="group"
          aria-label="Kategori filtresi"
          className="mb-8 flex flex-wrap gap-2"
        >
          <FilterButton
            active={active === "all"}
            onClick={() => setActive("all")}
            label="Tümü"
          />
          {serviceCategories.map((c) => (
            <FilterButton
              key={c.id}
              active={active === c.id}
              onClick={() => setActive(c.id)}
              label={c.label}
            />
          ))}
        </div>
      ) : null}

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {visible.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => setLightbox(item.id)}
              className="group block w-full overflow-hidden rounded-2xl border border-border text-left"
            >
              <div
                className={cn(
                  "aspect-[4/5] bg-gradient-to-br transition-transform duration-200 group-hover:scale-[1.02]",
                  gradients[item.category],
                )}
                aria-hidden
              />
              <span className="block bg-card px-3 py-2.5 text-sm text-muted-foreground">
                {item.title}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Bu kategoride henüz görsel yok.
        </p>
      ) : null}

      {lightbox ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Çalışma görseli"
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/70 p-6"
          onClick={() => setLightbox(null)}
        >
          <div className="w-full max-w-md rounded-3xl bg-card p-6 text-center">
            <div
              className={cn(
                "aspect-[4/5] rounded-2xl bg-gradient-to-br",
                gradients[
                  galleryItems.find((g) => g.id === lightbox)!.category
                ],
              )}
              aria-hidden
            />
            <p className="mt-4 text-sm text-muted-foreground">
              {galleryItems.find((g) => g.id === lightbox)?.title} — gerçek
              fotoğraflar yakında eklenecek.
            </p>
            <button
              type="button"
              onClick={() => setLightbox(null)}
              className="mt-5 inline-flex h-11 items-center rounded-full border border-border px-5 text-sm"
            >
              Kapat
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-10 rounded-full border px-4 text-sm transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
