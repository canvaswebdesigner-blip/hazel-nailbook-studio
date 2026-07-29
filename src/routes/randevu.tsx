import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";

import { Section, SectionHeading } from "@/components/site/Layout";
import { Button } from "@/components/ui/button";
import { BookingFlow } from "@/features/booking/BookingFlow";
import { getBookingBootstrapServerFn } from "@/features/booking/booking.server-fns";

const title = "Online Randevu | Hazel Ağaoğlu Nail Art Studio";
const description = "Hizmetini seç, gerçek müsait saatleri gör ve randevunu birkaç adımda oluştur.";

const searchSchema = z.object({
  hizmet: z.string().optional(),
});

export const Route = createFileRoute("/randevu")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: () => getBookingBootstrapServerFn(),
  component: BookingPage,
});

function BookingPage() {
  const bootstrap = Route.useLoaderData();
  const { hizmet } = Route.useSearch();

  if (bootstrap.status === "ready") {
    return <BookingFlow bootstrap={bootstrap} initialServiceSlug={hizmet} />;
  }

  return (
    <Section>
      <div className="mx-auto max-w-2xl rounded-[2rem] border border-border bg-card p-6 shadow-[var(--shadow-atelier)] sm:p-10">
        <SectionHeading
          as="h1"
          eyebrow="Online randevu"
          title={
            bootstrap.status === "temporarily_disabled"
              ? "Online randevuya kısa bir ara verdik"
              : "Randevu sistemi henüz hazır değil"
          }
          description={bootstrap.message}
        />
        <div className="mt-7 flex flex-wrap gap-3">
          <Button className="h-12 rounded-xl px-6" variant="outline" asChild>
            <Link to="/iletisim">İletişim bilgileri</Link>
          </Button>
          <Button className="h-12 rounded-xl px-6" variant="ghost" asChild>
            <Link to="/">Ana sayfa</Link>
          </Button>
        </div>
      </div>
    </Section>
  );
}
