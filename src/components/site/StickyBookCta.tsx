import { Link, useRouterState } from "@tanstack/react-router";

export function StickyBookCta() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname.startsWith("/randevu")) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur sm:hidden"
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
    >
      <Link
        to="/randevu"
        className="flex h-[52px] items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground"
      >
        Uygun Saatleri Gör
      </Link>
    </div>
  );
}
