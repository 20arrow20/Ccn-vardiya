# Vardiya Panosu

Şirketin her 2 haftada bir gönderdiği vardiya listesi görsellerini okuyup günlük
**1. / 2. / 3. vardiya** listelerini çıkaran uygulama. Her vardiya için:

- **Çalışanlar** (ad soyad)
- **OFF** (listede kırmızı hücreler)
- **Raporlu** (hücrede `R`)
- **Yıllık İzin** (hücrede `Yİ`)
- **Diğer İzin** (hücrede `İ`)

Listeler WhatsApp vb. ile metin olarak paylaşılabilir. Tüm veri telefonda saklanır, internet gerekmez
(metin tanıma da cihazda çalışır).

## Nasıl çalışır

1. **Liste Yükle** → görseli seç (birden fazla seçilebilir).
2. Program tablo çizgilerini bulur, her satırdan ad soyadı okur (Türkçe OCR, Tesseract),
   kırmızı hücreleri OFF sayar, `1/2/3`, `R`, `Yİ` yazılarını tanır, başlıktan tarihleri çıkarır.
3. Kontrol ekranında hatalı hücreye dokunup düzeltilir → **Kaydet**.
4. **Günlük** ekranında tarih seçilir; 3 vardiyanın listeleri görünür ve paylaşılır.
5. **Çizelge** ekranında 14 günlük tablo; hücreye dokunarak güncelleme (rapor, izin değişikliği vb.).

Renk eşleştirmesi (ör. sarı = yıllık izin) **Ayarlar**'dan değiştirilebilir.

## Klasörler

| Yol | Ne |
|---|---|
| `src/index.html`, `src/app.js` | Uygulamanın tamamı (arayüz + görsel analizi) |
| `src/samples/` | Deneme için örnek liste görselleri |
| `tools/build.mjs` | `src/` → `www/` (tam HTML + OCR dosyaları) |
| `android/` | Capacitor ile üretilmiş Android projesi |
| `.github/workflows/android-apk.yml` | GitHub'a gönderildiğinde APK'yı otomatik üretir |

## Komutlar

```bash
npm install
npm run serve        # tarayıcıda http://localhost:8080
npm run android:sync # www/ üret + Android projesine kopyala
npm run android:apk  # APK üret (Android SDK gerekli)
```

APK çıktısı: `android/app/build/outputs/apk/debug/app-debug.apk`.
Android SDK kurulu değilse proje GitHub'a gönderildiğinde **Actions** sekmesinden
`vardiya-panosu-apk` dosyası indirilebilir.
