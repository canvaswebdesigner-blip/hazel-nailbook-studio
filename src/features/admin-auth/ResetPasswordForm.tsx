import { CheckCircle2, KeyRound, LoaderCircle } from "lucide-react";
import { useState, type FormEvent } from "react";

import { resetAdminPasswordServerFn } from "./admin-auth.server-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ResetPasswordForm() {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const data = new FormData(event.currentTarget);
    setMessage("");
    setPending(true);
    try {
      const result = await resetAdminPasswordServerFn({
        data: {
          confirmPassword: data.get("confirmPassword"),
          password: data.get("password"),
        },
      });
      if (result.status === "success") {
        setSuccess(true);
        return;
      }
      setMessage(result.message);
    } catch {
      setMessage("Şifre güncellenemedi. Yeni bir kurtarma bağlantısı iste.");
    } finally {
      setPending(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-success/25 bg-success/10 p-5">
        <CheckCircle2 className="size-5 text-success" aria-hidden />
        <h2 className="mt-3 text-sm font-bold">Şifre güncellendi</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Eski yönetim oturumları kapatıldı. Yeni şifren ve doğrulama kodunla tekrar giriş yap.
        </p>
        <a
          href="/admin/giris"
          className="mt-4 inline-flex text-sm font-semibold text-primary hover:underline"
        >
          Güvenli girişe geç
        </a>
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="new-password">Yeni şifre</Label>
        <Input
          id="new-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
          className="h-12 rounded-xl bg-background px-4"
          aria-describedby="password-help"
        />
        <p id="password-help" className="text-xs leading-5 text-muted-foreground">
          En az 12 karakter; en az bir harf ve bir rakam kullan.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm-password">Yeni şifreyi tekrar yaz</Label>
        <Input
          id="confirm-password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
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
        {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <KeyRound aria-hidden />}
        {pending ? "Güncelleniyor" : "Şifreyi güvenle güncelle"}
      </Button>
    </form>
  );
}
