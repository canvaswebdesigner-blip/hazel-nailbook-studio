import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
  const dialogTitleId = useId();
  const dialogDescriptionId = useId();
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const filtered = galleryItems.filter((item) => active === "all" || item.category === active);
  const visible = limit ? filtered.slice(0, limit) : filtered;
  const selectedItem = galleryItems.find((item) => item.id === lightbox);

  const closeLightbox = useCallback(() => {
    setLightbox(null);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!selectedItem) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const overlay = overlayRef.current;
    const backgroundElements = Array.from(document.body.children).filter(
      (element) => element !== overlay,
    );
    const previousInertState = backgroundElements.map((element) => ({
      element,
      inert: element.hasAttribute("inert"),
    }));

    backgroundElements.forEach((element) => element.setAttribute("inert", ""));

    const focusFrame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeLightbox();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );

      if (!focusable?.length) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!dialogRef.current?.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      previousInertState.forEach(({ element, inert }) => {
        if (!inert) element.removeAttribute("inert");
      });
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeLightbox, selectedItem]);

  return (
    <div>
      {withFilters ? (
        <div role="group" aria-label="Kategori filtresi" className="mb-8 flex flex-wrap gap-2">
          <FilterButton active={active === "all"} onClick={() => setActive("all")} label="Tümü" />
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

      {withFilters ? (
        <p role="status" aria-live="polite" className="sr-only">
          {visible.length} çalışma gösteriliyor.
        </p>
      ) : null}

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {visible.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={(event) => {
                triggerRef.current = event.currentTarget;
                setLightbox(item.id);
              }}
              aria-label={`${item.title} çalışmasını büyüt`}
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

      {selectedItem
        ? createPortal(
            <div
              ref={overlayRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={dialogTitleId}
              aria-describedby={dialogDescriptionId}
              className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-foreground/70 p-6"
              onClick={(event) => {
                if (event.target === event.currentTarget) closeLightbox();
              }}
            >
              <div
                ref={dialogRef}
                className="max-h-[calc(100dvh-3rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-3xl bg-card p-6 text-center shadow-[var(--shadow-atelier-lg)]"
              >
                <h2 id={dialogTitleId} className="sr-only">
                  {selectedItem.title}
                </h2>
                <div
                  className={cn(
                    "aspect-[4/5] rounded-2xl bg-gradient-to-br",
                    gradients[selectedItem.category],
                  )}
                  aria-hidden
                />
                <p id={dialogDescriptionId} className="mt-4 text-sm text-muted-foreground">
                  {selectedItem.title} — gerçek fotoğraflar yakında eklenecek.
                </p>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={closeLightbox}
                  className="mt-5 inline-flex h-11 items-center rounded-full border border-border px-5 text-sm"
                >
                  Kapat
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
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
        "h-11 rounded-full border px-4 text-sm transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
