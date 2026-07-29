# Hazel Ağaoğlu Nail Art Studio

Hazel Ağaoğlu Nail Art Studio için geliştirilen Türkçe, mobil öncelikli web
sitesi ve randevu ürünü.

Proje Lovable ile bağlantılıdır. GitHub'a gönderilen commit'ler Lovable
editörüne de yansır. Yayınlanmış geçmişi force-push, rebase, amend veya squash
ile yeniden yazmayın.

## Gereksinimler

- [Bun 1.3.14](https://bun.sh/)
- Git
- Veritabanı geliştirme ve testleri için Docker Desktop

Bağımlılıklar yalnızca `bun.lock` üzerinden kurulmalıdır. npm, pnpm veya yarn
lockfile'ı eklemeyin.

## Yerel geliştirme

```sh
git clone https://github.com/canvaswebdesigner-blip/hazel-nailbook-studio.git
cd hazel-nailbook-studio
bun install --frozen-lockfile
bun run dev
```

Vite geliştirme sunucusunun terminalde gösterdiği yerel adresi açın.

## Kalite kontrolleri

```sh
bun run format:check
bun run lint
bun run typecheck
bun run build
```

Tüm kontrolleri sırayla çalıştırmak için:

```sh
bun run check
```

`format:check` dosya yazmaz. Biçimlendirmeyi bilinçli olarak uygulamak için
`bun run format` kullanılabilir.

## Yerel veritabanı

Supabase CLI proje bağımlılığı olarak sabitlenmiştir. Docker çalışırken:

```sh
bun run db:start
bun run check:db
bun run db:stop
```

`check:db`, veritabanını migration'lardan temiz biçimde kurar; public/private
şemaları lint eder ve `supabase/tests/database` altındaki pgTAP testlerini
çalıştırır. Bu kontroller frontend `check` komutundan ayrıdır; CI'da iki iş
paralel çalışır.

Migration, erişim ve admin bootstrap ayrıntıları için
[`docs/database/README.md`](docs/database/README.md) dosyasına bakın.

Güncel doğrulama sınırları ve production teslim engelleri için
[`docs/delivery-readiness.md`](docs/delivery-readiness.md) dosyasına bakın.

## Temel teknoloji

- TanStack Start
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase PostgreSQL, Auth ve Storage

## Ortam ve veri güvenliği

- Gerçek müşteri verisini yerel veya preview ortamlarında kullanmayın.
- Gizli değerleri `.env` dosyalarında tutun; bunları Git'e göndermeyin.
- Tarayıcıya aktarılmaması gereken hiçbir sırrı `VITE_` önekiyle tanımlamayın.

Production ortamı, veritabanı migration'ları ve gerekli gizli değerler ayrıca
yapılandırılmadan proje teslim edilmiş sayılmaz.
