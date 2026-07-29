import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

export function AdminAuthFrame({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <div className="min-h-screen bg-[#f7f6f5] px-4 py-8 sm:py-14">
      <div className="mx-auto w-full max-w-md">
        <Link
          to="/"
          className="mb-8 inline-flex text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          Hazel Nail Art Studio
        </Link>

        <section className="rounded-[1.5rem] border border-border bg-card p-6 shadow-atelier sm:p-8">
          <div className="mb-6 flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <ShieldCheck className="size-5" aria-hidden />
          </div>
          <p className="eyebrow mb-2">Güvenli yönetim</p>
          <h1 className="font-sans text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
          <div className="mt-7">{children}</div>
        </section>

        <p className="mt-5 text-center text-xs leading-5 text-muted-foreground">
          Bu alan yalnızca yetkilendirilmiş işletme yöneticisi içindir.
        </p>
      </div>
    </div>
  );
}
