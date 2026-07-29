import { LoaderCircle, QrCode } from "lucide-react";
import { useState } from "react";

import { startMfaEnrollmentServerFn } from "./admin-auth.server-fns";
import type { MfaEnrollmentResult } from "./admin-auth.types";
import { MfaVerificationForm } from "./MfaVerificationForm";
import { Button } from "@/components/ui/button";

export function MfaEnrollmentPanel() {
  const [result, setResult] = useState<MfaEnrollmentResult | null>(null);
  const [pending, setPending] = useState(false);

  async function startEnrollment() {
    if (pending) return;
    setPending(true);
    try {
      setResult(await startMfaEnrollmentServerFn());
    } catch {
      setResult({ message: "Güvenlik kurulumu başlatılamadı.", status: "error" });
    } finally {
      setPending(false);
    }
  }

  if (result?.status === "success") {
    return (
      <div className="space-y-6">
        <ol className="space-y-3 text-sm leading-6 text-muted-foreground">
          <li>1. Telefonundaki doğrulama uygulamasında yeni hesap ekle.</li>
          <li>2. Aşağıdaki QR kodunu tara.</li>
          <li>3. Uygulamanın ürettiği 6 haneli kodu doğrula.</li>
        </ol>

        <div className="mx-auto w-fit rounded-2xl border border-border bg-white p-4">
          <img
            src={result.qrCodeDataUrl}
            alt="Hazel yönetim paneli iki adımlı doğrulama QR kodu"
            width={220}
            height={220}
          />
        </div>

        <details className="rounded-xl border border-border bg-background p-4">
          <summary className="cursor-pointer text-sm font-semibold">
            QR kodunu tarayamıyorum
          </summary>
          <p className="mt-3 text-xs text-muted-foreground">
            Bu anahtarı doğrulama uygulamasına elle gir. Anahtarı kimseyle paylaşma.
          </p>
          <code className="mt-2 block break-all rounded-lg bg-muted p-3 text-xs">
            {result.secret}
          </code>
        </details>

        <MfaVerificationForm factorId={result.factorId} />
      </div>
    );
  }

  return (
    <div>
      <div className="rounded-2xl border border-border bg-muted/50 p-4 text-sm leading-6 text-muted-foreground">
        Her girişte şifrenin ardından telefonundaki doğrulama uygulamasından tek kullanımlık kod
        istenecek.
      </div>
      <p
        className={result?.status === "error" ? "mt-4 text-sm text-destructive" : "sr-only"}
        role="alert"
      >
        {result?.status === "error" ? result.message : "Hata yok"}
      </p>
      <Button
        type="button"
        disabled={pending}
        onClick={startEnrollment}
        className="mt-5 h-12 w-full rounded-xl"
      >
        {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <QrCode aria-hidden />}
        {pending ? "Hazırlanıyor" : "İki adımlı doğrulamayı kur"}
      </Button>
    </div>
  );
}
