import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export function StickyBookCta() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [footerVisible, setFooterVisible] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const footer = document.querySelector("footer");

    if (!footer || typeof IntersectionObserver === "undefined") {
      setFooterVisible(false);
      return;
    }

    const observer = new IntersectionObserver(([entry]) => setFooterVisible(entry.isIntersecting), {
      rootMargin: "0px 0px 72px 0px",
      threshold: 0,
    });

    observer.observe(footer);
    return () => observer.disconnect();
  }, [pathname]);

  useEffect(() => {
    const isEditable = (element: Element | null) =>
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLSelectElement ||
      element?.getAttribute("contenteditable") === "true";

    const handleFocusIn = (event: FocusEvent) => {
      setEditing(isEditable(event.target instanceof Element ? event.target : null));
    };

    const handleFocusOut = () => {
      window.requestAnimationFrame(() => setEditing(isEditable(document.activeElement)));
    };

    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);

    return () => {
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
    };
  }, []);

  const hiddenForPath =
    pathname === "/randevu" ||
    pathname.startsWith("/randevu-basarili") ||
    pathname.startsWith("/randevu-yonet") ||
    pathname.startsWith("/admin");

  if (hiddenForPath || footerVisible || editing) return null;

  return (
    <>
      <div className="h-20 sm:hidden" aria-hidden />
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
    </>
  );
}
