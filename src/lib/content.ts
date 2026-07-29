/**
 * Placeholder business content for Hazel Ağaoğlu Nail Art Studio.
 *
 * Every value marked with `PLACEHOLDER` must be replaced with the real
 * business information before launch. In later phases this data is served
 * from Lovable Cloud and edited from the admin panel.
 */

export const IS_PLACEHOLDER_CONTENT = true;

export const business = {
  name: "Hazel Ağaoğlu Nail Art Studio",
  shortName: "Hazel Ağaoğlu",
  tagline: "Güzellik detaylarda saklı.",
  promise: "Hizmetleri, süreleri ve stüdyo detaylarını tek yerde incele.",
  /** PLACEHOLDER */
  address: "Buca, İzmir (adres bilgisi yakında eklenecek)",
  /** PLACEHOLDER */
  district: "Buca, İzmir",
  /** PLACEHOLDER */
  phoneDisplay: "Telefon yakında eklenecek",
  /** PLACEHOLDER */
  whatsappUrl: "#",
  /** PLACEHOLDER */
  instagramUrl: "#",
  /** PLACEHOLDER */
  mapsUrl: "#",
  timezone: "Europe/Istanbul",
} as const;

export type BusinessHour = {
  day: string;
  hours: string;
  closed?: boolean;
};

/** PLACEHOLDER — admin panelinden düzenlenecek. */
export const businessHours: BusinessHour[] = [
  { day: "Pazartesi", hours: "10:00 – 19:00" },
  { day: "Salı", hours: "10:00 – 19:00" },
  { day: "Çarşamba", hours: "10:00 – 19:00" },
  { day: "Perşembe", hours: "10:00 – 19:00" },
  { day: "Cuma", hours: "10:00 – 19:00" },
  { day: "Cumartesi", hours: "11:00 – 17:00" },
  { day: "Pazar", hours: "Kapalı", closed: true },
];

export type ServiceCategory = "manikur" | "protez" | "nail-art" | "bakim";

export const serviceCategories: { id: ServiceCategory; label: string }[] = [
  { id: "manikur", label: "Manikür" },
  { id: "protez", label: "Protez & Uzatma" },
  { id: "nail-art", label: "Nail Art" },
  { id: "bakim", label: "Bakım" },
];

export type Service = {
  slug: string;
  name: string;
  category: ServiceCategory;
  shortDescription: string;
  description: string;
  priceType: "fixed" | "starting_from" | "quote_required";
  price?: number;
  durationMinutes: number;
  suitableFor: string;
  preparation: string;
  aftercare: string;
  featured?: boolean;
};

/** PLACEHOLDER — fiyat ve süreler onaylandıktan sonra güncellenecek. */
export const services: Service[] = [
  {
    slug: "klasik-manikur",
    name: "Klasik Manikür",
    category: "manikur",
    shortDescription: "Tırnak şekillendirme, kütikül bakımı ve nemlendirme.",
    description:
      "Tırnaklarının şeklini ve kütikül bölgesini özenle düzenlediğimiz, günlük bakımın temelini oluşturan uygulamadır. Ellerin dinlenmiş ve bakımlı görünmesini sağlar.",
    priceType: "starting_from",
    price: 0,
    durationMinutes: 45,
    suitableFor: "Doğal ve sade bir görünüm isteyenler için.",
    preparation: "Uygulamadan önce el kremi kullanmamanı rica ediyoruz.",
    aftercare: "Günde iki kez kütikül yağı kullanman yeterli.",
    featured: true,
  },
  {
    slug: "kalici-oje",
    name: "Kalıcı Oje",
    category: "manikur",
    shortDescription: "Haftalarca parlaklığını koruyan kalıcı oje uygulaması.",
    description:
      "Tırnak yüzeyi hazırlandıktan sonra kalıcı oje katmanları uygulanır ve UV/LED ile kurutulur. Günlük yoğun tempoda bile uzun süre bozulmadan kalır.",
    priceType: "starting_from",
    price: 0,
    durationMinutes: 60,
    suitableFor: "Uzun süre dayanıklı renk isteyenler için.",
    preparation: "Önceki uygulaman varsa lütfen kendin sökmeden gel.",
    aftercare: "Temizlik yaparken eldiven kullanman ömrünü uzatır.",
    featured: true,
  },
  {
    slug: "protez-tirnak",
    name: "Protez Tırnak",
    category: "protez",
    shortDescription: "Doğal görünümlü uzatma ve form çalışması.",
    description:
      "Tırnak yapına uygun form seçilerek uzatma yapılır. Doğal görünüm ve dayanıklılık birlikte planlanır.",
    priceType: "quote_required",
    durationMinutes: 120,
    suitableFor: "Tırnağı kırılan veya uzatmak isteyenler için.",
    preparation: "Randevudan önce tırnaklarını kesmemeni öneriyoruz.",
    aftercare: "3–4 haftada bir dolgu randevusu planlamak gerekir.",
    featured: true,
  },
  {
    slug: "nail-art-tasarim",
    name: "Nail Art Tasarım",
    category: "nail-art",
    shortDescription: "Sana özel çizim, doku ve detay çalışmaları.",
    description:
      "İlham görsellerinden yola çıkarak tırnak boyutuna uygun, dengeli bir tasarım kurgulanır. Tek tırnak detayından tam set çalışmaya kadar uyarlanabilir.",
    priceType: "quote_required",
    durationMinutes: 90,
    suitableFor: "Özel gün veya karakterli bir görünüm isteyenler için.",
    preparation: "İlham görsellerini randevudan önce paylaşabilirsin.",
    aftercare: "Tasarımlı tırnaklarda darbeye karşı biraz daha dikkatli ol.",
    featured: true,
  },
  {
    slug: "dolgu",
    name: "Dolgu",
    category: "protez",
    shortDescription: "Mevcut uygulamanın yenilenmesi ve form düzeltme.",
    description:
      "Uzayan tırnak dibinin kapatılması, formun yeniden düzenlenmesi ve yüzeyin yenilenmesi işlemidir.",
    priceType: "starting_from",
    price: 0,
    durationMinutes: 90,
    suitableFor: "Protez veya kalıcı uygulaması olanlar için.",
    preparation: "Kalkma veya kırık varsa randevu notuna yazman iyi olur.",
    aftercare: "Düzenli aralıklarla dolgu, tırnak sağlığını korur.",
  },
  {
    slug: "tirnak-bakimi",
    name: "Tırnak Onarım & Bakım",
    category: "bakim",
    shortDescription: "Yıpranmış tırnaklar için onarıcı bakım programı.",
    description:
      "Zayıflamış tırnaklar için güçlendirici bakım ve kütikül onarımı uygulanır. Gerekirse birden fazla seansa yayılır.",
    priceType: "starting_from",
    price: 0,
    durationMinutes: 45,
    suitableFor: "Kırılgan ve yıpranmış tırnaklar için.",
    preparation: "Varsa kullandığın ürünleri belirtmen faydalı olur.",
    aftercare: "Bakım yağı ve nemlendirici kullanımı önemlidir.",
  },
];

export type GalleryItem = {
  id: string;
  title: string;
  category: ServiceCategory;
};

/** PLACEHOLDER — gerçek fotoğraflar admin panelinden yüklenecek. */
export const galleryItems: GalleryItem[] = [
  { id: "g1", title: "Nude finish", category: "manikur" },
  { id: "g2", title: "French detay", category: "manikur" },
  { id: "g3", title: "Badem form", category: "protez" },
  { id: "g4", title: "Mat bordo", category: "manikur" },
  { id: "g5", title: "Çizgi çalışması", category: "nail-art" },
  { id: "g6", title: "Krom yansıma", category: "nail-art" },
  { id: "g7", title: "Uzun form", category: "protez" },
  { id: "g8", title: "Onarım sonrası", category: "bakim" },
];

export type FaqItem = {
  id: string;
  question: string;
  answer: string;
  category: "randevu" | "uygulama" | "bakim" | "hijyen";
};

export const faqItems: FaqItem[] = [
  {
    id: "f1",
    question: "Randevu almadan gelebilir miyim?",
    answer:
      "Randevusuz kabul kuralı işletme tarafından henüz onaylanmadı. Uygun bir saati garanti etmek için online takvimden randevu oluşturman önerilir.",
    category: "randevu",
  },
  {
    id: "f2",
    question: "Randevumu nasıl iptal ederim veya değiştiririm?",
    answer:
      "Randevu onayından sonra verilen özel yönetim bağlantısını kullanabilirsin. Sistem, işlem sırasında işletmenin güncel iptal ve değişiklik süresini uygular.",
    category: "randevu",
  },
  {
    id: "f3",
    question: "Uygulama ne kadar sürüyor?",
    answer:
      "Süre seçtiğin hizmete göre değişir. Her hizmetin tahmini süresi hizmet sayfasında ve randevu adımında görünür.",
    category: "uygulama",
  },
  {
    id: "f4",
    question: "Kalıcı oje tırnağa zarar verir mi?",
    answer:
      "Her tırnağın durumu farklıdır. Uygun işlem ve söküm yaklaşımı Hazel tarafından onaylandıktan sonra bu bölüm bilgilendirme amacıyla güncellenecek; kişisel bir sağlık değerlendirmesinin yerini tutmayacaktır.",
    category: "bakim",
  },
  {
    id: "f5",
    question: "Hijyen konusunda nasıl bir yol izliyorsunuz?",
    answer:
      "Planlanan hijyen başlıkları tek kullanımlık malzemeler, tekrar kullanılan aletlerin temizliği ve çalışma alanı düzenidir. Kesin uygulamalar Hazel tarafından doğrulandıktan sonra yayımlanacaktır.",
    category: "hijyen",
  },
  {
    id: "f6",
    question: "Ne kadar önceden randevu almalıyım?",
    answer:
      "Randevu ekranı işletmenin güncel minimum hazırlık süresini ve ileri tarih sınırını otomatik uygular. Kesin süreler işletme tarafından yayın öncesinde onaylanacaktır.",
    category: "randevu",
  },
];

/** PLACEHOLDER — gerçek müşteri yorumları eklenene kadar boş kalır. */
export const testimonials: { id: string; name: string; text: string }[] = [];

export const bookingSteps = [
  {
    title: "Hizmetini seç",
    text: "Süre ve fiyat bilgisiyle birlikte sana uygun hizmeti belirle.",
  },
  {
    title: "Uygun saati gör",
    text: "Gerçek takvim üzerinden seçtiğin hizmete uygun boş saatleri görüntüle.",
  },
  {
    title: "Bilgilerini bırak",
    text: "Hesap oluşturmadan gerekli iletişim bilgilerini ve isteğe bağlı notunu gir.",
  },
  {
    title: "Randevun hazır",
    text: "Onaydan sonra randevu özetini ve özel yönetim bağlantını al.",
  },
];

export const trustPoints = [
  {
    title: "Tek kullanımlık malzeme",
    text: "Törpü, sünger ve benzeri malzemeler her müşteri için yenilenir.",
  },
  {
    title: "Dezenfekte edilen aletler",
    text: "Tekrar kullanılan metal aletler uygulama arasında temizlenir.",
  },
  {
    title: "Kişiye özel planlama",
    text: "Tırnak yapına uygun form ve bakım önerisi birlikte belirlenir.",
  },
];
