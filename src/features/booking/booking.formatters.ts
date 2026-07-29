import type { BookableService } from "@/features/booking/booking.types";

export function formatBookingPrice(
  service: Pick<BookableService, "currency" | "price" | "priceType">,
) {
  if (service.priceType === "quote_required") return "Fiyat için görüşelim";
  if (service.price === null) return "Fiyat bilgisi yakında";

  const numericPrice = Number(service.price);
  if (!Number.isFinite(numericPrice)) return "Fiyat bilgisi yakında";

  const formatted = new Intl.NumberFormat("tr-TR", {
    currency: service.currency,
    maximumFractionDigits: Number.isInteger(numericPrice) ? 0 : 2,
    style: "currency",
  }).format(numericPrice);

  return service.priceType === "starting_from" ? `${formatted}'den başlayan` : formatted;
}

export function formatBookingDateTime(
  value: string,
  options: Readonly<{ dateStyle?: "full" | "long" | "medium"; timeStyle?: "short" }> = {},
) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: options.dateStyle ?? "long",
    timeStyle: options.timeStyle ?? "short",
    timeZone: "Europe/Istanbul",
  }).format(new Date(value));
}
