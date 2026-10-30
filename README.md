# Tilawah World — düzeltme paketi (v5.0.2)

Bu paket, kullanıcının gönderdiği `tilavet-main.zip` arşivindeki gerçek kaynak dosyaları üzerinde yapılan ilk doğrulanmış düzeltmeleri içerir.

## Bu sürümde gerçekten değiştirilenler

1. **Yanlış çevrimdışı ayet kaldırıldı.** Ağ hatasında artık her zaman Duha suresinden sabit bir ayet gösterilmiyor. Yalnızca aynı sure ve ayet aralığı daha önce başarıyla alınmışsa önbellekten kullanılıyor; yoksa açık hata veriliyor.
2. **Ses yükleme hataları gizlenmiyor.** MP3 yüklenemez veya zaman aşımına uğrarsa 6 saniyelik uydurma süre atanmıyor. Eksik ses varken önizleme ve video oluşturma devre dışı kalıyor.
3. **Arka plan videosu sesi kayıt miksine bağlandı.** Ses, Web Audio üzerinden hem önizleme çıkışına hem de MediaRecorder ses akışına yönlendiriliyor; ses seviyesi ve sessize alma kazanç düğümüyle kontrol ediliyor.
4. **Galeri veritabanı hatası uygulama açılışını durdurmuyor.** IndexedDB başlatılamazsa uygulama galerisiz modda devam ediyor ve kullanıcıya bilgi veriyor.
5. **Tarayıcı kayıt desteği önceden kontrol ediliyor.** MediaRecorder, Canvas captureStream, MediaStream ve desteklenen kayıt MIME türü yoksa kayıt başlamadan açıklayıcı hata gösteriliyor.
6. **Yerel proje kaydetme/açma/silme eklendi.** Üst bölümdeki “Projeyi Kaydet” ve “Projeler” düğmeleri ile temel düzenleme ayarları cihazın localStorage alanında saklanıyor. Proje listesinde numaranın başına eksi koyarak silme yapılabiliyor.
7. **Service Worker önbellek sürümü v5.0.2 olarak yükseltildi.** Önceki uygulama kabuğunun yeni kodu göstermesi için eski cache sürümünün temizlenmesi sağlanıyor.

## Kurulum

- ZIP'i çıkarın.
- `tilavet-main` klasörünün tamamını HTTPS destekleyen bir web sunucusuna yükleyin.
- `index.html` dosyasını sunucu üzerinden açın. `file://` üzerinden açmak Service Worker/PWA özelliklerini çalıştırmaz.

## Sürüm sınırları — tamamlanmamış işler

Bu paket, talep edilen tüm profesyonel editör özelliklerinin tamamlandığı anlamına gelmez. Özellikle:
- Profesyonel sürükle-bırak, çok kanallı timeline henüz uygulanmadı.
- Kelime bazlı altyazı senkronizasyonu için doğrulanmış zaman damgası kaynağı ve düzenleme arayüzü henüz tamamlanmadı.
- Çoklu video batch render kuyruğu henüz tamamlanmadı.
- Şablon kütüphanesinin tam kapsamlı yönetim/önizleme sistemi henüz tamamlanmadı.
- Proje dosyası JSON içe/dışa aktarma ve bulut eşitleme henüz yok; projeler bu tarayıcı/cihazın localStorage alanında saklanır.
- Tam cihaz matrisiyle Android Chrome ve diğer tarayıcılarda uçtan uca video kaydı testi yapılmadı.

## Doğrulama

Bu teslimden önce gömülü JavaScript için `node --check` sözdizimi kontrolü, HTML temel yapı kontrolü, dosya bağlantısı kontrolü ve ZIP bütünlük testi yapılmalıdır. Gerçek cihazda video/ses kaydı testi ayrıca gereklidir.
