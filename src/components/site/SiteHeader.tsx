import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X } from "lucide-react";

import { Container } from "./Layout";
import { business } from "@/lib/content";
import { cn } from "@/lib/utils";

export const navLinks = [
  { to: "/hizmetler", label: "Hizmetler" },
  { to: "/calismalar", label: "Çalışmalar" },
  { to: "/hakkimda", label: "Hakkımda" },
  { to: "/hijyen", label: "Hijyen" },
  { to: "/sss", label: "S.S.S." },
  { to: "/iletisim", label: "İletişim" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <Container>
        <div className="grid h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:h-20">
          <Link
            to="/"
            className="min-w-0 truncate font-display text-lg tracking-tight sm:text-xl"
          >
            {business.shortName}
            <span className="hidden text-muted-foreground sm:inline">
              {" "}
              · Nail Art Studio
            </span>
          </Link>

          <div className="flex shrink-0 items-center gap-1">
            <nav aria-label="Ana menü" className="hidden lg:flex lg:items-center">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="rounded-full px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  activeProps={{ className: "text-foreground" }}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <Link
              to="/randevu"
              className="ml-1 hidden h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover sm:inline-flex"
            >
              Online Randevu Al
            </Link>

            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={open ? "Menüyü kapat" : "Menüyü aç"}
              className="inline-flex size-11 items-center justify-center rounded-full border border-border text-foreground lg:hidden"
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
      </Container>

      <div
        id="mobile-menu"
        className={cn(
          "border-t border-border bg-card lg:hidden",
          open ? "block" : "hidden",
        )}
      >
        <Container>
          <nav aria-label="Mobil menü" className="flex flex-col py-3">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setOpen(false)}
                className="rounded-xl px-2 py-3 text-base text-foreground"
              >
                {link.label}
              </Link>
            ))}
            <Link
              to="/randevu"
              onClick={() => setOpen(false)}
              className="mt-2 inline-flex h-12 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
            >
              Online Randevu Al
            </Link>
          </nav>
        </Container>
      </div>
    </header>
  );
}
