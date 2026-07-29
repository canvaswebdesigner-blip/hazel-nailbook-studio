# Teslim hazırlığı

Son denetim: 29 Temmuz 2026

## Mevcut durum

Çalışma ağacında kayıp tespit edilmedi. Repo `main` dalında
`origin/main` bağlantısını koruyor. Bu çalışma henüz commit veya push edilmedi;
değişiklikler yerel çalışma ağacında duruyor.

Tamamlanan ana sınırlar:

- Public sayfa kabuğu ve mevcut tüm public route'lar
- Tasarım token'ları, self-host fontlar ve responsive temel
- Güvenlik başlıkları, CSRF temeli, güvenli environment ayrımı
- Public hizmet/müsaitlik okuma sözleşmeleri
- Transaction tabanlı randevu oluşturma
- Çakışma önleme, idempotency, policy/consent snapshot'ları
- Receipt ve management token exchange akışı
- Tokenless randevu görüntüleme
- Müşteri iptal ve tarih değiştirme işlemleri
- Güvenli, idempotent iletişim formu backend sınırı ve UI
- RLS/grant modeli, private schema ve pgTAP sözleşmeleri
- CI yapılandırmasının frontend ve database işleri
- Server-only admin Auth, güvenli HttpOnly oturum çerezleri ve logout
- TOTP MFA enrollment/verification ile AAL2 admin kapısı
- PKCE tabanlı şifre kurtarma ve tek kullanımlık recovery session
- 30 dakika idle, 12 saat absolute ve tek aktif admin oturumu sınırları
- Güvenli admin dashboard ve bounded randevu-listesi projection RPC'leri
- Gerçek veriye bağlı admin dashboard, responsive randevu listesi ve ayrı admin
  route chunk'ları
- AAL2 admin RLS okuması ve narrow `admin_upsert_service` RPC'si kullanan hizmet
  ekleme/düzenleme ekranı
- PII allowlist'iyle server-side okunan iletişim gelen kutusu ve narrow
  `admin_update_contact_status` RPC'si kullanan takip durumu yönetimi

## Bu denetimde doğrulananlar

- TypeScript typecheck: geçti
- ESLint: 0 hata, mevcut shadcn dosyalarında 6 Fast Refresh uyarısı
- Production build: geçti
- `git diff --check`: geçti
- pgTAP plan/assertion sayıları:
  - `001`: 25/25
  - `002`: 26/26
  - `003`: 17/17
  - `004`: 45/45
  - `005`: 30/30
  - `006`: 42/42
  - `007`: 36/36
  - `008`: 25/25
  - `009`: 18/18
  - `010`: 16/16
- Admin route üretimi: `/admin`, `/admin/randevular`, `/admin/hizmetler` ve
  `/admin/mesajlar` doğrulandı
- Bundle ayrımı: dashboard ve randevu route'ları ayrı lazy chunk'larda; admin
  özellik işaretleri ilk public entry bundle'ında bulunmadı
- İletişim sayfasının environment eksikken güvenli biçimde kapanan görünümü:
  masaüstünde açıldı, semantik yapı ve yatay taşma kontrolü geçti

pgTAP dosyalarının sayısal tutarlılığı gerçek PostgreSQL çalıştırmasının yerine
geçmez. Bu makinede Docker/Podman bulunmadığı için temiz veritabanı kurulumu,
migration execution, database lint ve pgTAP runtime testleri çalıştırılamadı.

## Production teslim engelleri

### P0 — teslimden önce zorunlu

1. **Veritabanı runtime doğrulaması**
   - Docker Desktop ile temiz local Supabase kurulumu veya izole staging projesi
   - Tüm migration'ların sırayla uygulanması
   - Database lint ve on pgTAP dosyasının gerçek çalıştırılması
   - Concurrency testlerinin bağımsız bağlantılarla doğrulanması
   - Üretilmiş TypeScript DB type'larının authoritative schema'dan yenilenmesi

2. **Admin operasyon ürününün tamamlanması**
   - Giriş, PKCE recovery, TOTP MFA, AAL2 koruması, dashboard ve güvenli randevu
     okuması mevcut
   - Randevu oluşturma/düzenleme/iptal/tamamlama/no-show mutation ekranları
   - Takvim, çalışma saati, istisna, mola ve booking-off ekranları
   - Hizmet ekleme/düzenleme ve soft-deactivate temeli mevcut; görsel yükleme
     storage pipeline tamamlanınca bağlanmalı
   - Mesaj okuma/durum yönetimi mevcut; arama, pagination ve toplu işlem
     gerekirse launch öncesi eklenmeli
   - Müşteri, galeri, yorum, SSS, bildirim ve ayar yönetimi
   - Tüm admin mutation'larının narrow RPC, audit, lock ve row-version
     sözleşmelerine bağlanması
   - Link regeneration ve recent-reauth UX'i
   - Dashboard ve randevu listesi read-only; hizmet ve mesaj modülleri sınırlı
     mutation desteğine sahip. Panel henüz tam operasyon ürünü değildir

3. **Gerçek işletme ve hukuki içerik**
   - Adres, telefon, WhatsApp, Instagram, harita ve saatler
   - Gerçek hizmetler, fiyat türleri, fiyatlar, süreler ve buffer'lar
   - Hazel biyografisi, gerçek fotoğraflar ve izinli müşteri yorumları
   - Onaylı gizlilik, kullanım, booking/cancellation ve cookie metinleri
   - Policy version kayıtları ve veri saklama kararı

4. **Production environment ve deploy**
   - Hedef Supabase/Lovable Cloud projesinin kesinleştirilmesi
   - Publishable key, service-role secret, HMAC key ring ve rate-limit secret
   - Staging ve production environment ayrımı
   - Domain, HTTPS, DNS ve production smoke testleri
   - Admin hesabı ve production SMTP doğrulaması

5. **Storage finalization**
   - Admin gallery upload UI
   - Signed staging upload
   - Server-side signature/decode/dimension kontrolü
   - Re-encode, EXIF temizleme, responsive varyant üretimi ve cleanup
   - Gerçek Storage policy ve upload testleri

6. **Operations**
   - Monitoring ve uyarılar
   - Managed backup doğrulaması
   - Şifreli logical export
   - Database ve HMAC key-ring restore testi
   - RPO/RTO ve disaster-recovery runbook

### P1 — launch kalitesi

1. Public hizmet, galeri, SSS, işletme bilgisi ve çalışma saatlerini statik
   placeholder kaynaktan gerçek public projection RPC'lerine taşı.
2. Ana sayfadaki "en yakın müsaitlik" bölümünü gerçek availability verisine
   bağla. Şu anda gerçek takvim yalnızca `/randevu` akışında kullanılıyor.
3. Canonical URL, sitemap, robots, Open Graph görseli, BeautySalon/Service/
   Breadcrumb JSON-LD ve production NAP doğrulamasını tamamla.
4. 360, 390, 430, 768, 1024 ve 1280+ responsive matrisi ile tam görsel QA yap.
5. Klavye, screen reader, calendar, dialog/lightbox ve form hata akışlarını
   erişilebilirlik testinden geçir.
6. Gerçek environment ile public booking, conflict, receipt, management,
   reschedule, cancel ve contact form E2E testlerini çalıştır.
7. Root Vite sürümü ile Lovable/TanStack altında çözülen Vite sürümünü hizala;
   ardından lockfile'ı frozen install ile yeniden doğrula.
8. Analytics kullanılacaksa gerçek consent davranışını uygulamadan yükleme.

## Sonraki uygulama sırası

1. Staging/local database runtime'ını çalışır hale getir ve migration/pgTAP
   engelini kaldır.
2. Admin randevu mutation'larını ve row-version/stale-write UX'ini tamamla.
3. Takvim, çalışma saatleri, istisnalar ve booking-off yönetimini ekle.
4. Müşteri, galeri, yorum, SSS, bildirim ve ayar yönetimini ekle.
5. Gallery storage pipeline'ını tamamla.
6. Public statik içerikleri database projection'larına bağla.
7. SEO, accessibility, responsive E2E, monitoring ve restore drill'i bitir.
8. Gerçek içerikleri gir, staging kabul testi yap, sonra production deploy et.

## Teslim hükmü

Kod tabanı artık basit bir vitrin sitesi değil; gerçek booking, appointment
management, contact mutation, server-only admin Auth/MFA ve güvenli admin read
projection sınırlarına sahip güçlü bir temel. Admin tarafında dashboard,
randevu okuma, hizmet yönetimi ve mesaj takibi bulunuyor. Buna rağmen randevu
mutation'ları, takvim ve kalan operasyon modülleri tamamlanmadığı; SQL gerçek
PostgreSQL üzerinde henüz çalıştırılmadığı ve production işletme/config verileri
eksik olduğu için proje şu anda **production-ready veya müşteriye teslim
edilebilir olarak işaretlenmemelidir**.
