import { useRouter } from "@tanstack/react-router";
import { Clock3, LoaderCircle, Pencil, Plus, Save, Tag } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";

import { upsertAdminServiceServerFn } from "@/features/admin/admin.server-fns";
import type { AdminServiceItem } from "@/features/admin/admin.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function AdminServices({ services }: { services: readonly AdminServiceItem[] }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [selectedService, setSelectedService] = useState<AdminServiceItem | undefined>();

  function createService() {
    setSelectedService(undefined);
    setDialogOpen(true);
  }

  function editService(service: AdminServiceItem) {
    setSelectedService(service);
    setDialogOpen(true);
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow mb-2">Hizmetler</p>
          <h1 className="font-sans text-2xl font-bold tracking-tight sm:text-3xl">
            Hizmet ve fiyat yönetimi
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Sitede gösterilecek hizmetleri, süreleri ve online randevu durumunu buradan yönet.
          </p>
        </div>
        <Button type="button" className="h-11 w-fit rounded-xl" onClick={createService}>
          <Plus aria-hidden />
          Yeni hizmet
        </Button>
      </div>

      {notice ? (
        <p
          className="mt-6 rounded-xl border border-success/20 bg-success/5 px-4 py-3 text-sm text-success"
          role="status"
        >
          {notice}
        </p>
      ) : null}

      {services.length === 0 ? (
        <section className="mt-8 rounded-3xl border border-dashed border-border bg-card px-6 py-14 text-center">
          <Tag className="mx-auto size-8 text-muted-foreground" aria-hidden />
          <h2 className="mt-4 text-lg font-bold">Henüz hizmet eklenmemiş.</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            İlk hizmeti ekledikten sonra public hizmet ve randevu ekranlarında kullanılabilir.
          </p>
          <Button type="button" className="mt-6 rounded-xl" onClick={createService}>
            <Plus aria-hidden />
            İlk hizmeti ekle
          </Button>
        </section>
      ) : (
        <section aria-label="Hizmet listesi" className="mt-8 grid gap-4 md:grid-cols-2">
          {services.map((service) => (
            <article
              key={service.id}
              className="rounded-3xl border border-border bg-card p-5 shadow-atelier sm:p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-bold">{service.name}</h2>
                    <ServiceStateBadge service={service} />
                  </div>
                  <p className="mt-1 text-xs font-semibold text-primary">{service.category}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-10 shrink-0 rounded-xl"
                  onClick={() => editService(service)}
                  aria-label={`${service.name} hizmetini düzenle`}
                >
                  <Pencil className="size-4" aria-hidden />
                </Button>
              </div>

              <p className="mt-4 line-clamp-2 text-sm leading-6 text-muted-foreground">
                {service.shortDescription}
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">Fiyat</p>
                  <p className="mt-1 text-sm font-bold">{formatServicePrice(service)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">Süre</p>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-bold">
                    <Clock3 className="size-3.5 text-primary" aria-hidden />
                    {service.durationMinutes} dk
                  </p>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92dvh] max-w-3xl overflow-y-auto rounded-2xl bg-card p-0">
          <DialogHeader className="border-b border-border px-6 py-5 pr-14">
            <DialogTitle>
              {selectedService ? `${selectedService.name} hizmetini düzenle` : "Yeni hizmet ekle"}
            </DialogTitle>
            <DialogDescription>
              Fiyat, süre ve görünürlük bilgileri public site ile randevu akışını etkiler.
            </DialogDescription>
          </DialogHeader>
          <ServiceEditor
            key={selectedService?.id ?? "new-service"}
            service={selectedService}
            onCancel={() => setDialogOpen(false)}
            onFinished={(message) => {
              setDialogOpen(false);
              setNotice(message);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ServiceEditor({
  onCancel,
  onFinished,
  service,
}: {
  onCancel: () => void;
  onFinished: (message: string) => void;
  service?: AdminServiceItem;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [name, setName] = useState(service?.name ?? "");
  const [pending, setPending] = useState(false);
  const [priceType, setPriceType] = useState<AdminServiceItem["priceType"]>(
    service?.priceType ?? "fixed",
  );
  const [slug, setSlug] = useState(service?.slug ?? "");
  const [slugWasEdited, setSlugWasEdited] = useState(Boolean(service?.slug));

  function updateName(value: string) {
    setName(value);
    if (!slugWasEdited) setSlug(toSlug(value));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const data = new FormData(event.currentTarget);
    const rawPrice = String(data.get("price") ?? "")
      .trim()
      .replace(",", ".");
    setMessage("");
    setPending(true);

    try {
      const result = await upsertAdminServiceServerFn({
        data: {
          bufferAfterMinutes: Number(data.get("bufferAfterMinutes")),
          bufferBeforeMinutes: Number(data.get("bufferBeforeMinutes")),
          category: data.get("category"),
          coverImagePath: service?.coverImagePath,
          currency: service?.currency ?? "TRY",
          description: data.get("description"),
          displayOrder: Number(data.get("displayOrder")),
          durationMinutes: Number(data.get("durationMinutes")),
          expectedRowVersion: service?.rowVersion ?? null,
          id: service?.id ?? null,
          isActive: data.get("isActive") === "on",
          isBookable: data.get("isBookable") === "on",
          name,
          price: priceType === "quote_required" ? null : Number(rawPrice),
          priceType,
          shortDescription: data.get("shortDescription"),
          slug,
        },
      });

      if (result.status === "error") {
        if (result.code === "stale") {
          try {
            await router.invalidate();
          } catch {
            window.location.reload();
            return;
          }
          onFinished(result.message);
          return;
        }
        setMessage(result.message);
        return;
      }

      try {
        await router.invalidate();
      } catch {
        window.location.reload();
        return;
      }
      onFinished(service ? "Hizmet güncellendi." : "Yeni hizmet eklendi.");
    } catch {
      setMessage("Hizmet kaydedilemedi. Bağlantını kontrol edip tekrar dene.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-6 px-6 py-6" onSubmit={submit}>
      {message ? (
        <p
          className="rounded-xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error"
          role="alert"
        >
          {message}
        </p>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Hizmet adı" htmlFor="service-name">
          <Input
            id="service-name"
            name="name"
            required
            minLength={2}
            maxLength={120}
            value={name}
            className="h-11 rounded-xl"
            onChange={(event) => updateName(event.target.value)}
          />
        </Field>
        <Field
          label="URL kısa adı"
          htmlFor="service-slug"
          hint="Sadece küçük harf, rakam ve kısa çizgi."
        >
          <Input
            id="service-slug"
            name="slug"
            required
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            maxLength={160}
            value={slug}
            className="h-11 rounded-xl"
            onChange={(event) => {
              setSlugWasEdited(true);
              setSlug(event.target.value.toLowerCase());
            }}
          />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Kategori" htmlFor="service-category">
          <Input
            id="service-category"
            name="category"
            required
            minLength={2}
            maxLength={80}
            defaultValue={service?.category ?? ""}
            className="h-11 rounded-xl"
          />
        </Field>
        <Field label="Sıralama" htmlFor="service-order">
          <Input
            id="service-order"
            name="displayOrder"
            type="number"
            required
            min={0}
            max={100000}
            defaultValue={service?.displayOrder ?? 0}
            className="h-11 rounded-xl"
          />
        </Field>
      </div>

      <Field label="Kısa açıklama" htmlFor="service-short-description">
        <Textarea
          id="service-short-description"
          name="shortDescription"
          required
          minLength={10}
          maxLength={240}
          defaultValue={service?.shortDescription ?? ""}
          className="min-h-24 rounded-xl"
        />
      </Field>

      <Field label="Detaylı açıklama" htmlFor="service-description">
        <Textarea
          id="service-description"
          name="description"
          required
          minLength={10}
          maxLength={5000}
          defaultValue={service?.description ?? ""}
          className="min-h-36 rounded-xl"
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Fiyat türü" htmlFor="service-price-type">
          <select
            id="service-price-type"
            name="priceType"
            value={priceType}
            onChange={(event) => setPriceType(event.target.value as AdminServiceItem["priceType"])}
            className="h-11 w-full rounded-xl border border-input bg-background px-3 text-base shadow-sm outline-none focus:ring-2 focus:ring-ring md:text-sm"
          >
            <option value="fixed">Sabit fiyat</option>
            <option value="starting_from">Başlangıç fiyatı</option>
            <option value="quote_required">Görüşülecek</option>
          </select>
        </Field>
        <Field label="Fiyat (TL)" htmlFor="service-price">
          <Input
            id="service-price"
            name="price"
            type="number"
            inputMode="decimal"
            min={0}
            max={99999999.99}
            step="0.01"
            required={priceType !== "quote_required"}
            disabled={priceType === "quote_required"}
            defaultValue={service?.price ?? ""}
            className="h-11 rounded-xl"
          />
        </Field>
        <Field label="Süre (dakika)" htmlFor="service-duration">
          <Input
            id="service-duration"
            name="durationMinutes"
            type="number"
            required
            min={15}
            max={720}
            step={5}
            defaultValue={service?.durationMinutes ?? 60}
            className="h-11 rounded-xl"
          />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Ön hazırlık tamponu (dk)" htmlFor="service-buffer-before">
          <Input
            id="service-buffer-before"
            name="bufferBeforeMinutes"
            type="number"
            required
            min={0}
            max={240}
            step={5}
            defaultValue={service?.bufferBeforeMinutes ?? 0}
            className="h-11 rounded-xl"
          />
        </Field>
        <Field label="Sonraki hazırlık tamponu (dk)" htmlFor="service-buffer-after">
          <Input
            id="service-buffer-after"
            name="bufferAfterMinutes"
            type="number"
            required
            min={0}
            max={240}
            step={5}
            defaultValue={service?.bufferAfterMinutes ?? 0}
            className="h-11 rounded-xl"
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <CheckField
          name="isActive"
          label="Public sitede göster"
          description="Kapalı olduğunda hizmet public listelerde görünmez."
          defaultChecked={service?.isActive ?? true}
        />
        <CheckField
          name="isBookable"
          label="Online randevuya açık"
          description="Kapalı olduğunda bu hizmet için saat seçilemez."
          defaultChecked={service?.isBookable ?? true}
        />
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          className="h-11 rounded-xl"
          onClick={onCancel}
          disabled={pending}
        >
          Vazgeç
        </Button>
        <Button type="submit" className="h-11 rounded-xl" disabled={pending}>
          {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <Save aria-hidden />}
          {pending ? "Kaydediliyor" : "Hizmeti kaydet"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  children,
  hint,
  htmlFor,
  label,
}: {
  children: ReactNode;
  hint?: string;
  htmlFor: string;
  label: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-xs leading-5 text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function CheckField({
  defaultChecked,
  description,
  label,
  name,
}: {
  defaultChecked: boolean;
  description: string;
  label: string;
  name: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border p-4">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-1 size-4 accent-primary"
      />
      <span>
        <span className="block text-sm font-bold">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}

function ServiceStateBadge({ service }: { service: AdminServiceItem }) {
  const label = !service.isActive
    ? "Yayında değil"
    : service.isBookable
      ? "Randevuya açık"
      : "Sadece gösterim";

  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-lg shadow-none",
        service.isActive && service.isBookable
          ? "border-success/20 bg-success/10 text-success"
          : "border-border bg-muted text-muted-foreground",
      )}
    >
      {label}
    </Badge>
  );
}

function formatServicePrice(service: AdminServiceItem) {
  if (service.priceType === "quote_required") return "Görüşülecek";
  if (service.price === undefined) return "Belirtilmedi";

  const formatted = new Intl.NumberFormat("tr-TR", {
    currency: service.currency,
    maximumFractionDigits: Number.isInteger(service.price) ? 0 : 2,
    style: "currency",
  }).format(service.price);
  return service.priceType === "starting_from" ? `${formatted} başlangıç` : formatted;
}

function toSlug(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replaceAll("ı", "i")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ş", "s")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
