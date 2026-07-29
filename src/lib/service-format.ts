import type { Service } from "@/lib/content";

export function formatPrice(service: Service) {
  if (service.priceType === "quote_required") return "Fiyat için görüşelim";
  if (!service.price) return "Fiyat yakında";

  const value = new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(service.price);

  return service.priceType === "starting_from" ? `${value}'den başlayan` : value;
}

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} dk`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes ? `${hours} sa ${remainingMinutes} dk` : `${hours} sa`;
}
