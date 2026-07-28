import { Link } from "@tanstack/react-router";
import { Instagram, MapPin, MessageCircle } from "lucide-react";

import { Container } from "./Layout";
import { business, businessHours } from "@/lib/content";
import { navLinks } from "./SiteHeader";

export function SiteFooter() {
  return (
    <footer className="mt-8 border-t border-border bg-card">
      <Container>
        <div className="grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-display text-xl">{business.name}</p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {business.promise}
            </p>
            <Link
              to="/randevu"
              className="mt-5 inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              Online Randevu Al
            </Link>
          </div>

          <nav aria-label="Alt menü">
            <p className="eyebrow mb-4">Sayfalar</p>
            <ul className="space-y-2 text-sm">
              {navLinks.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <p className="eyebrow mb-4">Çalışma Saatleri</p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {businessHours.map((h) => (
                <li key={h.day} className="flex justify-between gap-4">
                  <span>{h.day}</span>
                  <span className={h.closed ? "text-muted-foreground/70" : ""}>
                    {h.hours}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="eyebrow mb-4">İletişim</p>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>{business.address}</span>
              </li>
              <li className="flex items-start gap-2">
                <MessageCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>{business.phoneDisplay}</span>
              </li>
              <li className="flex items-start gap-2">
                <Instagram className="mt-0.5 size-4 shrink-0" aria-hidden />
                <a
                  href={business.instagramUrl}
                  className="transition-colors hover:text-foreground"
                >
                  Instagram
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-border py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {business.name}
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link to="/gizlilik" className="hover:text-foreground">
              Gizlilik Politikası
            </Link>
            <Link to="/kullanim-kosullari" className="hover:text-foreground">
              Kullanım Koşulları
            </Link>
            <Link
              to="/randevu-ve-iptal-kosullari"
              className="hover:text-foreground"
            >
              Randevu ve İptal Koşulları
            </Link>
          </div>
        </div>
      </Container>
    </footer>
  );
}
