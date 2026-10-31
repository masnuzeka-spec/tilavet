# Tilawah World Final v3 — Tam Kapsam ve Doğrulama Notları

## Klasör Yapısı (Modüler Mimari)
- `index.html`: Ana uygulama kabuğu ve 7 sekmeli stüdyo arayüzü
- `css/styles.css`: Derin zümrüt (`#08110E`), kehribar altın (`#110D07`) ve gece mavisi (`#070D18`) temaları, glassmorphism, özel kaydırıcılar ve üstte sabit önizleme düzeni
- `js/data.js`: 114 sûre, 34 hâfız, kapak şablonları, favori ayet aralıkları ve çevrimdışı hazır ayet çekirdeği
- `js/storage.js`: Tüm ayarları kapsayan `localStorage` yöneticisi ve `IndexedDB` (`user_media` kişisel galeri + `ayah_cache` çevrimdışı ayet önbelleği)
- `js/scenes.js`: 24 benzersiz canlı sahne motoru, delta-time (`dt`) parçacık sistemi ve iOS Safari bulanıklık/parlaklık filtre yedeklemesi
- `js/audio.js`: Web Audio API mikseri (Hâfız + Gerçek Ambiyans MP3/Synth + Arka Plan Video Sesi), yumuşak kapanış (fade-out) ve ayet bazlı gerçek ses doğrulaması
- `js/recorder.js`: MP4 öncelikli MediaRecorder / WebCodecs algılayıcı, iptal koruması ve WebM süre başlığı düzeltici
- `js/app.js`: Ana uygulama denetleyicisi, Pexels API arama entegrasyonu, platform bazlı açıklama üretici ve 7 bölümlü Ayarlar merkezi
- `media/catalog.json`: Tek kaynak (single source of truth) zemin kataloğu (6 gerçek MP4 döngü video + 8 adet 1080p fotoğraf + 24 canlı sahne)
- `media/thumbs/`: `280×498` boyutunda `16–40 KB` gerçek küçük önizleme görselleri
- `icons/`: `72x72` ile `512x512` arası gerçek çözünürlüklü PWA ikonları ve ayrı `icon-512-maskable.png`

## Kurulum ve Çalıştırma
`tilavet-main` klasörünü herhangi bir HTTP/HTTPS sunucusunda açarak doğrudan kullanabilirsiniz.
