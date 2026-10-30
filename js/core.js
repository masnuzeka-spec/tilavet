
    "use strict";

    function syncAppViewportHeight() {
      const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      document.documentElement.style.setProperty("--app-height", `${vh}px`);
    }
    window.addEventListener("resize", syncAppViewportHeight);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", syncAppViewportHeight);
    }
    syncAppViewportHeight();

    function toArabicIndicDigits(num) {
      const map = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
      return String(num).replace(/\d/g, d => map[Number(d)]);
    }

    const SURAHS = [
      [1, "Fâtiha", "سُورَةُ الْفَاتِحَةِ", 7],
      [2, "Bakara", "سُورَةُ الْبَقَرَةِ", 286],
      [3, "Âl-i İmrân", "سُورَةُ آلِ عِمْرَانَ", 200],
      [4, "Nisâ", "سُورَةُ النِّسَاءِ", 176],
      [5, "Mâide", "سُورَةُ الْمَائِدَةِ", 120],
      [6, "En'âm", "سُورَةُ الْأَنْعَامِ", 165],
      [7, "A'râf", "سُورَةُ الْأَعْرَافِ", 206],
      [8, "Enfâl", "سُورَةُ الْأَنْفَالِ", 75],
      [9, "Tevbe", "سُورَةُ التَّوْبَةِ", 129],
      [10, "Yûnus", "سُورَةُ يُونُسَ", 109],
      [11, "Hûd", "سُورَةُ هُودٍ", 123],
      [12, "Yûsuf", "سُورَةُ يُوسُفَ", 111],
      [13, "Ra'd", "سُورَةُ الرَّعْدِ", 43],
      [14, "İbrâhîm", "سُورَةُ إِبْرَاهِيمَ", 52],
      [15, "Hicr", "سُورَةُ الْحِجْرِ", 99],
      [16, "Nahl", "سُورَةُ النَّحْلِ", 128],
      [17, "İsrâ", "سُورَةُ الْإِسْرَاءِ", 111],
      [18, "Kehf", "سُورَةُ الْكَهْفِ", 110],
      [19, "Meryem", "سُورَةُ مَرْيَمَ", 98],
      [20, "Tâhâ", "سُورَةُ طه", 135],
      [21, "Enbiyâ", "سُورَةُ الْأَنْبِيَاءِ", 112],
      [22, "Hac", "سُورَةُ الْحَجِّ", 78],
      [23, "Mü'minûn", "سُورَةُ الْمُؤْمِنُونَ", 118],
      [24, "Nûr", "سُورَةُ النُّورِ", 64],
      [25, "Furkân", "سُورَةُ الْفُرْقَانِ", 77],
      [26, "Şuarâ", "سُورَةُ الشُّعَرَاءِ", 227],
      [27, "Neml", "سُورَةُ النَّمْلِ", 93],
      [28, "Kasas", "سُورَةُ الْقَصَصِ", 88],
      [29, "Ankebût", "سُورَةُ الْعَنْكَبُوتِ", 69],
      [30, "Rûm", "سُورَةُ الرُّومِ", 60],
      [31, "Lokmân", "سُورَةُ لُقْمَانَ", 34],
      [32, "Secde", "سُورَةُ السَّجْدَةِ", 30],
      [33, "Ahzâb", "سُورَةُ الْأَحْزَابِ", 73],
      [34, "Sebe'", "سُورَةُ سَبَإٍ", 54],
      [35, "Fâtır", "سُورَةُ فَاطِرٍ", 45],
      [36, "Yâsîn", "سُورَةُ يس", 83],
      [37, "Sâffât", "سُورَةُ الصَّافَّاتِ", 182],
      [38, "Sâd", "سُورَةُ ص", 88],
      [39, "Zümer", "سُورَةُ الزُّمَرِ", 75],
      [40, "Mü'min", "سُورَةُ غَافِرٍ", 85],
      [41, "Fussilet", "سُورَةُ فُصِّلَتْ", 54],
      [42, "Şûrâ", "سُورَةُ الشُّورَى", 53],
      [43, "Zuhruf", "سُورَةُ الزُّخْرُفِ", 89],
      [44, "Duhân", "سُورَةُ الدُّخَانِ", 59],
      [45, "Câsiye", "سُورَةُ الْجَاثِيَةِ", 37],
      [46, "Ahkâf", "سُورَةُ الْأَحْقَافِ", 35],
      [47, "Muhammed", "سُورَةُ مُحَمَّدٍ", 38],
      [48, "Fetih", "سُورَةُ الْفَتْحِ", 29],
      [49, "Hucurât", "سُورَةُ الْحُجُرَاتِ", 18],
      [50, "Kâf", "سُورَةُ ق", 45],
      [51, "Zâriyât", "سُورَةُ الذَّارِيَاتِ", 60],
      [52, "Tûr", "سُورَةُ الطُّورِ", 49],
      [53, "Necm", "سُورَةُ النَّجْمِ", 62],
      [54, "Kamer", "سُورَةُ الْقَمَرِ", 55],
      [55, "Rahmân", "سُورَةُ الرَّحْمَنِ", 78],
      [56, "Vâkıa", "سُورَةُ الْوَاقِعَةِ", 96],
      [57, "Hadîd", "سُورَةُ الْحَدِيدِ", 29],
      [58, "Mücâdele", "سُورَةُ الْمُجَادَلَةِ", 22],
      [59, "Haşr", "سُورَةُ الْحَشْرِ", 24],
      [60, "Mümtehine", "سُورَةُ الْمُمْتَحَنَةِ", 13],
      [61, "Saf", "سُورَةُ الصَّفِّ", 14],
      [62, "Cuma", "سُورَةُ الْجُمُعَةِ", 11],
      [63, "Münâfikûn", "سُورَةُ الْمُنَافِقُونَ", 11],
      [64, "Tegâbün", "سُورَةُ التَّغَابُنِ", 18],
      [65, "Talâk", "سُورَةُ الطَّلَاقِ", 12],
      [66, "Tahrîm", "سُورَةُ التَّحْرِيمِ", 12],
      [67, "Mülk", "سُورَةُ الْمُلْكِ", 30],
      [68, "Kalem", "سُورَةُ الْقَلَمِ", 52],
      [69, "Hâkka", "سُورَةُ الْحَاقَّةِ", 52],
      [70, "Meâric", "سُورَةُ الْمَعَارِجِ", 44],
      [71, "Nûh", "سُورَةُ نُوحٍ", 28],
      [72, "Cin", "سُورَةُ الْجِنِّ", 28],
      [73, "Müzzemmil", "سُورَةُ الْمُزَّمِّلِ", 20],
      [74, "Müddessir", "سُورَةُ الْمُدَّثِّرِ", 56],
      [75, "Kıyâme", "سُورَةُ الْقِيَامَةِ", 40],
      [76, "İnsân", "سُورَةُ الْإِنْسَانِ", 31],
      [77, "Mürselât", "سُورَةُ الْمُرْسَلَاتِ", 50],
      [78, "Nebe'", "سُورَةُ النَّبَإِ", 40],
      [79, "Nâziât", "سُورَةُ النَّازِعَاتِ", 46],
      [80, "Abese", "سُورَةُ عَبَسَ", 42],
      [81, "Tekvîr", "سُورَةُ التَّكْوِيرِ", 29],
      [82, "İnfitâr", "سُورَةُ الْإِنْفِطَارِ", 19],
      [83, "Mutaffifîn", "سُورَةُ الْمُطَفِّفِينَ", 36],
      [84, "İnşikâk", "سُورَةُ الْإِنْشِقَاقِ", 25],
      [85, "Bürûc", "سُورَةُ الْبُرُوجِ", 22],
      [86, "Târık", "سُورَةُ الطَّارِقِ", 17],
      [87, "A'lâ", "سُورَةُ الْأَعْلَى", 19],
      [88, "Gâşiye", "سُورَةُ الْغَاشِيَةِ", 26],
      [89, "Fecr", "سُورَةُ الْفَجْرِ", 30],
      [90, "Beled", "سُورَةُ الْبَلَدِ", 20],
      [91, "Şems", "سُورَةُ الشَّمْسِ", 15],
      [92, "Leyl", "سُورَةُ اللَّيْلِ", 21],
      [93, "Duhâ", "سُورَةُ الضُّحَى", 11],
      [94, "İnşirâh", "سُورَةُ الشَّرْحِ", 8],
      [95, "Tîn", "سُورَةُ التِّينِ", 8],
      [96, "Alak", "سُورَةُ الْعَلَقِ", 19],
      [97, "Kadir", "سُورَةُ الْقَدْرِ", 5],
      [98, "Beyyine", "سُورَةُ الْبَيِّنَةِ", 8],
      [99, "Zilzâl", "سُورَةُ الزَّلْزَلَةِ", 8],
      [100, "Âdiyât", "سُورَةُ الْعَادِيَاتِ", 11],
      [101, "Kâria", "سُورَةُ الْقَارِعَةِ", 11],
      [102, "Tekâsür", "سُورَةُ التَّكَاثُرِ", 8],
      [103, "Asr", "سُورَةُ الْعَصْرِ", 3],
      [104, "Hümeze", "سُورَةُ الْهُمَزَةِ", 9],
      [105, "Fîl", "سُورَةُ الْفِيلِ", 5],
      [106, "Kureyş", "سُورَةُ قُرَيْشٍ", 4],
      [107, "Mâûn", "سُورَةُ الْمَاعُونِ", 7],
      [108, "Kevser", "سُورَةُ الْكَوْثَرِ", 3],
      [109, "Kâfirûn", "سُورَةُ الْكَافِرُونَ", 6],
      [110, "Nasr", "سُورَةُ النَّصْرِ", 3],
      [111, "Tebbet", "سُورَةُ الْمَسَدِ", 5],
      [112, "İhlâs", "سُورَةُ الْإِخْلَاصِ", 4],
      [113, "Felak", "سُورَةُ الْفَلَقِ", 5],
      [114, "Nâs", "سُورَةُ النَّاسِ", 6]
    ];

    const RECITERS = [
      { id: "Alafasy_128kbps", name: "Mişârî Râşid el-Afâsî (128kbps)" },
      { id: "MaherAlMuaiqly128kbps", name: "Mâhir el-Muaykılî (128kbps)" },
      { id: "Abdurrahmaan_As-Sudais_192kbps", name: "Abdurrahmân es-Südeys (192kbps)" },
      { id: "Nasser_Alqatami_128kbps", name: "Nâsır el-Katâmî (128kbps)" },
      { id: "Yasser_Ad-Dussary_128kbps", name: "Yâsir ed-Devserî (128kbps)" },
      { id: "Abdul_Basit_Murattal_192kbps", name: "Abdülbâsıt Abdüssamed · Mürettel (192kbps)" },
      { id: "Abdul_Basit_Mujawwad_128kbps", name: "Abdülbâsıt Abdüssamed · Mücevved (128kbps)" },
      { id: "Husary_128kbps", name: "Mahmûd Halîl el-Husarî (128kbps)" },
      { id: "Husary_Mujawwad_128kbps", name: "Mahmûd Halîl el-Husarî · Mücevved (128kbps)" },
      { id: "Minshawy_Murattal_128kbps", name: "Muhammed Sıddîk el-Minşâvî · Mürettel (128kbps)" },
      { id: "Minshawy_Mujawwad_192kbps", name: "Muhammed Sıddîk el-Minşâvî · Mücevved (192kbps)" },
      { id: "Saood_ash-Shuraym_128kbps", name: "Suûd eş-Şureym (128kbps)" },
      { id: "Ahmed_ibn_Ali_al-Ajamy_128kbps_ketaballah.net", name: "Ahmed bin Alî el-Acemî (128kbps)" },
      { id: "Ghamadi_40kbps", name: "Sa'd el-Gâmidî" },
      { id: "Hudhaify_128kbps", name: "Alî el-Huzeyfî (128kbps)" },
      { id: "Muhammad_Ayyoub_128kbps", name: "Muhammed Eyyûb (128kbps)" },
      { id: "Muhammad_Jibreel_128kbps", name: "Muhammed Cibrîl (128kbps)" },
      { id: "Abu_Bakr_Ash-Shaatree_128kbps", name: "Ebû Bekir eş-Şâtırî (128kbps)" },
      { id: "Hani_Rifai_192kbps", name: "Hânî er-Rifâî (192kbps)" },
      { id: "Fares_Abbad_64kbps", name: "Fâris Abbâd" },
      { id: "Salah_Al_Budair_128kbps", name: "Salâh el-Büdeyr (128kbps)" },
      { id: "Abdullah_Basfar_192kbps", name: "Abdullah Basfer (192kbps)" },
      { id: "Abdullaah_3awwaad_Al-Juhaynee_128kbps", name: "Abdullah el-Cühenî (128kbps)" },
      { id: "Ali_Jaber_64kbps", name: "Alî Câbir" },
      { id: "Ayman_Sowaid_64kbps", name: "Eymen Süveyd (Tecvid Eğitim)" },
      { id: "Muhsin_Al_Qasim_192kbps", name: "Muhsin el-Kâsım (192kbps)" },
      { id: "Salah_Bukhatir_128kbps", name: "Salâh Buhâtır (128kbps)" },
      { id: "Khalid_Abdullah_al-Qahtanee_192kbps", name: "Hâlid el-Kahtânî (192kbps)" },
      { id: "Khaalid_Abdullaah_al-Qahtaanee_192kbps", name: "Hâlid Abdullah el-Kahtânî (Alternatif)" },
      { id: "bandar_baleela_64kbps", name: "Bender Belîle" },
      { id: "Sahl_Yassin_128kbps", name: "Sehl Yâsîn (128kbps)" },
      { id: "Mustafa_Ismail_48kbps", name: "Mustafa İsmâîl" },
      { id: "Mahmoud_Ali_Al_Banna_32kbps", name: "Mahmûd Alî el-Bennâ" },
      { id: "Akram_AlAlaqimy_128kbps", name: "Ekrem el-Alâkımî (128kbps)" }
    ];

    const DEFAULT_CATALOG = [
      { id: "media_rain_glass", name: "Yağmurlu Cam (Fotoğraf)", type: "image", src: "media/rain_glass.jpg", thumb: "media/thumbs/rain_glass.jpg", category: "Yağmur", recommendedDarkness: 40, defaultEffect: "none", palette: ["#0c1524", "#1b2d48", "#6585a6"] },
      { id: "media_mosque_dawn", name: "Seher Vakti Cami (Fotoğraf)", type: "image", src: "media/mosque_dawn.jpg", thumb: "media/thumbs/mosque_dawn.jpg", category: "Mimari ve Cami", recommendedDarkness: 45, defaultEffect: "none", palette: ["#18121e", "#3d2638", "#d89b56"] },
      { id: "media_forest_stream", name: "Orman ve Akarsu (Fotoğraf)", type: "image", src: "media/forest_stream.jpg", thumb: "media/thumbs/forest_stream.jpg", category: "Orman ve Doğa", recommendedDarkness: 45, defaultEffect: "none", palette: ["#0b1d16", "#163829", "#4f8a6b"] },
      { id: "media_starry_night", name: "Yıldızlı Gece (Fotoğraf)", type: "image", src: "media/starry_night.jpg", thumb: "media/thumbs/starry_night.jpg", category: "Gece ve Yıldızlar", recommendedDarkness: 35, defaultEffect: "none", palette: ["#060913", "#111c38", "#4868a8"] },
      { id: "live_rain_window", name: "Gece Camda Rahmet", type: "live", scene: "rain_bokeh", category: "Yağmur", recommendedDarkness: 35, defaultEffect: "none", palette: ["#0a111a", "#172536", "#d8b456"] },
      { id: "live_rain_emerald", name: "Zümrüt Yağmur Buharı", type: "live", scene: "mist_flow", category: "Yağmur", recommendedDarkness: 40, defaultEffect: "none", palette: ["#071714", "#11302a", "#52b788"] },
      { id: "live_rain_amber", name: "Kehribar Sokak Işıkları", type: "live", scene: "bokeh_drift", category: "Yağmur", recommendedDarkness: 42, defaultEffect: "none", palette: ["#16100b", "#2d1f12", "#f59e0b"] },
      { id: "live_rain_blue", name: "Mavi Alacakaranlık", type: "live", scene: "horizon_glow", category: "Yağmur", recommendedDarkness: 38, defaultEffect: "none", palette: ["#081226", "#152c52", "#60a5fa"] },
      { id: "live_night_aurora", name: "Kuzey Işıkları (Aurora)", type: "live", scene: "aurora", category: "Gece ve Yıldızlar", recommendedDarkness: 35, defaultEffect: "none", palette: ["#050b14", "#0f2e2e", "#34d399"] },
      { id: "live_night_cosmos", name: "Derin Uzay Yıldızları", type: "live", scene: "deep_stars", category: "Gece ve Yıldızlar", recommendedDarkness: 30, defaultEffect: "none", palette: ["#04060c", "#0f172a", "#93c5fd"] },
      { id: "live_night_moon", name: "Mehtap Yansıması", type: "live", scene: "moon_sea", category: "Gece ve Yıldızlar", recommendedDarkness: 38, defaultEffect: "none", palette: ["#070b16", "#162447", "#e2e8f0"] },
      { id: "live_night_nebula", name: "Altın Samanyolu", type: "live", scene: "nebula_dust", category: "Gece ve Yıldızlar", recommendedDarkness: 40, defaultEffect: "none", palette: ["#0d0914", "#241734", "#d8b456"] },
      { id: "live_nature_mist", name: "Dağ Yamacı Sis", type: "live", scene: "mist_flow", category: "Orman ve Doğa", recommendedDarkness: 40, defaultEffect: "none", palette: ["#0b1612", "#1b3329", "#a7f3d0"] },
      { id: "live_nature_rays", name: "Orman Işık Huzmeleri", type: "live", scene: "light_rays", category: "Orman ve Doğa", recommendedDarkness: 42, defaultEffect: "none", palette: ["#0a180f", "#1e3a24", "#fde68a"] },
      { id: "live_nature_autumn", name: "Sonbahar Tefekkürü", type: "live", scene: "bokeh_drift", category: "Orman ve Doğa", recommendedDarkness: 45, defaultEffect: "none", palette: ["#1c110a", "#3b2313", "#fb923c"] },
      { id: "live_nature_valley", name: "Zümrüt Vadi", type: "live", scene: "horizon_glow", category: "Orman ve Doğa", recommendedDarkness: 40, defaultEffect: "none", palette: ["#061510", "#0f3325", "#6ee7b7"] },
      { id: "live_sea_waves", name: "Sakin Gece Dalgaları", type: "live", scene: "calm_waves", category: "Deniz ve Gökyüzü", recommendedDarkness: 38, defaultEffect: "none", palette: ["#06101e", "#0e294b", "#38bdf8"] },
      { id: "live_sea_sunset", name: "Gurup Vakti Kızıllığı", type: "live", scene: "sunset_sky", category: "Deniz ve Gökyüzü", recommendedDarkness: 44, defaultEffect: "none", palette: ["#1a0b12", "#4a1c2a", "#f97316"] },
      { id: "live_sea_dawn", name: "Fecir Ufuk Çizgisi", type: "live", scene: "horizon_glow", category: "Deniz ve Gökyüzü", recommendedDarkness: 38, defaultEffect: "none", palette: ["#090d1a", "#1e294b", "#fbbf24"] },
      { id: "live_sea_ocean", name: "Derin Okyanus Huzuru", type: "live", scene: "calm_waves", category: "Deniz ve Gökyüzü", recommendedDarkness: 40, defaultEffect: "none", palette: ["#041218", "#0a2e3d", "#2dd4bf"] },
      { id: "live_arch_mihrab", name: "Altın Mihrap Işığı", type: "live", scene: "arch_glow", category: "Mimari ve Cami", recommendedDarkness: 38, defaultEffect: "none", palette: ["#120e07", "#2c2210", "#d8b456"] },
      { id: "live_arch_dome", name: "Kubbe Nur Huzmesi", type: "live", scene: "light_rays", category: "Mimari ve Cami", recommendedDarkness: 40, defaultEffect: "none", palette: ["#0d131a", "#1b2838", "#f3d77d"] },
      { id: "live_arch_kandil", name: "Kandil Bokeh Parıltısı", type: "live", scene: "bokeh_drift", category: "Mimari ve Cami", recommendedDarkness: 42, defaultEffect: "none", palette: ["#171109", "#332411", "#f59e0b"] },
      { id: "live_arch_medina", name: "Medine Yeşili Huzur", type: "live", scene: "arch_glow", category: "Mimari ve Cami", recommendedDarkness: 38, defaultEffect: "none", palette: ["#071710", "#103524", "#d8b456"] },
      { id: "live_abs_islamic_gold", name: "İslâmî Geometrik Altın", type: "live", scene: "islamic_geo", category: "Soyut ve Desen", recommendedDarkness: 35, defaultEffect: "none", palette: ["#0c0a06", "#1f190e", "#d8b456"] },
      { id: "live_abs_islamic_teal", name: "Selçuklu Çini Deseni", type: "live", scene: "islamic_geo", category: "Soyut ve Desen", recommendedDarkness: 38, defaultEffect: "none", palette: ["#061217", "#0f2c38", "#38bdf8"] },
      { id: "live_abs_velvet", name: "Kadife Gece & Altın Toz", type: "live", scene: "nebula_dust", category: "Soyut ve Desen", recommendedDarkness: 35, defaultEffect: "none", palette: ["#09080d", "#181524", "#eab308"] },
      { id: "live_abs_silk", name: "İpek Nur Dalgaları", type: "live", scene: "mist_flow", category: "Soyut ve Desen", recommendedDarkness: 38, defaultEffect: "none", palette: ["#110d0a", "#261c15", "#f3d77d"] }
    ];

    const ZEMIN_CATEGORIES = [
      "Tümü",
      "Son Kullanılanlar",
      "Galerim",
      "Yağmur",
      "Gece ve Yıldızlar",
      "Orman ve Doğa",
      "Deniz ve Gökyüzü",
      "Mimari ve Cami",
      "Soyut ve Desen"
    ];

    const COVER_TEMPLATES = [
      { id: "classic_gold", name: "1. Klasik Altın Çerçeve", border: true, accent: "#D8B456", badge: "KUR'ÂN-I KERÎM TİLÂVETİ" },
      { id: "mihrab_arch", name: "2. Mihrap Kemeri", border: true, arch: true, accent: "#F3D77D", badge: "TİLAWAH WORLD" },
      { id: "minimal_center", name: "3. Minimalist Merkez", border: false, accent: "#FFFFFF", badge: "HUZUR VEREN AYETLER" },
      { id: "emerald_seal", name: "4. Zümrüt Mühür", border: true, accent: "#34D399", badge: "GÜNÜN AYETİ" },
      { id: "royal_ottoman", name: "5. Osmanlı Serlevha", border: true, arch: true, accent: "#EAB308", badge: "KELÂMULLAH" },
      { id: "modern_reels", name: "6. Modern Reels Başlığı", border: false, accent: "#F59E0B", badge: "DİNLE & TEFEKKÜR ET" },
      { id: "night_bismillah", name: "7. Besmele Tacı", border: true, accent: "#D8B456", badge: "﷽" },
      { id: "cinematic_bar", name: "8. Sinematik Alt Bant", border: false, accent: "#F3D77D", badge: "TİLÂVET STÜDYOSU" }
    ];

    const state = {
      surahNo: 93,
      ayahStart: 1,
      ayahEnd: 3,
      reciterId: "Alafasy_128kbps",
      subtitleMode: "tr",
      bismillahMode: "separate",
      zeminId: "live_rain_window",
      zeminCategory: "Tümü",
      zeminSearch: "",
      recentZeminIds: JSON.parse(localStorage.getItem("tw_recent_zemins") || '["live_rain_window","live_arch_mihrab"]'),
      visualEffect: "none",
      effectIntensity: 50,
      bgDim: 45,
      bgBlur: 0,
      bgBrightness: 100,
      bgZoom: 100,
      bgPanX: 0,
      bgPanY: 0,
      kenBurns: "off",
      videoAudioMode: "muted",
      videoTrimStart: 0,
      videoTrimEnd: 0,
      arabicFont: "Scheherazade New",
      arabicSize: 42,
      mealSize: 22,
      transitionMode: "fade",
      textShadow: 14,
      arabicColor: "#FFFDF7",
      mealColor: "#E5E0D5",
      logoPos: "bottom-center",
      logoScale: 115,
      watermarkText: "Tilawah World",
      reciterVol: 100,
      ambientType: "none",
      ambientVol: 18,
      bgVideoVol: 0,
      gaplessTrimSec: 0.14,
      coverTemplateId: "classic_gold",
      coverFirstFrame: "off",
      coverPreviewMode: "ayah",
      coverTitle: "",
      coverSubtitle: "",
      coverPos: "center",
      coverScale: 100,
      coverBgOverride: "same",
      platformRatio: "9:16",
      resolution: 720,
      safeZoneVisible: false,
      verses: [],
      audioElements: [],
      audioDurations: [],
      totalDuration: 0,
      audioReady: false,
      activeVerseIdx: 0,
      verseStartTime: 0,
      isPlaying: false,
      isRecording: false,
      isBuffering: false,
      playStartTimestamp: 0,
      elapsedTime: 0,
      lastExportBlob: null,
      lastExportExt: "mp4",
      lastExportDuration: 0
    };

    let toastTimer = null;
    function showToast(msg, duration = 3200) {
      const box = document.getElementById("toastBox");
      if (!box) return;
      box.textContent = msg;
      box.classList.add("show");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => box.classList.remove("show"), duration);
    }

    function hapticTap() {
      if (navigator.vibrate) {
        try { navigator.vibrate(10); } catch (_) {}
      }
    }

    function formatTime(sec) {
      if (!Number.isFinite(sec) || sec < 0) return "00:00.0";
      const m = Math.floor(sec / 60);
      const s = (sec % 60).toFixed(1);
      return `${String(m).padStart(2, "0")}:${s.padStart(4, "0")}`;
    }

    const appLogoImg = new Image();
    let appLogoLoaded = false;
    const fallbackLogoCanvas = document.createElement("canvas");
    fallbackLogoCanvas.width = 256;
    fallbackLogoCanvas.height = 256;

    function buildFallbackLogo() {
      const lctx = fallbackLogoCanvas.getContext("2d");
      lctx.clearRect(0, 0, 256, 256);
      const grad = lctx.createRadialGradient(128, 128, 20, 128, 128, 120);
      grad.addColorStop(0, "#162636");
      grad.addColorStop(1, "#090f16");
      lctx.fillStyle = grad;
      lctx.beginPath();
      lctx.arc(128, 128, 120, 0, Math.PI * 2);
      lctx.fill();
      lctx.lineWidth = 6;
      lctx.strokeStyle = "#D8B456";
      lctx.stroke();
      lctx.fillStyle = "#F3D77D";
      lctx.font = "bold 46px 'Amiri', serif";
      lctx.textAlign = "center";
      lctx.textBaseline = "middle";
      lctx.fillText("تلاوة", 128, 102);
      lctx.fillStyle = "#D8B456";
      lctx.font = "bold 22px 'Inter', sans-serif";
      lctx.fillText("TILAWAH", 128, 152);
      lctx.font = "600 15px 'Inter', sans-serif";
      lctx.fillStyle = "#E5E0D5";
      lctx.fillText("WORLD", 128, 176);
    }
    buildFallbackLogo();

    appLogoImg.onload = () => { appLogoLoaded = true; };
    appLogoImg.onerror = () => {
      appLogoLoaded = false;
      const hdr = document.getElementById("headerLogoImg");
      if (hdr) hdr.src = fallbackLogoCanvas.toDataURL("image/png");
    };
    appLogoImg.src = "icons/logo.png";

    const DB_NAME = "TilawahWorldGalleryDB";
    const DB_VERSION = 1;
    const STORE_NAME = "user_media";
    let dbInstance = null;
    let galleryItems = [];
    let activeObjectUrls = [];

    function revokeActiveMediaUrls() {
      while (activeObjectUrls.length > 0) {
        const u = activeObjectUrls.pop();
        try { URL.revokeObjectURL(u); } catch (_) {}
      }
    }

    async function initGalleryDB() {
      if (navigator.storage && navigator.storage.persist) {
        try { await navigator.storage.persist(); } catch (_) {}
      }
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: "id" });
          }
        };
        req.onsuccess = (e) => {
          dbInstance = e.target.result;
          resolve(dbInstance);
        };
        req.onerror = (e) => reject(e.target.error);
      });
    }

    async function loadGalleryItemsFromDB() {
      if (!dbInstance) await initGalleryDB();
      return new Promise((resolve) => {
        const tx = dbInstance.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => {
          galleryItems = (req.result || []).sort((a, b) => b.createdAt - a.createdAt);
          resolve(galleryItems);
        };
        req.onerror = () => resolve([]);
      });
    }

    async function saveGalleryItemToDB(item) {
      if (!dbInstance) await initGalleryDB();
      return new Promise((resolve, reject) => {
        const tx = dbInstance.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(item);
        req.onsuccess = () => resolve(true);
        req.onerror = (e) => reject(e.target.error);
      });
    }

    async function deleteGalleryItemFromDB(id) {
      if (!dbInstance) await initGalleryDB();
      return new Promise((resolve) => {
        const tx = dbInstance.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).delete(id);
        tx.oncomplete = () => resolve(true);
      });
    }

    async function clearAllGalleryDB() {
      if (!dbInstance) await initGalleryDB();
      return new Promise((resolve) => {
        const tx = dbInstance.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).clear();
        tx.oncomplete = () => resolve(true);
      });
    }

    async function processUploadedFile(file) {
      const lower = file.name.toLowerCase();
      if (lower.endsWith(".heic") || lower.endsWith(".heif") || file.type.includes("heic")) {
        throw new Error("HEIC formatı tarayıcıda doğrudan işlenemez. Lütfen JPG veya PNG seçin.");
      }
      if (file.size > 200 * 1024 * 1024) {
        showToast("Uyarı: 200 MB üzeri dosya seçildi, işleme cihaz belleğine göre biraz sürebilir.");
      }

      const isVideo = file.type.startsWith("video/") || lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.endsWith(".mov");
      const id = "gal_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);

      if (!isVideo) {
        let bmp;
        if (window.createImageBitmap) {
          try {
            bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
          } catch (_) {
            bmp = await createImageBitmap(file);
          }
        }
        const tempUrl = URL.createObjectURL(file);
        const img = new Image();
        await new Promise((res, rej) => {
          img.onload = res;
          img.onerror = rej;
          img.src = tempUrl;
        });
        URL.revokeObjectURL(tempUrl);

        const srcW = bmp ? bmp.width : img.naturalWidth;
        const srcH = bmp ? bmp.height : img.naturalHeight;

        let finalBlob = file;
        if (srcW * srcH > 12000000) {
          const scale = Math.sqrt(12000000 / (srcW * srcH));
          const c = document.createElement("canvas");
          c.width = Math.round(srcW * scale);
          c.height = Math.round(srcH * scale);
          c.getContext("2d").drawImage(bmp || img, 0, 0, c.width, c.height);
          finalBlob = await new Promise(r => c.toBlob(r, "image/jpeg", 0.9));
        }

        const tc = document.createElement("canvas");
        tc.width = 240;
        tc.height = 426;
        const tctx = tc.getContext("2d");
        const scaleCover = Math.max(240 / srcW, 426 / srcH);
        const dw = srcW * scaleCover;
        const dh = srcH * scaleCover;
        tctx.drawImage(bmp || img, (240 - dw) / 2, (426 - dh) / 2, dw, dh);
        const thumbDataUrl = tc.toDataURL("image/jpeg", 0.78);
        if (bmp && bmp.close) bmp.close();

        return {
          id,
          name: file.name.replace(/\.[^.]+$/, ""),
          type: "image",
          blob: finalBlob,
          thumbDataUrl,
          category: "Galerim",
          recommendedDarkness: 40,
          defaultEffect: "none",
          createdAt: Date.now()
        };
      } else {
        const tempUrl = URL.createObjectURL(file);
        const vid = document.createElement("video");
        vid.muted = true;
        vid.playsInline = true;
        vid.preload = "metadata";
        vid.src = tempUrl;

        const thumbDataUrl = await new Promise((resolve) => {
          const timeout = setTimeout(() => resolve(generateProceduralThumb(["#101827", "#1e293b", "#d8b456"], "VİDEO")), 2500);
          vid.onloadeddata = () => {
            vid.currentTime = Math.min(0.5, (vid.duration || 1) * 0.1);
          };
          vid.onseeked = () => {
            clearTimeout(timeout);
            const tc = document.createElement("canvas");
            tc.width = 240;
            tc.height = 426;
            const vw = vid.videoWidth || 720;
            const vh = vid.videoHeight || 1280;
            const s = Math.max(240 / vw, 426 / vh);
            tc.getContext("2d").drawImage(vid, (240 - vw * s) / 2, (426 - vh * s) / 2, vw * s, vh * s);
            resolve(tc.toDataURL("image/jpeg", 0.76));
          };
          vid.onerror = () => {
            clearTimeout(timeout);
            resolve(generateProceduralThumb(["#101827", "#1e293b", "#d8b456"], "VİDEO"));
          };
        });
        URL.revokeObjectURL(tempUrl);

        return {
          id,
          name: file.name.replace(/\.[^.]+$/, ""),
          type: "video",
          blob: file,
          thumbDataUrl,
          category: "Galerim",
          recommendedDarkness: 40,
          defaultEffect: "none",
          createdAt: Date.now()
        };
      }
    }

    let catalogItems = [...DEFAULT_CATALOG];
    const thumbCache = new Map();
    let activeBgImage = null;
    let activeBgVideo = null;

    async function loadExternalCatalogJson() {
      try {
        const res = await fetch("media/catalog.json", { cache: "no-cache" });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.items) && data.items.length > 0) {
            const existingIds = new Set(data.items.map(i => i.id));
            const merged = [...data.items];
            for (const defItem of DEFAULT_CATALOG) {
              if (!existingIds.has(defItem.id)) merged.push(defItem);
            }
            catalogItems = merged;
          }
        }
      } catch (_) {}
    }

    function generateProceduralThumb(palette = ["#0b1320", "#1c2d42", "#d8b456"], label = "") {
      const key = palette.join("_") + "_" + label;
      if (thumbCache.has(key)) return thumbCache.get(key);

      const c = document.createElement("canvas");
      c.width = 180;
      c.height = 320;
      const ctx = c.getContext("2d");

      const grad = ctx.createLinearGradient(0, 0, 0, 320);
      grad.addColorStop(0, palette[0] || "#0b1320");
      grad.addColorStop(0.55, palette[1] || "#1c2d42");
      grad.addColorStop(1, "#06080c");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 180, 320);

      const rad = ctx.createRadialGradient(90, 110, 8, 90, 110, 110);
      rad.addColorStop(0, (palette[2] || "#d8b456") + "66");
      rad.addColorStop(1, "transparent");
      ctx.fillStyle = rad;
      ctx.fillRect(0, 0, 180, 320);

      ctx.strokeStyle = (palette[2] || "#d8b456") + "44";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(90, 115, 46, 0, Math.PI * 2);
      ctx.stroke();

      const url = c.toDataURL("image/jpeg", 0.8);
      thumbCache.set(key, url);
      return url;
    }

    function getAllZeminItems() {
      return [...galleryItems, ...catalogItems];
    }

    function getZeminById(id) {
      return getAllZeminItems().find(item => item.id === id) || null;
    }

    async function selectZemin(id) {
      const item = getZeminById(id);
      state.zeminId = id;

      if (activeBgVideo) {
        try {
          activeBgVideo.pause();
          activeBgVideo.removeAttribute("src");
          activeBgVideo.load();
        } catch (_) {}
        activeBgVideo = null;
      }
      activeBgImage = null;
      revokeActiveMediaUrls();

      if (!item) {
        state.visualEffect = "none";
      } else {
        state.visualEffect = item.defaultEffect || "none";
        if (typeof item.recommendedDarkness === "number") {
          state.bgDim = item.recommendedDarkness;
          document.getElementById("rngBgDim").value = state.bgDim;
          document.getElementById("valBgDim").textContent = `%${state.bgDim}`;
        }
      }
      document.getElementById("selVisualEffect").value = state.visualEffect;

      if (id) {
        state.recentZeminIds = [id, ...state.recentZeminIds.filter(x => x !== id)].slice(0, 12);
        try { localStorage.setItem("tw_recent_zemins", JSON.stringify(state.recentZeminIds)); } catch (_) {}
      }

      const trimBox = document.getElementById("videoTrimBox");
      if (item && item.type === "image") {
        trimBox.style.display = "none";
        const img = new Image();
        img.crossOrigin = "anonymous";
        let srcUrl = item.src;
        if (item.blob) {
          srcUrl = URL.createObjectURL(item.blob);
          activeObjectUrls.push(srcUrl);
        }
        img.onload = () => { activeBgImage = img; };
        img.onerror = () => { activeBgImage = null; };
        img.src = srcUrl;
      } else if (item && item.type === "video") {
        trimBox.style.display = "grid";
        const vid = document.createElement("video");
        vid.crossOrigin = "anonymous";
        vid.playsInline = true;
        vid.loop = true;
        vid.muted = state.videoAudioMode === "muted";
        vid.volume = state.bgVideoVol / 100;
        let srcUrl = item.src;
        if (item.blob) {
          srcUrl = URL.createObjectURL(item.blob);
          activeObjectUrls.push(srcUrl);
        }
        vid.src = srcUrl;
        vid.onloadedmetadata = () => {
          if (state.videoTrimStart > 0 && state.videoTrimStart < vid.duration) {
            vid.currentTime = state.videoTrimStart;
          }
          vid.play().catch(() => {});
        };
        vid.ontimeupdate = () => {
          if (state.videoTrimEnd > state.videoTrimStart && vid.currentTime >= state.videoTrimEnd) {
            vid.currentTime = state.videoTrimStart || 0;
          }
        };
        activeBgVideo = vid;
      } else {
        trimBox.style.display = "none";
      }

      renderZeminGrid();
    }

    function renderZeminCategories() {
      const bar = document.getElementById("zeminCategoryBar");
      bar.innerHTML = "";
      ZEMIN_CATEGORIES.forEach(cat => {
        const btn = document.createElement("button");
        btn.className = "chip" + (state.zeminCategory === cat ? " active" : "");
        btn.textContent = cat;
        btn.onclick = () => {
          hapticTap();
          state.zeminCategory = cat;
          renderZeminCategories();
          renderZeminGrid();
        };
        bar.appendChild(btn);
      });
    }

    function renderZeminGrid() {
      const grid = document.getElementById("zeminGrid");
      const manageBar = document.getElementById("galleryManageBar");
      const lblCount = document.getElementById("lblGalleryCount");

      manageBar.style.display = state.zeminCategory === "Galerim" ? "flex" : "none";
      lblCount.textContent = `${galleryItems.length} kişisel medya kayıtlı`;

      const query = state.zeminSearch.trim().toLowerCase();
      let list = getAllZeminItems();

      if (state.zeminCategory === "Son Kullanılanlar") {
        list = state.recentZeminIds.map(id => getZeminById(id)).filter(Boolean);
      } else if (state.zeminCategory !== "Tümü") {
        list = list.filter(i => i.category === state.zeminCategory);
      }

      if (query) {
        list = list.filter(i => i.name.toLowerCase().includes(query) || (i.category || "").toLowerCase().includes(query));
      }

      grid.innerHTML = "";
      if (list.length === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1;padding:18px;text-align:center;color:var(--text-muted);font-size:12px;">Bu kategoride henüz medya yok. "+ Galerim'e Ekle" düğmesiyle fotoğraf veya video yükleyebilirsiniz.</div>`;
        return;
      }

      list.forEach(item => {
        const card = document.createElement("div");
        card.className = "zemin-card" + (state.zeminId === item.id ? " active" : "");

        const img = document.createElement("img");
        img.className = "zemin-thumb";
        img.loading = "lazy";
        img.alt = item.name;
        const fallbackThumb = generateProceduralThumb(item.palette || ["#0e1726", "#1e293b", "#d8b456"], item.type.toUpperCase());
        img.src = item.thumbDataUrl || item.thumb || fallbackThumb;
        img.onerror = () => {
          img.onerror = null;
          img.src = fallbackThumb;
        };

        const badge = document.createElement("span");
        badge.className = "zemin-badge";
        badge.textContent = item.type === "video" ? "VİDEO" : item.type === "image" ? "FOTO" : "CANLI";

        const label = document.createElement("div");
        label.className = "zemin-label";
        label.textContent = item.name;

        card.appendChild(img);
        card.appendChild(badge);
        card.appendChild(label);

        if (item.category === "Galerim") {
          const delBtn = document.createElement("button");
          delBtn.className = "zemin-del-btn";
          delBtn.title = "Galerim'den Sil";
          delBtn.textContent = "✕";
          delBtn.onclick = async (ev) => {
            ev.stopPropagation();
            hapticTap();
            await deleteGalleryItemFromDB(item.id);
            await loadGalleryItemsFromDB();
            if (state.zeminId === item.id) {
              await selectZemin("live_rain_window");
            } else {
              renderZeminGrid();
            }
            showToast("Medya Galerim'den silindi.");
          };
          card.appendChild(delBtn);
        }

        card.onclick = () => {
          hapticTap();
          selectZemin(item.id);
        };
        grid.appendChild(card);
      });
    }

    let currentLoadToken = 0;

    function stripLeadingBismillah(arabicText, surahNo, ayahNo) {
      if (surahNo === 1 || surahNo === 9 || ayahNo !== 1) return arabicText;
      const text = (arabicText || "").trim();
      const words = text.split(/\s+/);
      if (words.length > 4) {
        const normalizeAr = (s) =>
          s
            .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, "")
            .replace(/[ٱأإآ]/g, "ا");
        const first4 = normalizeAr(words.slice(0, 4).join(" "));
        if (first4 === "بسم الله الرحمن الرحيم") {
          return words.slice(4).join(" ").trim();
        }
      }
      return text.replace(
        /^بِسْمِ\s+[ٱا]للَّهِ\s+[ٱا]لرَّحْمَـ?ٰنِ\s+[ٱا]لرَّحِيمِ\s*/u,
        ""
      ).trim() || text;
    }

    async function loadVersesAndPreloadAudio() {
      const token = ++currentLoadToken;
      stopPlaybackAndRecording();

      state.audioReady = false;
      state.totalDuration = 0;
      document.getElementById("btnPlayPreview").disabled = true;
      document.getElementById("btnRecordExport").disabled = true;
      document.getElementById("lblTotalDuration").textContent = "Ses süresi ölçülüyor...";
      document.getElementById("lblAudioReadyState").textContent = "Sesler hazırlanıyor...";

      const sNo = state.surahNo;
      const start = state.ayahStart;
      const end = state.ayahEnd;
      const count = end - start + 1;
      const offset = start - 1;

      try {
        const url = `https://api.alquran.cloud/v1/surah/${sNo}/editions/quran-uthmani,tr.diyanet,en.sahih?offset=${offset}&limit=${count}`;
        let json;
        try {
          const res = await fetch(url, { cache: "no-cache" });
          if (!res.ok) throw new Error("API hatası");
          json = await res.json();
          try {
            const cache = await caches.open("tilawah-quran-data-v2");
            await cache.put(url, new Response(JSON.stringify(json), {
              headers: { "Content-Type": "application/json", "Cache-Control": "max-age=31536000" }
            }));
          } catch (_) {}
        } catch (networkError) {
          let cached = null;
          try {
            if ("caches" in window) {
              const cache = await caches.open("tilawah-quran-data-v2");
              cached = await cache.match(url);
            }
          } catch (_) {}
          if (!cached) throw networkError;
          json = await cached.json();
          showToast("İndirilen ayet verisi çevrimdışı kullanılıyor.");
        }
        if (token !== currentLoadToken) return;

        const [arEd, trEd, enEd] = json.data;
        const verses = [];
        for (let i = 0; i < arEd.ayahs.length; i++) {
          const ayahNum = arEd.ayahs[i].numberInSurah;
          const rawAr = arEd.ayahs[i].text;
          const cleanAr = stripLeadingBismillah(rawAr, sNo, ayahNum);
          verses.push({
            numberInSurah: ayahNum,
            arabic: cleanAr,
            hasBismillahHeader: (ayahNum === 1 && sNo !== 1 && sNo !== 9),
            tr: trEd.ayahs[i] ? trEd.ayahs[i].text : "",
            en: enEd.ayahs[i] ? enEd.ayahs[i].text : ""
          });
        }
        state.verses = verses;
      } catch (err) {
        if (token !== currentLoadToken) return;
        state.verses = [];
        state.audioElements = [];
        state.audioDurations = [];
        state.audioReady = false;
        document.getElementById("lblAudioReadyState").textContent =
          "Ayet verisi yüklenemedi. İnternet bağlantınızı kontrol edin veya bu ayet aralığını çevrimiçi indirin.";
        document.getElementById("lblTotalDuration").textContent = "--:--";
        showToast("Bu ayet aralığı cihazda kayıtlı değil. İnternet bağlantısı gerekli."); 
        return;
      }

      const audioList = [];
      const durations = [];
      const failedAudio = [];

      const loadPromises = state.verses.map((v, idx) => {
        return new Promise((resolve) => {
          const padS = String(sNo).padStart(3, "0");
          const padA = String(v.numberInSurah).padStart(3, "0");
          const audioUrl = `https://everyayah.com/data/${state.reciterId}/${padS}${padA}.mp3`;
          const aud = new Audio();
          aud.crossOrigin = "anonymous";
          aud.preload = "auto";
          aud.src = audioUrl;

          const timeoutId = setTimeout(() => {
            failedAudio.push(v.numberInSurah);
            durations[idx] = null;
            resolve();
          }, 12000);

          aud.onloadedmetadata = () => {
            clearTimeout(timeoutId);
            const d = Number.isFinite(aud.duration) && aud.duration > 0 ? aud.duration : null;
            durations[idx] = d;
            if (!d) failedAudio.push(v.numberInSurah);
            resolve();
          };
          aud.onerror = () => {
            clearTimeout(timeoutId);
            durations[idx] = null;
            failedAudio.push(v.numberInSurah);
            resolve();
          };
          audioList[idx] = aud;
        });
      });

      await Promise.all(loadPromises);
      if (token !== currentLoadToken) return;

      state.audioElements = audioList;
      state.audioDurations = durations;

      if (failedAudio.length) {
        state.audioReady = false;
        document.getElementById("lblAudioReadyState").textContent =
          `Ses dosyası yüklenemedi: ${failedAudio.join(", ")}. Tekrar deneyin veya başka okuyucu seçin.`;
        document.getElementById("lblTotalDuration").textContent = "--:--";
        document.getElementById("btnPlayPreview").disabled = true;
        document.getElementById("btnRecordExport").disabled = true;
        showToast(`${failedAudio.length} ayetin sesi yüklenemedi; hatalı süre tahmini yapılmadı.`);
        return;
      }

      let total = state.coverFirstFrame === "on" ? 1.2 : 0;
      for (let i = 0; i < durations.length; i++) {
        const isLast = (i === durations.length - 1);
        const eff = isLast ? durations[i] : Math.max(0.4, durations[i] - state.gaplessTrimSec);
        total += eff;
      }

      state.totalDuration = total;
      state.audioReady = true;
      state.activeVerseIdx = 0;

      document.getElementById("lblTotalDuration").textContent = formatTime(total);
      document.getElementById("lblAudioReadyState").textContent = `Hazır (${durations.length} Ayet · ${formatTime(total)})`;
      document.getElementById("btnPlayPreview").disabled = false;
      document.getElementById("btnRecordExport").disabled = false;

      updateSocialCaptionText();
      updatePlatformDurationWarning();
    }

    const canvas = document.getElementById("studioCanvas");
    const ctx = canvas.getContext("2d");

    const particles = Array.from({ length: 110 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 1 + Math.random() * 2.8,
      vx: (Math.random() - 0.5) * 0.0008,
      vy: 0.002 + Math.random() * 0.006,
      alpha: 0.25 + Math.random() * 0.75,
      phase: Math.random() * Math.PI * 2
    }));

    function drawProceduralScene(w, h, t, item) {
      const palette = (item && item.palette) || ["#0a111a", "#172536", "#d8b456"];
      const scene = (item && item.scene) || "rain_bokeh";

      const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
      bgGrad.addColorStop(0, palette[0]);
      bgGrad.addColorStop(0.55, palette[1]);
      bgGrad.addColorStop(1, "#05070b");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      if (scene === "aurora") {
        for (let i = 0; i < 3; i++) {
          const yOff = h * (0.22 + i * 0.12) + Math.sin(t * 0.7 + i) * 35;
          const g = ctx.createLinearGradient(0, yOff - 120, w, yOff + 120);
          g.addColorStop(0, "transparent");
          g.addColorStop(0.5, palette[2] + "44");
          g.addColorStop(1, "transparent");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(0, yOff);
          ctx.bezierCurveTo(w * 0.3, yOff - 90 * Math.sin(t * 0.5 + i), w * 0.7, yOff + 90 * Math.cos(t * 0.4 + i), w, yOff);
          ctx.lineTo(w, yOff + 180);
          ctx.lineTo(0, yOff + 180);
          ctx.closePath();
          ctx.fill();
        }
      } else if (scene === "islamic_geo") {
        ctx.translate(w / 2, h / 2);
        ctx.rotate(t * 0.05);
        ctx.strokeStyle = palette[2] + "28";
        ctx.lineWidth = 2;
        const radius = Math.min(w, h) * 0.36;
        for (let i = 0; i < 12; i++) {
          ctx.save();
          ctx.rotate((i * Math.PI) / 6);
          ctx.strokeRect(-radius / 2, -radius / 2, radius, radius);
          ctx.restore();
        }
      } else if (scene === "arch_glow") {
        const rad = ctx.createRadialGradient(w / 2, h * 0.34, 10, w / 2, h * 0.34, w * 0.65);
        rad.addColorStop(0, palette[2] + "55");
        rad.addColorStop(1, "transparent");
        ctx.fillStyle = rad;
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = palette[2] + "40";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(w * 0.16, h * 0.85);
        ctx.lineTo(w * 0.16, h * 0.38);
        ctx.quadraticCurveTo(w * 0.16, h * 0.15, w * 0.5, h * 0.1);
        ctx.quadraticCurveTo(w * 0.84, h * 0.15, w * 0.84, h * 0.38);
        ctx.lineTo(w * 0.84, h * 0.85);
        ctx.stroke();
      } else if (scene === "calm_waves" || scene === "moon_sea") {
        if (scene === "moon_sea") {
          ctx.fillStyle = "#f8fafc";
          ctx.shadowColor = "#f8fafc";
          ctx.shadowBlur = 35;
          ctx.beginPath();
          ctx.arc(w * 0.5, h * 0.24, w * 0.08, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
        for (let i = 0; i < 6; i++) {
          const wy = h * 0.58 + i * 48;
          ctx.fillStyle = palette[2] + "18";
          ctx.beginPath();
          ctx.moveTo(0, wy);
          for (let x = 0; x <= w; x += 40) {
            ctx.lineTo(x, wy + Math.sin(x * 0.015 + t * 1.2 + i) * 12);
          }
          ctx.lineTo(w, h);
          ctx.lineTo(0, h);
          ctx.closePath();
          ctx.fill();
        }
      } else {
        for (let i = 0; i < 18; i++) {
          const bx = ((i * 137.5) % 100) / 100 * w + Math.sin(t * 0.4 + i) * 28;
          const by = ((i * 73.1) % 100) / 100 * h + Math.cos(t * 0.3 + i) * 28;
          const br = 24 + (i % 5) * 22;
          const g = ctx.createRadialGradient(bx, by, 2, bx, by, br);
          g.addColorStop(0, palette[2] + "30");
          g.addColorStop(1, "transparent");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(bx, by, br, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    function drawVisualEffectOverlay(w, h, t) {
      const eff = state.visualEffect;
      if (!eff || eff === "none") return;

      const count = Math.floor((state.effectIntensity / 100) * particles.length);
      ctx.save();

      for (let i = 0; i < count; i++) {
        const p = particles[i];
        if (eff === "rain") {
          p.y = (p.y + p.vy * 2.8) % 1;
          p.x = (p.x + 0.0006) % 1;
          ctx.strokeStyle = `rgba(200, 225, 255, ${p.alpha * 0.55})`;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(p.x * w, p.y * h);
          ctx.lineTo(p.x * w - 4, p.y * h + 22);
          ctx.stroke();
        } else if (eff === "snow") {
          p.y = (p.y + p.vy * 0.65) % 1;
          p.x = (p.x + Math.sin(t + p.phase) * 0.0008 + 1) % 1;
          ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha * 0.8})`;
          ctx.beginPath();
          ctx.arc(p.x * w, p.y * h, p.r * 1.3, 0, Math.PI * 2);
          ctx.fill();
        } else if (eff === "dust") {
          p.y = (p.y - p.vy * 0.3 + 1) % 1;
          p.x = (p.x + Math.cos(t * 0.7 + p.phase) * 0.0006 + 1) % 1;
          ctx.fillStyle = `rgba(243, 215, 125, ${p.alpha * 0.65})`;
          ctx.beginPath();
          ctx.arc(p.x * w, p.y * h, p.r, 0, Math.PI * 2);
          ctx.fill();
        } else if (eff === "sparks") {
          p.y = (p.y - p.vy * 0.9 + 1) % 1;
          p.x = (p.x + Math.sin(t * 2 + p.phase) * 0.0012 + 1) % 1;
          ctx.fillStyle = `rgba(251, 146, 60, ${p.alpha * 0.85})`;
          ctx.beginPath();
          ctx.arc(p.x * w, p.y * h, p.r * 1.1, 0, Math.PI * 2);
          ctx.fill();
        } else if (eff === "stars") {
          const twinkle = 0.3 + 0.7 * Math.abs(Math.sin(t * 1.8 + p.phase));
          ctx.fillStyle = `rgba(255, 250, 220, ${twinkle * 0.85})`;
          ctx.beginPath();
          ctx.arc(p.x * w, p.y * h, p.r * 0.95, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    function wrapCanvasText(context, text, maxWidth) {
      if (!text) return [];
      const words = text.split(/\s+/);
      const lines = [];
      let current = "";
      for (const word of words) {
        const test = current ? current + " " + word : word;
        if (context.measureText(test).width > maxWidth && current) {
          lines.push(current);
          current = word;
        } else {
          current = test;
        }
      }
      if (current) lines.push(current);
      return lines;
    }

    function drawCoverScene(w, h, scaleFactor) {
      const tpl = COVER_TEMPLATES.find(t => t.id === state.coverTemplateId) || COVER_TEMPLATES[0];
      const surahMeta = SURAHS.find(s => s[0] === state.surahNo) || SURAHS[92];
      const reciterMeta = RECITERS.find(r => r.id === state.reciterId) || RECITERS[0];

      if (state.coverBgOverride !== "same") {
        const map = {
          dark_gold: ["#120e07", "#291f0e"],
          emerald: ["#061612", "#0f2e24"],
          midnight: ["#060b16", "#132242"]
        };
        const pal = map[state.coverBgOverride] || map.dark_gold;
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, pal[0]);
        g.addColorStop(1, pal[1]);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }

      const cScale = (state.coverScale / 100) * scaleFactor;
      const centerY = state.coverPos === "upper" ? h * 0.36 : state.coverPos === "lower" ? h * 0.64 : h * 0.5;

      ctx.save();
      if (tpl.border) {
        const pad = 44 * scaleFactor;
        ctx.strokeStyle = tpl.accent + "88";
        ctx.lineWidth = 2.5 * scaleFactor;
        ctx.strokeRect(pad, pad, w - pad * 2, h - pad * 2);
      }

      if (tpl.arch) {
        ctx.strokeStyle = tpl.accent + "55";
        ctx.lineWidth = 2 * scaleFactor;
        ctx.beginPath();
        ctx.arc(w / 2, centerY - 60 * cScale, 190 * cScale, Math.PI, 0);
        ctx.stroke();
      }

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0,0,0,0.85)";
      ctx.shadowBlur = 16 * scaleFactor;

      ctx.direction = "ltr";
      ctx.fillStyle = tpl.accent;
      ctx.font = `700 ${Math.round(16 * cScale)}px 'Inter', sans-serif`;
      ctx.fillText(tpl.badge, w / 2, centerY - 125 * cScale);

      ctx.direction = "rtl";
      ctx.fillStyle = "#FFFDF7";
      ctx.font = `700 ${Math.round(52 * cScale)}px '${state.arabicFont}', serif`;
      ctx.fillText(surahMeta[2], w / 2, centerY - 52 * cScale);

      ctx.direction = "ltr";
      const mainTitle = state.coverTitle.trim() || `${surahMeta[1]} Sûresi`;
      ctx.fillStyle = tpl.accent;
      ctx.font = `700 ${Math.round(34 * cScale)}px 'Inter', sans-serif`;
      ctx.fillText(mainTitle, w / 2, centerY + 20 * cScale);

      const subTitle = state.coverSubtitle.trim() || `${state.ayahStart} - ${state.ayahEnd}. Ayetler · ${reciterMeta.name.split("(")[0].trim()}`;
      ctx.fillStyle = "#E5E0D5";
      ctx.font = `500 ${Math.round(20 * cScale)}px 'Inter', sans-serif`;
      ctx.fillText(subTitle, w / 2, centerY + 72 * cScale);

      ctx.restore();
    }

    function drawLogoWatermark(w, h, scaleFactor, t) {
      if (state.logoPos === "hidden") return;

      const baseSize = 52 * (state.logoScale / 100) * scaleFactor;
      const pad = 34 * scaleFactor;
      let x = w / 2;
      let y = h - pad - baseSize / 2;

      if (state.logoPos === "top-right") {
        x = w - pad - baseSize - 90 * scaleFactor;
        y = pad + baseSize / 2;
      } else if (state.logoPos === "top-left") {
        x = pad + baseSize / 2;
        y = pad + baseSize / 2;
      } else if (state.logoPos === "floating") {
        x = w * 0.5 + Math.sin(t * 0.45) * (w * 0.24);
        y = h * 0.78 + Math.cos(t * 0.35) * (h * 0.06);
      }

      ctx.save();
      ctx.direction = "ltr";
      ctx.shadowColor = "rgba(0,0,0,0.75)";
      ctx.shadowBlur = 10 * scaleFactor;

      const logoSource = appLogoLoaded ? appLogoImg : fallbackLogoCanvas;
      const text = state.watermarkText.trim();

      if (state.logoPos === "bottom-center" || state.logoPos === "floating") {
        ctx.font = `600 ${Math.round(16 * (state.logoScale / 100) * scaleFactor)}px 'Inter', sans-serif`;
        const tw = text ? ctx.measureText(text).width : 0;
        const totalW = baseSize + (text ? 10 * scaleFactor + tw : 0);
        const startX = x - totalW / 2;

        ctx.drawImage(logoSource, startX, y - baseSize / 2, baseSize, baseSize);
        if (text) {
          ctx.fillStyle = "rgba(243, 241, 236, 0.92)";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(text, startX + baseSize + 10 * scaleFactor, y);
        }
      } else {
        ctx.drawImage(logoSource, x, y - baseSize / 2, baseSize, baseSize);
        if (text) {
          ctx.font = `600 ${Math.round(15 * (state.logoScale / 100) * scaleFactor)}px 'Inter', sans-serif`;
          ctx.fillStyle = "rgba(243, 241, 236, 0.92)";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(text, x + baseSize + 8 * scaleFactor, y);
        }
      }
      ctx.restore();
    }

    function renderStudioFrame(nowMs) {
      const t = (nowMs || performance.now()) / 1000;
      const w = canvas.width;
      const h = canvas.height;
      const scaleFactor = w / 720;

      ctx.clearRect(0, 0, w, h);

      const currentZemin = getZeminById(state.zeminId);
      ctx.save();
      if (state.bgBlur > 0 || state.bgBrightness !== 100) {
        ctx.filter = `blur(${state.bgBlur * scaleFactor}px) brightness(${state.bgBrightness}%)`;
      }

      const mediaEl = activeBgVideo || activeBgImage;
      if (mediaEl) {
        const mw = activeBgVideo ? (activeBgVideo.videoWidth || 720) : (activeBgImage.naturalWidth || 720);
        const mh = activeBgVideo ? (activeBgVideo.videoHeight || 1280) : (activeBgImage.naturalHeight || 1280);
        let zoom = state.bgZoom / 100;
        if (!activeBgVideo && state.kenBurns === "on") {
          zoom *= (1 + 0.08 * Math.sin(t * 0.25));
        }
        const baseScale = Math.max(w / mw, h / mh) * zoom;
        const dw = mw * baseScale;
        const dh = mh * baseScale;
        const dx = (w - dw) / 2 + (state.bgPanX / 100) * w * 0.5;
        const dy = (h - dh) / 2 + (state.bgPanY / 100) * h * 0.5;
        ctx.drawImage(mediaEl, dx, dy, dw, dh);
      } else {
        drawProceduralScene(w, h, t, currentZemin);
      }
      ctx.restore();

      if (state.bgDim > 0) {
        ctx.fillStyle = `rgba(5, 7, 11, ${state.bgDim / 100})`;
        ctx.fillRect(0, 0, w, h);
      }

      drawVisualEffectOverlay(w, h, t);

      const showCoverNow =
        state.coverPreviewMode === "cover" ||
        (state.coverFirstFrame === "on" && (state.isPlaying || state.isRecording) && state.elapsedTime < 1.2);

      if (showCoverNow) {
        drawCoverScene(w, h, scaleFactor);
      } else {
        const verse = state.verses[state.activeVerseIdx] || state.verses[0];
        if (verse) {
          let alpha = 1;
          let slideY = 0;
          if ((state.isPlaying || state.isRecording) && state.transitionMode !== "none") {
            const sinceVerse = Math.max(0, (performance.now() - state.verseStartTime) / 1000);
            const prog = Math.min(1, sinceVerse / 0.42);
            if (state.transitionMode === "fade") alpha = prog;
            if (state.transitionMode === "slide") {
              alpha = prog;
              slideY = (1 - prog) * 28 * scaleFactor;
            }
          }

          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.translate(0, slideY);
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.shadowColor = "rgba(0, 0, 0, 0.88)";
          ctx.shadowBlur = state.textShadow * scaleFactor;

          const maxTextW = w * 0.84;
          const arPx = Math.round(state.arabicSize * scaleFactor);
          const mealPx = Math.round(state.mealSize * scaleFactor);

          let cursorY = h * 0.42;

          ctx.direction = "ltr";
          const surahMeta = SURAHS.find(s => s[0] === state.surahNo) || SURAHS[92];
          ctx.fillStyle = "#D8B456";
          ctx.font = `600 ${Math.round(16 * scaleFactor)}px 'Inter', sans-serif`;
          ctx.fillText(`${surahMeta[1]} Sûresi · ${verse.numberInSurah}. Ayet`, w / 2, h * 0.17);

          // DÜZELTME: Sağdan sola (RTL) akışta doğru Mushaf parantez dizilimi: ﴾١﴿ (\uFD3E + rakam + \uFD3F)
          ctx.direction = "rtl";
          if (verse.hasBismillahHeader && state.bismillahMode === "separate") {
            ctx.fillStyle = "#F3D77D";
            ctx.font = `700 ${Math.round(arPx * 0.78)}px '${state.arabicFont}', serif`;
            ctx.fillText("بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ", w / 2, h * 0.25);
          }

          ctx.fillStyle = state.arabicColor;
          ctx.font = `700 ${arPx}px '${state.arabicFont}', serif`;
          const ayahBadge = `\uFD3F${toArabicIndicDigits(verse.numberInSurah)}\uFD3E`;
          const arLines = wrapCanvasText(ctx, `${verse.arabic} ${ayahBadge}`, maxTextW);
          const arLineH = arPx * 1.65;
          const totalArH = arLines.length * arLineH;
          let arStartY = cursorY - totalArH / 2;

          arLines.forEach((line, i) => {
            ctx.fillText(line, w / 2, arStartY + i * arLineH);
          });

          ctx.direction = "ltr";
          let mealCursorY = arStartY + totalArH + 28 * scaleFactor;
          if (state.subtitleMode === "tr" || state.subtitleMode === "both") {
            ctx.fillStyle = state.mealColor;
            ctx.font = `500 ${mealPx}px 'Inter', sans-serif`;
            const trLines = wrapCanvasText(ctx, verse.tr, maxTextW);
            const trLineH = mealPx * 1.42;
            trLines.forEach((line, i) => {
              ctx.fillText(line, w / 2, mealCursorY + i * trLineH);
            });
            mealCursorY += trLines.length * trLineH + 16 * scaleFactor;
          }

          if (state.subtitleMode === "en" || state.subtitleMode === "both") {
            ctx.fillStyle = state.subtitleMode === "both" ? "#CBD5E1" : state.mealColor;
            const enPx = state.subtitleMode === "both" ? Math.round(mealPx * 0.88) : mealPx;
            ctx.font = `400 ${enPx}px 'Inter', sans-serif`;
            const enLines = wrapCanvasText(ctx, verse.en, maxTextW);
            const enLineH = enPx * 1.38;
            enLines.forEach((line, i) => {
              ctx.fillText(line, w / 2, mealCursorY + i * enLineH);
            });
          }

          ctx.restore();
        }
      }

      drawLogoWatermark(w, h, scaleFactor, t);
    }

    let animLoopId = null;
    function startRenderLoop() {
      function step(now) {
        if (!document.hidden || state.isRecording) {
          renderStudioFrame(now);
        }
        animLoopId = requestAnimationFrame(step);
      }
      if (!animLoopId) animLoopId = requestAnimationFrame(step);
    }

    let audioCtx = null;
    let mixDest = null;
    let reciterGain = null;
    let ambientGain = null;
    let ambientSourceNode = null;
    const connectedAudioNodes = new WeakMap();

    let mediaRecorder = null;
    let recordedChunks = [];
    let wakeLockSentinel = null;
    let playbackRafId = null;

    function ensureAudioGraph() {
      if (!audioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AC();
        mixDest = audioCtx.createMediaStreamDestination();
        reciterGain = audioCtx.createGain();
        ambientGain = audioCtx.createGain();
        reciterGain.connect(audioCtx.destination);
        reciterGain.connect(mixDest);
        ambientGain.connect(audioCtx.destination);
        ambientGain.connect(mixDest);
      }
      if (audioCtx.state === "suspended") {
        audioCtx.resume().catch(() => {});
      }
      reciterGain.gain.value = state.reciterVol / 100;
      ambientGain.gain.value = state.ambientVol / 100;

      state.audioElements.forEach(aud => {
        if (!connectedAudioNodes.has(aud)) {
          try {
            const src = audioCtx.createMediaElementSource(aud);
            src.connect(reciterGain);
            connectedAudioNodes.set(aud, src);
          } catch (_) {}
        }
      });
      if (activeBgVideo) {
        try {
          if (!window.__twBgVideoNodes) window.__twBgVideoNodes = new WeakMap();
          let node = window.__twBgVideoNodes.get(activeBgVideo);
          if (!node) {
            const source = audioCtx.createMediaElementSource(activeBgVideo);
            const gain = audioCtx.createGain();
            source.connect(gain);
            gain.connect(audioCtx.destination);
            gain.connect(mixDest);
            node = { source, gain };
            window.__twBgVideoNodes.set(activeBgVideo, node);
          }
          node.gain.gain.value = state.videoAudioMode === "unmuted" ? state.bgVideoVol / 100 : 0;
          activeBgVideo.muted = false;
          activeBgVideo.volume = 1;
        } catch (err) {
          console.warn("Arka plan video sesi miksere bağlanamadı:", err);
        }
      }
    }

    function startAmbientSound() {
      stopAmbientSound();
      if (!audioCtx || state.ambientType === "none" || state.ambientVol <= 0) return;

      const bufferSize = audioCtx.sampleRate * 3;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = data[i];
        data[i] *= 0.25;
      }

      const noise = audioCtx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = audioCtx.createBiquadFilter();
      filter.type = state.ambientType === "ney" ? "bandpass" : "lowpass";
      filter.frequency.value = state.ambientType === "rain" ? 950 : state.ambientType === "wind" ? 420 : 280;

      noise.connect(filter);
      filter.connect(ambientGain);
      noise.start();
      ambientSourceNode = noise;
    }

    function stopAmbientSound() {
      if (ambientSourceNode) {
        try { ambientSourceNode.stop(); ambientSourceNode.disconnect(); } catch (_) {}
        ambientSourceNode = null;
      }
    }

    async function requestScreenWakeLock() {
      if ("wakeLock" in navigator) {
        try {
          wakeLockSentinel = await navigator.wakeLock.request("screen");
        } catch (_) {}
      }
    }

    function releaseScreenWakeLock() {
      if (wakeLockSentinel) {
        try { wakeLockSentinel.release(); } catch (_) {}
        wakeLockSentinel = null;
      }
    }

    async function patchWebmDuration(blob, durationMs) {
      if (!blob.type.includes("webm")) return blob;
      try {
        const buf = await blob.arrayBuffer();
        const bytes = new Uint8Array(buf);
        const limit = Math.min(bytes.length - 12, 8192);
        for (let i = 0; i < limit; i++) {
          if (bytes[i] === 0x44 && bytes[i + 1] === 0x89) {
            const view = new DataView(buf);
            if (bytes[i + 2] === 0x88) {
              view.setFloat64(i + 3, durationMs, false);
              return new Blob([buf], { type: blob.type });
            } else if (bytes[i + 2] === 0x84) {
              view.setFloat32(i + 3, durationMs, false);
              return new Blob([buf], { type: blob.type });
            }
          }
        }
      } catch (_) {}
      return blob;
    }

    function getSupportedRecorderMime() {
      const candidates = [
        { mime: "video/mp4;codecs=avc1.42E01E,mp4a.40.2", ext: "mp4" },
        { mime: "video/mp4", ext: "mp4" },
        { mime: "video/webm;codecs=vp9,opus", ext: "webm" },
        { mime: "video/webm;codecs=vp8,opus", ext: "webm" },
        { mime: "video/webm", ext: "webm" }
      ];
      for (const c of candidates) {
        if (window.MediaRecorder && MediaRecorder.isTypeSupported(c.mime)) return c;
      }
      return { mime: "", ext: "webm" };
    }

    function stopPlaybackAndRecording() {
      cancelAnimationFrame(playbackRafId);
      playbackRafId = null;

      state.audioElements.forEach(a => {
        try {
          a.onended = null;
          a.onwaiting = null;
          a.onplaying = null;
          a.pause();
          a.currentTime = 0;
        } catch (_) {}
      });
      stopAmbientSound();

      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        try { mediaRecorder.stop(); } catch (_) {}
      }

      state.isPlaying = false;
      state.isRecording = false;
      state.isBuffering = false;
      releaseScreenWakeLock();

      document.getElementById("bufferingPill").classList.remove("active");
      document.getElementById("recDot").classList.remove("recording");
      document.getElementById("stageStatusLabel").textContent = "Önizleme Hazır";
      document.getElementById("lblPlayBtn").textContent = "Önizle";
      document.getElementById("lblRecordBtn").textContent = "Oluştur";
    }

    async function startStudioSession(recordMode = false) {
      if (!state.audioReady || state.audioElements.length === 0) {
        showToast("Ses süreleri henüz hazır değil, lütfen bekleyin.");
        return;
      }

      stopPlaybackAndRecording();
      ensureAudioGraph();

      state.isPlaying = !recordMode;
      state.isRecording = recordMode;
      state.activeVerseIdx = 0;
      state.elapsedTime = 0;

      document.getElementById("lblPlayBtn").textContent = recordMode ? "Önizle" : "Durdur";
      document.getElementById("lblRecordBtn").textContent = recordMode ? "İptal Et" : "Oluştur";
      document.getElementById("stageStatusLabel").textContent = recordMode ? "İlk Ses Bekleniyor..." : "Önizleniyor";

      if (recordMode) {
        await requestScreenWakeLock();
        document.getElementById("recDot").classList.add("recording");
      }

      let recorderStarted = false;
      let recordStartPerf = 0;

      if (recordMode) {
        const format = getSupportedRecorderMime();
        state.lastExportExt = format.ext;
        const canvasStream = canvas.captureStream(30);
        const combinedTracks = [
          ...canvasStream.getVideoTracks(),
          ...mixDest.stream.getAudioTracks()
        ];
        const finalStream = new MediaStream(combinedTracks);
        const bitrate = state.resolution === 1080 ? 8000000 : 5000000;
        const opts = format.mime ? { mimeType: format.mime, videoBitsPerSecond: bitrate } : { videoBitsPerSecond: bitrate };

        recordedChunks = [];
        mediaRecorder = new MediaRecorder(finalStream, opts);
        mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) recordedChunks.push(e.data);
        };
        mediaRecorder.onstop = async () => {
          const rawBlob = new Blob(recordedChunks, { type: format.mime || "video/webm" });
          const actualMs = Math.max(500, performance.now() - recordStartPerf);
          const patchedBlob = await patchWebmDuration(rawBlob, actualMs);
          state.lastExportBlob = patchedBlob;
          state.lastExportDuration = actualMs / 1000;

          document.getElementById("btnQuickShare").disabled = false;
          const card = document.getElementById("exportResultCard");
          card.classList.add("ready");
          document.getElementById("lblExportMeta").textContent = `${formatTime(state.lastExportDuration)} · ${(patchedBlob.size / (1024 * 1024)).toFixed(1)} MB · .${state.lastExportExt.toUpperCase()}`;

          openBottomSheet("paylas");
          showToast(`Video hazır! Süre: ${formatTime(state.lastExportDuration)}`);
        };
      }

      const playVerseAtIndex = (idx) => {
        if (!state.isPlaying && !state.isRecording) return;
        if (idx >= state.audioElements.length) {
          stopPlaybackAndRecording();
          return;
        }

        state.activeVerseIdx = idx;
        state.verseStartTime = performance.now();
        const aud = state.audioElements[idx];
        const isLastVerse = (idx === state.audioElements.length - 1);
        let handedOver = false;

        aud.currentTime = 0;

        aud.onwaiting = () => {
          state.isBuffering = true;
          document.getElementById("bufferingPill").classList.add("active");
          if (mediaRecorder && mediaRecorder.state === "recording") {
            try { mediaRecorder.pause(); } catch (_) {}
          }
        };

        aud.onplaying = () => {
          state.isBuffering = false;
          document.getElementById("bufferingPill").classList.remove("active");
          if (mediaRecorder && mediaRecorder.state === "paused") {
            try { mediaRecorder.resume(); } catch (_) {}
          }
          if (recordMode && !recorderStarted) {
            recorderStarted = true;
            recordStartPerf = performance.now();
            mediaRecorder.start(200);
            startAmbientSound();
            document.getElementById("stageStatusLabel").textContent = "Kaydediliyor...";
          } else if (!recordMode && idx === 0) {
            startAmbientSound();
          }
        };

        aud.onended = () => {
          if (!handedOver) {
            handedOver = true;
            playVerseAtIndex(idx + 1);
          }
        };

        aud.play().catch(() => {
          showToast("Ses oynatılamadı. Lütfen internet bağlantınızı kontrol edin.");
          stopPlaybackAndRecording();
        });

        const monitorStep = () => {
          if (!state.isPlaying && !state.isRecording) return;
          if (state.activeVerseIdx !== idx) return;

          let passed = state.coverFirstFrame === "on" ? 1.2 : 0;
          for (let i = 0; i < idx; i++) {
            passed += Math.max(0.4, state.audioDurations[i] - state.gaplessTrimSec);
          }
          passed += aud.currentTime || 0;
          state.elapsedTime = Math.min(state.totalDuration, passed);

          document.getElementById("lblCurrentTime").textContent = formatTime(state.elapsedTime);
          const pct = state.totalDuration > 0 ? Math.min(100, (state.elapsedTime / state.totalDuration) * 100) : 0;
          document.getElementById("progressBarFill").style.width = `${pct}%`;

          if (!isLastVerse && !handedOver && aud.duration > 0 && state.gaplessTrimSec > 0) {
            if (aud.currentTime >= aud.duration - state.gaplessTrimSec) {
              handedOver = true;
              aud.onended = null;
              aud.pause();
              playVerseAtIndex(idx + 1);
              return;
            }
          }

          playbackRafId = requestAnimationFrame(monitorStep);
        };
        playbackRafId = requestAnimationFrame(monitorStep);
      };

      if (state.coverFirstFrame === "on") {
        if (recordMode && !recorderStarted) {
          recorderStarted = true;
          recordStartPerf = performance.now();
          mediaRecorder.start(200);
          startAmbientSound();
          document.getElementById("stageStatusLabel").textContent = "Kapak Kaydediliyor...";
        }
        setTimeout(() => {
          if (state.isPlaying || state.isRecording) {
            playVerseAtIndex(0);
          }
        }, 1200);
      } else {
        playVerseAtIndex(0);
      }
    }

    function updateSocialCaptionText() {
      const surahMeta = SURAHS.find(s => s[0] === state.surahNo) || SURAHS[92];
      const reciterMeta = RECITERS.find(r => r.id === state.reciterId) || RECITERS[0];
      const recName = reciterMeta.name.split("(")[0].trim();
      const firstVerse = state.verses[0];
      const mealSnippet = firstVerse ? `"${firstVerse.tr}"` : "";

      const caption =
        `📖 ${surahMeta[1]} Sûresi (${state.ayahStart}-${state.ayahEnd}. Ayetler)\n` +
        `🎙️ Hâfız: ${recName}\n\n` +
        (mealSnippet ? `${mealSnippet}\n\n` : "") +
        `#Kuran #Tilavet #${surahMeta[1].replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ]/g, "")}Suresi #Ayet #Huzur #TilawahWorld #Reels #Keşfet`;

      const txt = document.getElementById("txtSocialCaption");
      if (txt) txt.value = caption;
    }

    function updatePlatformDurationWarning() {
      const box = document.getElementById("platformDurationWarning");
      if (!box) return;
      if (state.totalDuration > 60 && state.platformRatio === "9:16") {
        box.style.display = "block";
        box.textContent = `Bilgi: Seçilen tilâvet süresi (${formatTime(state.totalDuration)}), YouTube Shorts 60 sn sınırını aşıyor. Instagram Reels ve TikTok için sorunsuz paylaşabilirsiniz.`;
      } else {
        box.style.display = "none";
      }
    }

    function downloadExportedVideo() {
      if (!state.lastExportBlob) {
        showToast("Önce 'Oluştur' düğmesiyle video hazırlayın.");
        return;
      }
      const surahMeta = SURAHS.find(s => s[0] === state.surahNo) || SURAHS[92];
      const fileName = `TilawahWorld_${surahMeta[1]}_${state.ayahStart}-${state.ayahEnd}.${state.lastExportExt}`;
      const url = URL.createObjectURL(state.lastExportBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      showToast(`Video indirildi: ${fileName}`);
    }

    async function shareExportedVideo() {
      if (!state.lastExportBlob) {
        showToast("Önce bir video oluşturun.");
        return;
      }
      const surahMeta = SURAHS.find(s => s[0] === state.surahNo) || SURAHS[92];
      const fileName = `TilawahWorld_${surahMeta[1]}_${state.ayahStart}-${state.ayahEnd}.${state.lastExportExt}`;
      const mimeType = state.lastExportExt === "mp4" ? "video/mp4" : "video/webm";
      const file = new File([state.lastExportBlob], fileName, { type: mimeType });
      const caption = document.getElementById("txtSocialCaption").value;

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: `${surahMeta[1]} Sûresi Tilâveti`,
            text: caption,
            files: [file]
          });
          return;
        } catch (err) {
          if (err.name === "AbortError") return;
        }
      }
      downloadExportedVideo();
      showToast("Cihazınız doğrudan dosya paylaşımını desteklemiyor. Video indirildi; Instagram, TikTok veya YouTube uygulamasından galeriden seçerek yükleyebilirsiniz.", 4500);
    }

    const sheetTitles = {
      ayet: "Ayet & Hâfız Seçimi",
      zemin: "Zemin & Görsel Efektler",
      yazi: "Yazı, Hat & Logo Ayarları",
      ses: "Ses & Ambiyans Mikseri",
      kapak: "Kapak Tasarımı & Şablonlar",
      paylas: "Platform, Çözünürlük & Paylaşım"
    };

    let isSheetOpen = false;

    function openBottomSheet(tabName) {
      hapticTap();
      document.querySelectorAll(".nav-tab").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.tab === tabName);
      });
      document.querySelectorAll(".tab-pane").forEach(pane => {
        pane.classList.toggle("active", pane.id === `pane-${tabName}`);
      });
      document.getElementById("sheetTitleText").textContent = sheetTitles[tabName] || "Ayarlar";

      const sheet = document.getElementById("bottomSheet");
      const backdrop = document.getElementById("sheetBackdrop");
      sheet.classList.add("open");
      sheet.setAttribute("aria-hidden", "false");
      backdrop.classList.add("open");

      if (!isSheetOpen) {
        isSheetOpen = true;
        try { history.pushState({ sheetOpen: true }, ""); } catch (_) {}
      }
    }

    function closeBottomSheet(fromPopState = false) {
      const sheet = document.getElementById("bottomSheet");
      const backdrop = document.getElementById("sheetBackdrop");
      sheet.classList.remove("open");
      sheet.setAttribute("aria-hidden", "true");
      backdrop.classList.remove("open");

      if (isSheetOpen && !fromPopState) {
        isSheetOpen = false;
        if (history.state && history.state.sheetOpen) {
          try { history.back(); } catch (_) {}
        }
      } else {
        isSheetOpen = false;
      }
    }

    window.addEventListener("popstate", () => {
      if (isSheetOpen) {
        closeBottomSheet(true);
      }
    });

    (function setupSheetSwipe() {
      const handle = document.getElementById("sheetDragHandle");
      const sheet = document.getElementById("bottomSheet");
      let startY = 0;
      let currentDelta = 0;

      handle.addEventListener("touchstart", (e) => {
        startY = e.touches[0].clientY;
        currentDelta = 0;
        sheet.style.transition = "none";
      }, { passive: true });

      handle.addEventListener("touchmove", (e) => {
        const dy = e.touches[0].clientY - startY;
        if (dy > 0) {
          currentDelta = dy;
          sheet.style.transform = `translateY(${dy}px)`;
        }
      }, { passive: true });

      handle.addEventListener("touchend", () => {
        sheet.style.transition = "";
        sheet.style.transform = "";
        if (currentDelta > 75) {
          closeBottomSheet();
        }
      });
    })();

    function populateSurahAndReciterSelectors() {
      const selSurah = document.getElementById("selSurah");
      selSurah.innerHTML = "";
      SURAHS.forEach(([no, nameTr, nameAr, count]) => {
        const opt = document.createElement("option");
        opt.value = no;
        opt.textContent = `${no}. ${nameTr} (${nameAr}) · ${count} Ayet`;
        if (no === state.surahNo) opt.selected = true;
        selSurah.appendChild(opt);
      });

      const selReciter = document.getElementById("selReciter");
      selReciter.innerHTML = "";
      RECITERS.forEach(r => {
        const opt = document.createElement("option");
        opt.value = r.id;
        opt.textContent = r.name;
        if (r.id === state.reciterId) opt.selected = true;
        selReciter.appendChild(opt);
      });

      populateAyahRangeSelectors(true);
    }

    function populateAyahRangeSelectors(preserveDefault = false) {
      const surahMeta = SURAHS.find(s => s[0] === state.surahNo) || SURAHS[92];
      const maxAyah = surahMeta[3];
      if (!preserveDefault) {
        state.ayahStart = 1;
        state.ayahEnd = Math.min(3, maxAyah);
      }

      const selStart = document.getElementById("selAyahStart");
      const selEnd = document.getElementById("selAyahEnd");
      selStart.innerHTML = "";
      selEnd.innerHTML = "";

      for (let i = 1; i <= maxAyah; i++) {
        const o1 = document.createElement("option");
        o1.value = i;
        o1.textContent = `${i}. Ayet`;
        if (i === state.ayahStart) o1.selected = true;
        selStart.appendChild(o1);

        const o2 = document.createElement("option");
        o2.value = i;
        o2.textContent = `${i}. Ayet`;
        if (i === state.ayahEnd) o2.selected = true;
        selEnd.appendChild(o2);
      }
    }

    function renderCoverTemplateChips() {
      const wrap = document.getElementById("coverTemplateChips");
      wrap.innerHTML = "";
      COVER_TEMPLATES.forEach(tpl => {
        const chip = document.createElement("button");
        chip.className = "chip" + (state.coverTemplateId === tpl.id ? " active" : "");
        chip.textContent = tpl.name;
        chip.onclick = () => {
          hapticTap();
          state.coverTemplateId = tpl.id;
          state.coverPreviewMode = "cover";
          document.getElementById("selCoverPreviewMode").value = "cover";
          renderCoverTemplateChips();
        };
        wrap.appendChild(chip);
      });
    }

    function updateCanvasResolutionAndRatio() {
      const wrap = document.getElementById("canvasWrap");
      wrap.classList.remove("ratio-4-5", "ratio-1-1");

      const baseW = state.resolution === 1080 ? 1080 : 720;
      if (state.platformRatio === "9:16") {
        canvas.width = baseW;
        canvas.height = Math.round((baseW * 16) / 9);
      } else if (state.platformRatio === "4:5") {
        wrap.classList.add("ratio-4-5");
        canvas.width = baseW;
        canvas.height = Math.round((baseW * 5) / 4);
      } else {
        wrap.classList.add("ratio-1-1");
        canvas.width = baseW;
        canvas.height = baseW;
      }
      updatePlatformDurationWarning();
    }

    function bindEvents() {
      document.querySelectorAll(".nav-tab").forEach(btn => {
        btn.addEventListener("click", () => {
          const tab = btn.dataset.tab;
          if (isSheetOpen && btn.classList.contains("active")) {
            closeBottomSheet();
          } else {
            openBottomSheet(tab);
          }
        });
      });

      document.getElementById("btnCloseSheet").onclick = () => closeBottomSheet();
      document.getElementById("sheetBackdrop").onclick = () => closeBottomSheet();

      document.getElementById("btnSafeZoneToggle").onclick = () => {
        hapticTap();
        state.safeZoneVisible = !state.safeZoneVisible;
        document.getElementById("safeZoneOverlay").classList.toggle("active", state.safeZoneVisible);
      };

      document.getElementById("btnPlayPreview").onclick = () => {
        hapticTap();
        if (state.isPlaying || state.isRecording) {
          stopPlaybackAndRecording();
        } else {
          startStudioSession(false);
        }
      };

      document.getElementById("btnRecordExport").onclick = () => {
        hapticTap();
        if (state.isRecording || state.isPlaying) {
          stopPlaybackAndRecording();
        } else {
          closeBottomSheet();
          startStudioSession(true);
        }
      };

      document.getElementById("btnQuickShare").onclick = () => shareExportedVideo();
      document.getElementById("btnDownloadExport").onclick = () => downloadExportedVideo();
      document.getElementById("btnShareExport").onclick = () => shareExportedVideo();

      document.getElementById("selSurah").onchange = (e) => {
        state.surahNo = Number(e.target.value);
        populateAyahRangeSelectors(false);
        loadVersesAndPreloadAudio();
      };

      document.getElementById("selAyahStart").onchange = (e) => {
        state.ayahStart = Number(e.target.value);
        if (state.ayahEnd < state.ayahStart) {
          state.ayahEnd = state.ayahStart;
          document.getElementById("selAyahEnd").value = state.ayahEnd;
        }
        loadVersesAndPreloadAudio();
      };

      document.getElementById("selAyahEnd").onchange = (e) => {
        state.ayahEnd = Number(e.target.value);
        if (state.ayahEnd < state.ayahStart) {
          state.ayahStart = state.ayahEnd;
          document.getElementById("selAyahStart").value = state.ayahStart;
        }
        loadVersesAndPreloadAudio();
      };

      document.getElementById("selReciter").onchange = (e) => {
        state.reciterId = e.target.value;
        loadVersesAndPreloadAudio();
      };

      document.getElementById("selSubtitleMode").onchange = (e) => {
        state.subtitleMode = e.target.value;
      };

      document.getElementById("selBismillahMode").onchange = (e) => {
        state.bismillahMode = e.target.value;
      };

      document.getElementById("inpZeminSearch").oninput = (e) => {
        state.zeminSearch = e.target.value;
        renderZeminGrid();
      };

      document.getElementById("inpGalleryUpload").onchange = async (e) => {
        const files = Array.from(e.target.files || []);
        e.target.value = "";
        if (files.length === 0) return;

        showToast(`${files.length} medya işleniyor...`);
        let lastAddedId = null;

        for (const file of files) {
          try {
            const item = await processUploadedFile(file);
            await saveGalleryItemToDB(item);
            lastAddedId = item.id;
          } catch (err) {
            if (err && err.name === "QuotaExceededError") {
              showToast("Cihaz depolama kotası doldu! Lütfen Galerim'den eski videoları silin.", 4500);
            } else {
              showToast(err.message || "Medya yüklenirken hata oluştu.");
            }
          }
        }

        await loadGalleryItemsFromDB();
        state.zeminCategory = "Galerim";
        renderZeminCategories();
        if (lastAddedId) {
          await selectZemin(lastAddedId);
          showToast("Medya Galerim'e eklendi ve seçildi.");
        }
      };

      document.getElementById("btnClearGallery").onclick = async () => {
        hapticTap();
        await clearAllGalleryDB();
        await loadGalleryItemsFromDB();
        await selectZemin("live_rain_window");
        showToast("Galerim tamamen temizlendi.");
      };

      document.getElementById("btnLoadDirectUrl").onclick = async () => {
        const url = document.getElementById("inpDirectMediaUrl").value.trim();
        if (!url) {
          showToast("Lütfen doğrudan bir .mp4, .webm veya .jpg bağlantısı girin.");
          return;
        }
        if (/instagram\.com|tiktok\.com|youtube\.com|youtu\.be/i.test(url)) {
          showToast("Sosyal medya sayfa linkleri doğrudan video dosyası değildir. Lütfen doğrudan .mp4/.webm/.jpg dosya bağlantısı girin veya videoyu telefonunuzdan '+ Galerim'e Ekle' ile seçin.", 5000);
          return;
        }

        showToast("Bağlantı kontrol ediliyor...");
        try {
          const res = await fetch(url, { mode: "cors" });
          if (!res.ok) throw new Error("HTTP " + res.status);
          const blob = await res.blob();
          const ext = url.split("?")[0].split(".").pop().toLowerCase() || "mp4";
          const fakeFile = new File([blob], `Baglanti_${Date.now()}.${ext}`, { type: blob.type || (ext === "jpg" ? "image/jpeg" : "video/mp4") });
          const item = await processUploadedFile(fakeFile);
          await saveGalleryItemToDB(item);
          await loadGalleryItemsFromDB();
          state.zeminCategory = "Galerim";
          renderZeminCategories();
          await selectZemin(item.id);
          document.getElementById("inpDirectMediaUrl").value = "";
          showToast("Bağlantıdaki medya başarıyla indirildi ve seçildi.");
        } catch (_) {
          showToast("CORS Güvenlik Engeli: Karşı sunucu tarayıcıdan doğrudan video çekilmesine izin vermiyor. Lütfen dosyayı cihazınıza indirip '+ Galerim'e Ekle' düğmesiyle yükleyin.", 5500);
        }
      };

      document.getElementById("selVisualEffect").onchange = (e) => {
        state.visualEffect = e.target.value;
      };
      document.getElementById("rngEffectIntensity").oninput = (e) => {
        state.effectIntensity = Number(e.target.value);
        document.getElementById("valEffectIntensity").textContent = `%${state.effectIntensity}`;
      };

      document.getElementById("rngBgDim").oninput = (e) => {
        state.bgDim = Number(e.target.value);
        document.getElementById("valBgDim").textContent = `%${state.bgDim}`;
      };
      document.getElementById("rngBgBlur").oninput = (e) => {
        state.bgBlur = Number(e.target.value);
        document.getElementById("valBgBlur").textContent = `${state.bgBlur} px`;
      };
      document.getElementById("rngBgBrightness").oninput = (e) => {
        state.bgBrightness = Number(e.target.value);
        document.getElementById("valBgBrightness").textContent = `%${state.bgBrightness}`;
      };
      document.getElementById("rngBgZoom").oninput = (e) => {
        state.bgZoom = Number(e.target.value);
        document.getElementById("valBgZoom").textContent = `${(state.bgZoom / 100).toFixed(2)}x`;
      };
      document.getElementById("rngBgPanX").oninput = (e) => {
        state.bgPanX = Number(e.target.value);
        document.getElementById("valBgPanX").textContent = `${state.bgPanX}%`;
      };
      document.getElementById("rngBgPanY").oninput = (e) => {
        state.bgPanY = Number(e.target.value);
        document.getElementById("valBgPanY").textContent = `${state.bgPanY}%`;
      };
      document.getElementById("selKenBurns").onchange = (e) => {
        state.kenBurns = e.target.value;
      };
      document.getElementById("selVideoAudioMode").onchange = (e) => {
        state.videoAudioMode = e.target.value;
        if (activeBgVideo) {
          activeBgVideo.muted = false;
          const node = window.__twBgVideoNodes && window.__twBgVideoNodes.get(activeBgVideo);
          if (node) node.gain.gain.value = state.videoAudioMode === "unmuted" ? state.bgVideoVol / 100 : 0;
        }
      };
      document.getElementById("inpVideoTrimStart").onchange = (e) => {
        state.videoTrimStart = Math.max(0, Number(e.target.value) || 0);
      };
      document.getElementById("inpVideoTrimEnd").onchange = (e) => {
        state.videoTrimEnd = Math.max(0, Number(e.target.value) || 0);
      };

      document.querySelectorAll("#arabicFontCards .mini-preview-card").forEach(card => {
        card.onclick = () => {
          hapticTap();
          document.querySelectorAll("#arabicFontCards .mini-preview-card").forEach(c => c.classList.remove("active"));
          card.classList.add("active");
          state.arabicFont = card.dataset.font;
        };
      });

      document.getElementById("rngArabicSize").oninput = (e) => {
        state.arabicSize = Number(e.target.value);
        document.getElementById("valArabicSize").textContent = `${state.arabicSize} px`;
      };
      document.getElementById("rngMealSize").oninput = (e) => {
        state.mealSize = Number(e.target.value);
        document.getElementById("valMealSize").textContent = `${state.mealSize} px`;
      };
      document.getElementById("selTransitionMode").onchange = (e) => {
        state.transitionMode = e.target.value;
      };
      document.getElementById("rngTextShadow").oninput = (e) => {
        state.textShadow = Number(e.target.value);
        document.getElementById("valTextShadow").textContent = `${state.textShadow} px`;
      };
      document.getElementById("inpArabicColor").oninput = (e) => {
        state.arabicColor = e.target.value;
      };
      document.getElementById("inpMealColor").oninput = (e) => {
        state.mealColor = e.target.value;
      };
      document.getElementById("selLogoPos").onchange = (e) => {
        state.logoPos = e.target.value;
      };
      document.getElementById("rngLogoScale").oninput = (e) => {
        state.logoScale = Number(e.target.value);
        document.getElementById("valLogoScale").textContent = `%${state.logoScale}`;
      };
      document.getElementById("inpWatermarkText").oninput = (e) => {
        state.watermarkText = e.target.value;
      };

      document.getElementById("rngReciterVol").oninput = (e) => {
        state.reciterVol = Number(e.target.value);
        document.getElementById("valReciterVol").textContent = `%${state.reciterVol}`;
        if (reciterGain) reciterGain.gain.value = state.reciterVol / 100;
      };
      document.getElementById("selAmbientType").onchange = (e) => {
        state.ambientType = e.target.value;
        if (state.isPlaying || state.isRecording) startAmbientSound();
      };
      document.getElementById("rngAmbientVol").oninput = (e) => {
        state.ambientVol = Number(e.target.value);
        document.getElementById("valAmbientVol").textContent = `%${state.ambientVol}`;
        if (ambientGain) ambientGain.gain.value = state.ambientVol / 100;
      };
      document.getElementById("rngBgVideoVol").oninput = (e) => {
        state.bgVideoVol = Number(e.target.value);
        document.getElementById("valBgVideoVol").textContent = `%${state.bgVideoVol}`;
        if (activeBgVideo) {
          activeBgVideo.volume = 1;
          activeBgVideo.muted = false;
          const node = window.__twBgVideoNodes && window.__twBgVideoNodes.get(activeBgVideo);
          if (node) node.gain.gain.value = state.bgVideoVol / 100;
          if (state.bgVideoVol > 0) {
            state.videoAudioMode = "unmuted";
            document.getElementById("selVideoAudioMode").value = "unmuted";
          }
        }
      };
      document.getElementById("rngGaplessTrim").oninput = (e) => {
        state.gaplessTrimSec = Number(e.target.value) / 100;
        document.getElementById("valGaplessTrim").textContent = `${state.gaplessTrimSec.toFixed(2)} sn`;
      };

      document.getElementById("selCoverFirstFrame").onchange = (e) => {
        state.coverFirstFrame = e.target.value;
        loadVersesAndPreloadAudio();
      };
      document.getElementById("selCoverPreviewMode").onchange = (e) => {
        state.coverPreviewMode = e.target.value;
      };
      document.getElementById("inpCoverTitle").oninput = (e) => {
        state.coverTitle = e.target.value;
      };
      document.getElementById("inpCoverSubtitle").oninput = (e) => {
        state.coverSubtitle = e.target.value;
      };
      document.getElementById("selCoverPos").onchange = (e) => {
        state.coverPos = e.target.value;
      };
      document.getElementById("rngCoverScale").oninput = (e) => {
        state.coverScale = Number(e.target.value);
        document.getElementById("valCoverScale").textContent = `%${state.coverScale}`;
      };
      document.getElementById("selCoverBgOverride").onchange = (e) => {
        state.coverBgOverride = e.target.value;
      };

      document.getElementById("btnDownloadCoverPng").onclick = () => {
        hapticTap();
        const prevMode = state.coverPreviewMode;
        state.coverPreviewMode = "cover";
        renderStudioFrame(performance.now());
        const dataUrl = canvas.toDataURL("image/png");
        state.coverPreviewMode = prevMode;

        const surahMeta = SURAHS.find(s => s[0] === state.surahNo) || SURAHS[92];
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `TilawahWorld_Kapak_${surahMeta[1]}_${state.ayahStart}-${state.ayahEnd}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        showToast("Kapak görseli (.PNG) indirildi.");
      };

      document.getElementById("selPlatformRatio").onchange = (e) => {
        state.platformRatio = e.target.value;
        updateCanvasResolutionAndRatio();
      };
      document.getElementById("selResolution").onchange = (e) => {
        state.resolution = Number(e.target.value);
        updateCanvasResolutionAndRatio();
      };
      document.getElementById("btnCopyCaption").onclick = async () => {
        hapticTap();
        const txt = document.getElementById("txtSocialCaption").value;
        try {
          await navigator.clipboard.writeText(txt);
          showToast("Açıklama ve etiketler panoya kopyalandı!");
        } catch (_) {
          document.getElementById("txtSocialCaption").select();
          document.execCommand("copy");
          showToast("Açıklama kopyalandı!");
        }
      };

      document.addEventListener("visibilitychange", () => {
        if (document.hidden && state.isPlaying && !state.isRecording) {
          stopPlaybackAndRecording();
        }
      });
    }

    function initServiceWorker() {
      if (!("serviceWorker" in navigator)) return;
      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });

      navigator.serviceWorker.register("sw.js").then((reg) => {
        if (reg.waiting) {
          showSwUpdateBanner(reg.waiting);
        }
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              showSwUpdateBanner(newWorker);
            }
          });
        });
      }).catch(() => {});
    }

    function showSwUpdateBanner(worker) {
      const banner = document.getElementById("swUpdateBanner");
      const btn = document.getElementById("btnReloadSw");
      banner.classList.add("active");
      btn.onclick = () => {
        worker.postMessage({ type: "SKIP_WAITING" });
      };
    }

    window.TW_CORE = {
      getState: () => state,
      reloadVerses: () => loadVersesAndPreloadAudio(),
      selectBackground: (id) => selectZemin(id),
      startPreview: () => startStudioSession(false),
      startRecording: () => startStudioSession(true),
      stop: () => stopPlaybackAndRecording(),
      render: () => renderStudioFrame(performance.now()),
      showToast: (message) => showToast(message),
      getCatalog: () => catalogItems,
      getCanvas: () => canvas,
      seekPreview: (seconds) => {
        if (state.isRecording) return false;
        if (state.isPlaying) stopPlaybackAndRecording();
        let cursor = state.coverFirstFrame === "on" ? 1.2 : 0;
        let idx = 0;
        for (let i = 0; i < state.audioDurations.length; i++) {
          const d = state.audioDurations[i] || 0;
          if (seconds < cursor + d) { idx = i; break; }
          cursor += Math.max(0.4, d - state.gaplessTrimSec);
          idx = Math.min(i + 1, state.audioDurations.length - 1);
        }
        state.activeVerseIdx = idx;
        state.elapsedTime = Math.max(0, Math.min(seconds, state.totalDuration));
        renderStudioFrame(performance.now());
        return true;
      }
    };

    (async function bootstrap() {
      populateSurahAndReciterSelectors();
      renderCoverTemplateChips();
      bindEvents();
      startRenderLoop();

      await initGalleryDB().catch((err) => console.warn("Galeri veritabanı kullanılamıyor:", err));
      await loadGalleryItemsFromDB().catch((err) => {
        console.warn("Galeri yüklenemedi; uygulama galeri olmadan devam ediyor:", err);
        showToast("Galeri deposu açılamadı. Diğer stüdyo özellikleri kullanılabilir.");
      });
      await loadExternalCatalogJson();

      renderZeminCategories();
      await selectZemin("live_rain_window");
      await loadVersesAndPreloadAudio();
      initServiceWorker();
    })();
  