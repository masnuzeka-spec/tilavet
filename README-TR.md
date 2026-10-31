# Tilawah World — sadeleştirilmiş geliştirme paketi

Bu paket kullanıcının gönderdiği orijinal `tilavet-main.zip` kaynakları üzerinden oluşturulmuştur.

## Bu pakette yapılan doğrulanabilir değişiklikler
- Uygulamanın ana arayüzü için koyu zümrüt tonları eklendi.
- Metinlerde Noto Sans/DejaVu Sans fallback desteği eklendi; Türkçe karakterlerin (â, î, û, ş, ğ, ç, İ, ı) çiziminde font fallback iyileştirildi.
- 16:9 yatay tuval oranı eklendi; mevcut 9:16, 4:5 ve 1:1 seçenekleri korunmuştur.
- Temel sure/ayet, hafız, altyazı, arka plan ve tasarım tercihleri otomatik olarak localStorage'a kaydedilir.
- PWA Service Worker önbellek sürümü yükseltildi.

## Kullanım
`tilavet-main` klasörünün tamamını HTTPS destekleyen bir sunucuya yükleyin ve `index.html` üzerinden açın. PWA/Service Worker için HTTPS gerekir.

## Bilinen sınırlar
Bu teslim, istenen sade uygulama kapsamının tamamlandığını iddia etmez. Mevcut katalogda dört gerçek yerel fotoğraf bulunur; diğer bazı arka planlar uygulama tarafından çizilen canlı sahnelerdir. Yeni, telif durumu doğrulanmış gerçek fotoğraf/video dosyaları bu pakete eklenmemiştir. Gerçek video arşivini büyütmek için ayrıca lisanslı medya dosyaları seçilip pakete dahil edilmelidir.
Arapça + Türkçe + İngilizce altyazı seçeneklerinin tam ekran arayüzde birlikte doğrulanması ve dört formatın her cihazda dışa aktarma testi ayrıca yapılmalıdır.
Android Chrome üzerinde gerçek cihaz kayıt testi yapılmamıştır.
