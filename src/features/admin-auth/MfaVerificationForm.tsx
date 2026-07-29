import { KeyRound, LoaderCircle } from "lucide-react";
import { useState, type FormEvent } from "react";

import { verifyMfaServerFn } from "./admin-auth.server-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function MfaVerificationForm({ factorId }: { factorId: string }) {
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
      const result = await verifyMfaServerFn({
        data: {
          code: data.get("code"),
          factorId,
        },
      });
      if (result.status === "success") {
        window.location.assign(result.nextPath);
        return;
      }
      setMessage(result.message);
    } catch {
      setMessage("Kod doğrulanamadı. Tekrar dene.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="mfa-code">6 haneli doğrulama kodu</Label>
        <Input
          id="mfa-code"
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          minLength={6}
          maxLength={6}
          required
          className="h-14 rounded-xl bg-background px-4 text-center font-mono text-xl tracking-[0.35em]"
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
        {pending ? "Doğrulanıyor" : "Kodu doğrula"}
      </Button>
    </form>
  );
}
