import { useRouter } from "@tanstack/react-router";
import { Mail, MessageCircle, Save } from "lucide-react";
import { useEffect, useState } from "react";

import { updateAdminContactStatusServerFn } from "@/features/admin/admin.server-fns";
import type {
  AdminContactMessageItem,
  AdminContactMessageListData,
} from "@/features/admin/admin.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const statusLabels: Record<AdminContactMessageItem["status"], string> = {
  in_progress: "İşlemde",
  new: "Yeni",
  resolved: "Çözüldü",
  spam: "Spam",
};

const statusClasses: Record<AdminContactMessageItem["status"], string> = {
  in_progress: "border-primary/20 bg-primary/10 text-primary",
  new: "border-error/20 bg-error/10 text-error",
  resolved: "border-success/20 bg-success/10 text-success",
  spam: "border-border bg-muted text-muted-foreground",
};

export function AdminMessages({ data }: { data: AdminContactMessageListData }) {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow mb-2">İletişim</p>
          <h1 className="font-sans text-2xl font-bold tracking-tight sm:text-3xl">
            Gelen mesajlar
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            İletişim formundan gönderilen soruları ve takip durumunu yönet.
          </p>
        </div>
        <div className="w-fit rounded-full border border-border bg-card px-3 py-2 text-xs font-bold text-muted-foreground">
          {data.totalCount} mesaj
        </div>
      </div>

      {data.items.length === 0 ? (
        <section className="mt-8 rounded-3xl border border-dashed border-border bg-card px-6 py-14 text-center">
          <Mail className="mx-auto size-8 text-muted-foreground" aria-hidden />
          <h2 className="mt-4 text-lg font-bold">Henüz mesaj yok.</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Public iletişim formundan gelen mesajlar burada görünecek.
          </p>
        </section>
      ) : (
        <section aria-label="İletişim mesajları" className="mt-8 space-y-4">
          {data.items.map((message) => (
            <MessageCard key={message.id} message={message} />
          ))}
          {data.totalCount > data.items.length ? (
            <p className="text-center text-xs text-muted-foreground">
              Güvenli liste sınırı nedeniyle en yeni {data.items.length} mesaj gösteriliyor.
            </p>
          ) : null}
        </section>
      )}
    </div>
  );
}

function MessageCard({ message }: { message: AdminContactMessageItem }) {
  const router = useRouter();
  const [feedback, setFeedback] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState(message.status);

  useEffect(() => {
    setStatus(message.status);
  }, [message.status]);

  async function saveStatus() {
    if (pending || status === message.status) return;
    setFeedback("");
    setPending(true);

    try {
      const result = await updateAdminContactStatusServerFn({
        data: {
          expectedRowVersion: message.rowVersion,
          id: message.id,
          status,
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
        }
        setFeedback(result.message);
        return;
      }

      setFeedback("Mesaj durumu güncellendi.");
      try {
        await router.invalidate();
      } catch {
        window.location.reload();
      }
    } catch {
      setFeedback("Mesaj durumu güncellenemedi. Bağlantını kontrol edip tekrar dene.");
    } finally {
      setPending(false);
    }
  }

  return (
    <article className="rounded-3xl border border-border bg-card p-5 shadow-atelier sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold">{message.fullName}</h2>
            <Badge
              variant="outline"
              className={cn("rounded-lg shadow-none", statusClasses[message.status])}
            >
              {statusLabels[message.status]}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatMessageDate(message.createdAt)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {message.phone ? (
            <>
              <a
                href={`tel:${message.phone}`}
                className="inline-flex h-10 items-center rounded-xl border border-border px-3 text-xs font-bold text-primary transition-colors hover:bg-muted"
              >
                {message.phone}
              </a>
              <a
                href={createWhatsAppUrl(message)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex size-10 items-center justify-center rounded-xl border border-border text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                aria-label={`${message.fullName} kişisine WhatsApp üzerinden yaz`}
              >
                <MessageCircle className="size-4" aria-hidden />
              </a>
            </>
          ) : null}
          {message.email ? (
            <a
              href={`mailto:${message.email}`}
              className="inline-flex size-10 items-center justify-center rounded-xl border border-border text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
              aria-label={`${message.fullName} kişisine e-posta gönder`}
            >
              <Mail className="size-4" aria-hidden />
            </a>
          ) : null}
        </div>
      </div>

      <p className="mt-5 whitespace-pre-wrap break-words rounded-2xl bg-muted/45 p-4 text-sm leading-6">
        {message.message}
      </p>

      <div className="mt-5 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full sm:max-w-xs">
          <label htmlFor={`message-status-${message.id}`} className="mb-2 block text-xs font-bold">
            Takip durumu
          </label>
          <select
            id={`message-status-${message.id}`}
            value={status}
            disabled={pending}
            onChange={(event) => {
              setStatus(event.target.value as AdminContactMessageItem["status"]);
              setFeedback("");
            }}
            className="h-11 w-full rounded-xl border border-input bg-background px-3 text-base shadow-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60 md:text-sm"
          >
            <option value="new">Yeni</option>
            <option value="in_progress">İşlemde</option>
            <option value="resolved">Çözüldü</option>
            <option value="spam">Spam</option>
          </select>
        </div>
        <Button
          type="button"
          className="h-11 rounded-xl"
          disabled={pending || status === message.status}
          onClick={saveStatus}
        >
          <Save aria-hidden />
          {pending ? "Kaydediliyor" : "Durumu kaydet"}
        </Button>
      </div>

      {feedback ? (
        <p
          className={cn(
            "mt-3 text-xs",
            feedback === "Mesaj durumu güncellendi." ? "text-success" : "text-error",
          )}
          role="status"
        >
          {feedback}
        </p>
      ) : null}
    </article>
  );
}

function formatMessageDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Istanbul",
  }).format(new Date(value));
}

function createWhatsAppUrl(message: AdminContactMessageItem) {
  const phone = message.phone?.replace(/\D/g, "") ?? "";
  const text = encodeURIComponent(`Merhaba ${message.fullName}, mesajınızla ilgili yazıyorum.`);
  return `https://wa.me/${phone}?text=${text}`;
}
