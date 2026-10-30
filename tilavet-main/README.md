# Tilawah World — geliştirilmiş sürüm

## Başlangıç
Bu proje statik bir web/PWA uygulamasıdır. `index.html` dosyasını doğrudan `file://` ile açmak yerine HTTPS destekleyen bir statik sunucuda yayımlayın. Service Worker ve çevrimdışı özellikler güvenli bağlam (HTTPS veya localhost) gerektirir.

Örnek yerel sunucu:
```bash
python -m http.server 8080
```
Ardından `http://localhost:8080/tilavet-main/` adresini açın.

## Bu sürümde yapılanlar
- Mevcut Tilawah World arayüzü ve Canvas video oluşturma motoru korundu.
- Ana CSS ve JavaScript, `css/core.css` ve `js/core.js` dosyalarına ayrıldı.
- Profesyonel araçlar paneli `js/pro-studio.js` ve `css/pro-studio.css` olarak eklendi.
- Projeleri IndexedDB üzerinde kaydetme, açma, silme ve otomatik taslak kaydı eklendi. IndexedDB kullanılamazsa sınırlı localStorage yedeği denenir.
- Proje ayarlarını JSON olarak dışa/içe aktarma eklendi. JSON dışa aktarımı özel kullanıcı medya dosyalarını içermez; medya dosyaları mevcut galeri deposunda ayrı tutulur.
- Çok katmanlı timeline görünümü ve zaman çizelgesinde ayet karesi seçerek görsel önizleme eklendi. Bu, henüz sürükle-bırak klip kırpma veya dalga biçimi düzenleyicisi değildir.
- Altyazı dili seçimi ve ayet bazında manuel zaman notları eklendi. Kelime kelime senkronizasyon otomatik üretilmez; güvenilir kelime zaman verisi veya manuel zamanlama gerekir.
- 50 tasarım ön ayarı eklendi; mevcut arka plan kataloğunu ve metin/renk/efekt ayarlarını kullanır.
- Kayıtlı projeler için sıralı toplu video üretim kuyruğu eklendi. Mobil tarayıcı indirme izinleri nedeniyle her indirme cihaz ve tarayıcı davranışına bağlı olabilir.
- Ayet API yanıtları Cache Storage'a kaydedilir; yalnızca daha önce başarıyla yüklenmiş aynı sure/ayet aralığı çevrimdışı kullanılabilir.
- Service Worker önbelleğine yeni CSS/JS/veri dosyaları eklendi ve eski sürüm temizliği sırasında ayet önbelleğinin korunması sağlandı.
- Arka plan videosunun sesi, kayıt miksajına bağlandı.
- Ayet API'si erişilemez ve ilgili ayet aralığı önbellekte yoksa yanlış örnek ayet gösterilmesi kaldırıldı.
- Ses dosyası yüklenemezse uydurma 6 saniyelik süreyle hazır kabul edilmesi kaldırıldı; dışa aktarma devre dışı kalır ve hata bildirilir.
- Galeri IndexedDB hatası uygulamanın tüm açılışını durdurmayacak şekilde ele alındı.

## Bilinen sınırlar / gerçek cihaz testi
- Bu paket statik kod kontrollerinden geçirildi; burada Android cihazda gerçek video kaydı, ses senkronu, farklı tarayıcı codec desteği ve uzun video bellek performansı uçtan uca test edilemedi.
- Tarayıcıların `MediaRecorder` MP4/WebM desteği farklıdır. Dışa aktarma biçimi cihazın desteklediği MIME türüne bağlıdır.
- Gerçek kelime bazlı altyazı vurgusu için ayet/kelime zaman damgası veri kaynağı gerekir. Bu paket zaman damgalarını tahmin etmez.
- Timeline şu aşamada katman ve zaman görünümü/önizleme sunar; profesyonel NLE düzeyinde serbest klip taşıma, bölme, dalga formu ve çoklu geçiş editörü değildir.
- Proje JSON dosyası ayarları taşır; büyük medya dosyalarını JSON içine gömmez.
- Çevrimdışı ses için ilgili tilavet dosyalarının daha önce çevrimiçiyken yüklenmiş olması gerekir. İlk kurulum ve ilk içerik indirme internet ister.
- Sentetik ambiyans sesleri mevcut ana uygulamanın ürettiği efektlerdir; gerçek yağmur/rüzgâr/ney kayıtları olarak sunulmaz.

## Dosya yapısı
- `index.html`: uygulama kabuğu
- `css/core.css`: mevcut arayüz stilleri
- `css/pro-studio.css`: Pro Stüdyo stilleri
- `js/core.js`: mevcut uygulama/video motoru ve hata düzeltmeleri
- `js/pro-studio.js`: proje, timeline, şablon, altyazı ve toplu üretim araçları
- `data/templates.json`: 50 tasarım ön ayarı
- `sw.js`: PWA ve çevrimdışı önbellek
- `media/`, `icons/`: mevcut medya ve ikonlar
