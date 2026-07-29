import { CheckCircle2, LoaderCircle, Mail } from "lucide-react";
import { useState, type FormEvent } from "react";

import { forgotAdminPasswordServerFn } from "./admin-auth.server-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordForm() {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const data = new FormData(event.currentTarget);
    setMessage("");
    setPending(true);
    try {
      const result = await forgotAdminPasswordServerFn({
        data: { email: data.get("email") },
      });
      if (result.status === "rate_limited") {
        setMessage(
          `Çok fazla istek gönderildi. ${result.retryAfterSeconds} saniye sonra tekrar dene.`,
        );
        return;
      }
      setSent(true);
    } catch {
      // Keep the public response generic so the form never reveals whether an
      // administrator account exists for the submitted address.
      setSent(true);
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-success/25 bg-success/10 p-5">
        <CheckCircle2 className="size-5 text-success" aria-hidden />
        <h2 className="mt-3 text-sm font-bold">E-postanı kontrol et</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Bu adres yetkili bir hesaba aitse kısa süre içinde tek kullanımlık şifre yenileme
          bağlantısı gönderilecek.
        </p>
        <a
          href="/admin/giris"
          className="mt-4 inline-flex text-sm font-semibold text-primary hover:underline"
        >
          Giriş ekranına dön
        </a>
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="recovery-email">Yönetici e-postası</Label>
        <Input
          id="recovery-email"
          name="email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          required
          className="h-12 rounded-xl bg-background px-4"
        />
      </div>

      <p
        className={message ? "text-sm text-destructive" : "sr-only"}
        role="alert"
        aria-live="polite"
      >
        {message || "Hata yok"}
      </p>

      <Button type="submit" disabled={pending} className="h-12 w-full rounded-xl">
        {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <Mail aria-hidden />}
        {pending ? "Gönderiliyor" : "Kurtarma bağlantısı gönder"}
      </Button>
    </form>
  );
}
