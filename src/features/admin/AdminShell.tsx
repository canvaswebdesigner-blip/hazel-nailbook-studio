import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  CalendarDays,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Scissors,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";

import { logoutAdminServerFn } from "@/features/admin-auth/admin-auth.server-fns";
import type { AdminIdentity } from "@/features/admin-auth/admin-auth.types";
import { Button } from "@/components/ui/button";

export function AdminShell({ identity }: { identity: AdminIdentity }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logoutAdminServerFn();
    } finally {
      window.location.replace("/admin/giris");
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f6f5] text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex min-h-16 max-w-[90rem] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">Hazel Nail Art Studio</p>
            <p className="truncate text-xs text-muted-foreground">Yönetim paneli</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="hidden h-10 items-center gap-2 rounded-xl border border-border px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:flex"
            >
              Siteyi aç
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
            <Button
              type="button"
              variant="ghost"
              disabled={loggingOut}
              onClick={logout}
              className="h-10 rounded-xl"
            >
              <LogOut aria-hidden />
              <span className="hidden sm:inline">{loggingOut ? "Çıkılıyor" : "Çıkış"}</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[90rem] lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="border-b border-border bg-card px-4 py-3 lg:min-h-[calc(100vh-4rem)] lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
          <div className="mb-6 hidden rounded-2xl border border-border bg-muted/40 p-4 lg:block">
            <div className="flex items-center gap-2 text-xs font-semibold text-success">
              <ShieldCheck className="size-4" aria-hidden />
              AAL2 oturum
            </div>
            <p className="mt-2 truncate text-sm font-semibold">{identity.fullName}</p>
            <p className="truncate text-xs text-muted-foreground">{identity.email}</p>
          </div>

          <nav aria-label="Yönetim menüsü" className="flex gap-2 lg:flex-col">
            <Link
              to="/admin"
              activeOptions={{ exact: true }}
              className={`inline-flex h-11 items-center gap-3 rounded-xl px-4 text-sm font-semibold transition-colors ${
                pathname === "/admin"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <LayoutDashboard className="size-4" aria-hidden />
              Genel bakış
            </Link>
            <Link
              to="/admin/randevular"
              className={`inline-flex h-11 items-center gap-3 rounded-xl px-4 text-sm font-semibold transition-colors ${
                pathname.startsWith("/admin/randevular")
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <CalendarDays className="size-4" aria-hidden />
              Randevular
            </Link>
            <Link
              to="/admin/hizmetler"
              className={`inline-flex h-11 items-center gap-3 rounded-xl px-4 text-sm font-semibold transition-colors ${
                pathname.startsWith("/admin/hizmetler")
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Scissors className="size-4" aria-hidden />
              Hizmetler
            </Link>
            <Link
              to="/admin/mesajlar"
              className={`inline-flex h-11 items-center gap-3 rounded-xl px-4 text-sm font-semibold transition-colors ${
                pathname.startsWith("/admin/mesajlar")
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <MessageSquare className="size-4" aria-hidden />
              Mesajlar
            </Link>
          </nav>
        </aside>

        <main id="admin-main" className="min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
