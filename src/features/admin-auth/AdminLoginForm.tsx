import { LoaderCircle, LogIn } from "lucide-react";
import { useState, type FormEvent } from "react";

import { loginAdminServerFn } from "./admin-auth.server-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AdminLoginForm() {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const form = event.currentTarget;
    const data = new FormData(form);
    setMessage("");
    setPending(true);

    try {
      const result = await loginAdminServerFn({
        data: {
          email: data.get("email"),
          password: data.get("password"),
        },
      });

      if (result.status === "success") {
        window.location.assign(result.nextPath);
        return;
      }

      setMessage(
        result.status === "rate_limited"
          ? `Çok fazla deneme yapıldı. ${result.retryAfterSeconds} saniye sonra tekrar dene.`
          : result.message,
      );
    } catch {
      setMessage("Giriş şu anda tamamlanamadı. Biraz sonra tekrar dene.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="admin-email">E-posta</Label>
        <Input
          id="admin-email"
          name="email"
          type="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          className="h-12 rounded-xl bg-background px-4"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="admin-password">Şifre</Label>
          <a
            href="/admin/sifremi-unuttum"
            className="text-xs font-semibold text-primary hover:underline"
          >
            Şifremi unuttum
          </a>
        </div>
        <Input
          id="admin-password"
          name="password"
          type="password"
          autoComplete="current-password"
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
        {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <LogIn aria-hidden />}
        {pending ? "Kontrol ediliyor" : "Güvenli giriş yap"}
      </Button>
    </form>
  );
}
