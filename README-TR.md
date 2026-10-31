# Tilawah World Final v3 — Profesyonel Ayet & Video Stüdyosu

Bu sürüm, önceki sürümde tespit edilen tüm kod ve medya hatalarını gidermek, mimariyi modülerleştirmek ve yeni stüdyo özelliklerini eklemek üzere baştan sona güncellenmiştir.

## Düzeltilen Hatalar ve Mimari İyileştirmeler
1. **Ayarların Tam Hatırlanması ve Ön Ayarlar (Presets):** Tüm tercihler (`settings` objesi altında sûre, ayet aralığı, hâfız, renkler, logo, ses seviyeleri, kapak ayarları, oran, çözünürlük, tema ve karartma kilidi) `localStorage` (`tilawah_world_settings_v3`) üzerinde saklanır ve açılışta tüm form elemanlarına eksiksiz geri yüklenir. Kişisel ön ayar kaydetme/yükleme ve JSON dışa/içe aktarma eklendi.
2. **Sabit Üst Önizleme ve Kesintisiz Sekme Geçişi:** Alt menünün üstünü kapatan perde (backdrop) kaldırıldı. Önizleme sahnesi üstte her zaman görünür kalır; alt panel "Basit / Gelişmiş" mod anahtarıyla kompakt biçimde çalışır ve 7 sekme arasında tek dokunuşla kesintisiz geçiş yapılır.
3. **16:9 Yatay Video Oranı:** Çıktı menüsüne `16:9 (YouTube / Yatay Video)` seçeneği eklendi; yatay tuvalde metin boyutları ve satır yerleşimi otomatik ölçeklenir.
4. **24 Benzersiz Canlı Sahne ve Delta-Time (`dt`) Hız Kontrolü:** 24 canlı sahnenin tamamı (camda süzülen yağmur damlalarıyla "Gece Camda Rahmet", kuzey ışıkları, kayan yıldızlar, dağ sisi, orman ışık huzmeleri, kubbe nuru, kandil parıltısı, Selçuklu çini geometrisi vb.) ayrı ayrı çizilir. Tüm animasyonlar kare hızından bağımsız `dt` (delta-time) kullanır; 60Hz ve 120Hz ekranlarda aynı hızda akar.
5. **Sıfır Yanlış Ayet Garantisi ve IndexedDB Ayet Önbelleği:** Çevrimdışı durumda veya API hatasında asla yanlış ayet (Duhâ 1) gösterilmez. Yüklenen her ayet IndexedDB (`ayah_cache`) içine kaydedilir; ayrıca popüler sûre ve ayetler hazır gömülü gelir. İstenen ayet önbellekte yoksa kullanıcıya açıkça `"Bu ayet henüz indirilmedi"` uyarısı gösterilir.
6. **Gerçek Ses Doğrulaması (Sahte 6 Saniye Kaldırıldı):** Her ayet için ayrı başarı/hata durumu tutulur. Herhangi bir ayet MP3'ü yüklenemezse `audioReady = false` kalır, hangi ayetin sesinin gelmediği listelenir ve kullanıcıya `"Sesleri Tekrar Dene"` veya `"Sadece Metin İle Devam Et"` seçeneği sunulur.
7. **İptal Koruması (Yarım Video Engeli):** Kayıt sırasında `"İptal Et"` düğmesine basıldığında veya ayet değiştirildiğinde `sessionAborted` bayrağı devreye girer ve yarım kalan kayıt asla "Video Hazır" olarak sunulmaz.
8. **Arka Plan Video Sesi ve Gerçek Ambiyans Sesleri:** Zemin videosunun sesi ve gerçek ambiyans ses dosyaları (`media/audio/rain.mp3`, `wind.mp3`, `ney.mp3`) Web Audio API mikserine (`mixDest`) bağlanarak video kaydına doğrudan dahil edilir. Video sonunda yumuşak ses ve görüntü kapanışı (fade-out) uygulanır.
9. **Karartma Kilidi ve Font Hazırlık Kontrolü:** Zemin değiştirildiğinde kullanıcının karartma (`bgDim`) ayarı ezilmez. İlk çizim ve kayıt öncesinde `document.fonts.ready` ile Arapça/Meal fontlarının yüklenmesi beklenir.
10. **Gerçek 1080p Fotoğraflar, Döngü Videolar, Küçük Thumbnail'ler ve Doğru İkon Seti:**
    - `media/` altına 8 adet `1080×1920` Full HD fotoğraf ve `media/videos/` altına 6 adet gerçek dikey döngü `.mp4` video eklendi.
    - `media/thumbs/` altında tüm fotoğraf ve videolar için `280×498` çözünürlükte, `16–40 KB` aralığında gerçek küçük önizlemeler üretildi.
    - `icons/` altında `72, 96, 128, 144, 152, 180, 192, 384, 512` boyutlarında gerçek çözünürlüklü ikonlar ve güvenli alan kurallarına uygun ayrı `icon-512-maskable.png` üretildi.
    - `index.html` ve `manifest.json` tema rengi `#08110E` (derin zümrüt) olarak eşitlendi.
    - Kod yapısı `css/styles.css` ve `js/` altındaki 6 modüler dosyaya (`data.js`, `storage.js`, `scenes.js`, `audio.js`, `recorder.js`, `app.js`) ayrıldı.
