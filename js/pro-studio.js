
(() => {
  "use strict";
  const $ = (s, r=document) => r.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const dbName = "TilawahWorldProDB", storeName = "projects";
  let db = null, projects = [], batchQueue = [], batchRunning = false, saveTimer = null;
  const safeKeys = [
    "surahNo","ayahStart","ayahEnd","reciterId","subtitleMode","bismillahMode","zeminId","visualEffect","effectIntensity",
    "bgDim","bgBlur","bgBrightness","bgZoom","bgPanX","bgPanY","kenBurns","videoAudioMode","videoTrimStart","videoTrimEnd",
    "arabicFont","arabicSize","mealSize","transitionMode","textShadow","arabicColor","mealColor","logoPos","logoScale",
    "watermarkText","reciterVol","ambientType","ambientVol","bgVideoVol","gaplessTrimSec","coverTemplateId","coverFirstFrame",
    "coverPreviewMode","coverTitle","coverSubtitle","coverPos","coverScale","coverBgOverride","platformRatio","resolution"
  ];
  const templates = (() => {
    const categories = [
      ["Mescit ve Mimari",["Klasik Mihrap","Osmanlı Kubbesi","Mermer Sütunlar","Selçuklu Geometrisi","Avlu Işığı","Minare Silüeti","Altın Mihrap","Gece Camisi"]],
      ["Doğa",["Orman Sisi","Şelale Huzuru","Yeşil Vadi","Dağ Şafağı","Çiçek Bahçesi","Göl Yansıması","Yağmur Camı","Sonbahar Yaprakları"]],
      ["Gece ve Gökyüzü",["Yıldızlı Gece","Hilal Işığı","Kutup Yıldızı","Derin Lacivert","Mekke Gecesi","Medine Gecesi","Gökyüzü Bulutları","Ramazan Gecesi"]],
      ["Deniz ve Su",["Sakin Deniz","Okyanus Ufku","Sahil Gün Doğumu","Su Damlaları","Mavi Derinlik","Nehir Akışı"]],
      ["Minimal",["Sade Krem","Koyu Minimal","Kum Beji","Zeytin Yeşili","Saf Beyaz","Kömür Siyahı","Modern Çizgi","Soft Gradient"]],
      ["Altın ve Geometri",["Altın Tezhip","Geometrik Motif","İnci Çerçeve","Bakır Hat","İslami Desen","Lüks Siyah Altın"]],
      ["Özel Günler",["Cuma Bereketi","Ramazan","Kadir Gecesi","Bayram Sabahı","Hicri Yeni Yıl","Hafızlık Hatırası"]]
    ];
    const out=[]; let n=0;
    const backgrounds={
      "Mescit ve Mimari":["live_arch_mihrab","live_arch_dome","live_arch_kandil","live_arch_medina","live_abs_islamic_gold"],
      "Doğa":["live_nature_mist","live_nature_rays","live_nature_autumn","live_nature_valley"],
      "Gece ve Gökyüzü":["live_night_aurora","live_night_cosmos","live_night_moon","live_night_nebula"],
      "Deniz ve Su":["live_sea_waves","live_sea_sunset","live_sea_dawn","live_sea_ocean"],
      "Minimal":["live_abs_velvet","live_abs_silk","live_rain_blue","live_rain_emerald"],
      "Altın ve Geometri":["live_abs_islamic_gold","live_abs_islamic_teal","live_arch_kandil"],
      "Özel Günler":["live_arch_medina","live_arch_mihrab","live_night_moon","live_rain_amber"]
    };
    categories.forEach(([category,names])=>names.forEach((name)=>{
      const palettes=[
        ["#f5df9b","#e6d6ad"],["#d8e9d0","#a8c7ae"],["#d5d9f4","#b7bce5"],
        ["#d9edf1","#b6d9e3"],["#eee5d3","#d9c9ae"],["#f0d18c","#c8a45a"]
      ];
      const palette=palettes[n%palettes.length];
      const bgList=backgrounds[category]||["live_rain_window"];
      out.push({id:`pro_tpl_${String(++n).padStart(2,"0")}`,name,category,zeminId:bgList[(n-1)%bgList.length],arabicColor:palette[0],mealColor:palette[1],bgDim:[42,50,58,36,48][n%5],arabicSize:[40,42,44,46][n%4],mealSize:[20,21,22][n%3],transitionMode:["fade","slide","none"][n%3],textShadow:[10,14,18][n%3]});
    }));
    return out;
  })();

  function openDB(){
    return new Promise((resolve,reject)=>{
      if(!("indexedDB" in window)) return reject(new Error("IndexedDB desteklenmiyor"));
      const req=indexedDB.open(dbName,1);
      req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(storeName)) req.result.createObjectStore(storeName,{keyPath:"id"});};
      req.onsuccess=()=>{db=req.result;resolve(db);}; req.onerror=()=>reject(req.error);
    });
  }
  function store(mode="readonly"){return db.transaction(storeName,mode).objectStore(storeName);}
  async function getAllProjects(){
    try{if(!db) await openDB();return await new Promise((res,rej)=>{const r=store().getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error);});}
    catch(_){try{return JSON.parse(localStorage.getItem("tw_projects_fallback")||"[]");}catch(__){return [];}}
  }
  async function putProject(project){
    try{if(!db) await openDB();await new Promise((res,rej)=>{const r=store("readwrite").put(project);r.onsuccess=()=>res();r.onerror=()=>rej(r.error);});}
    catch(_){const list=await getAllProjects();const ix=list.findIndex(x=>x.id===project.id);if(ix>=0)list[ix]=project;else list.unshift(project);localStorage.setItem("tw_projects_fallback",JSON.stringify(list.slice(0,20)));}
  }
  async function deleteProject(id){
    try{if(!db) await openDB();await new Promise((res,rej)=>{const r=store("readwrite").delete(id);r.onsuccess=()=>res();r.onerror=()=>rej(r.error);});}
    catch(_){localStorage.setItem("tw_projects_fallback",JSON.stringify((await getAllProjects()).filter(p=>p.id!==id)));}
  }
  function snapshot(name="Adsız Proje"){
    const st=window.TW_CORE.getState(), settings={};
    safeKeys.forEach(k=>settings[k]=st[k]);
    return {id:crypto.randomUUID?crypto.randomUUID():`p_${Date.now()}_${Math.random().toString(36).slice(2)}`,name,settings,subtitleCues:st.__twSubtitleCues||[],createdAt:Date.now(),updatedAt:Date.now(),version:2};
  }
  function toast(msg){window.TW_CORE?.showToast(msg);}
  function syncControls(st){
    const map={selSurah:"surahNo",selAyahStart:"ayahStart",selAyahEnd:"ayahEnd",selReciter:"reciterId",selSubtitleMode:"subtitleMode",selBismillahMode:"bismillahMode",selVisualEffect:"visualEffect",selKenBurns:"kenBurns",selVideoAudioMode:"videoAudioMode",selTransitionMode:"transitionMode",selLogoPos:"logoPos",selAmbientType:"ambientType",selCoverFirstFrame:"coverFirstFrame",selCoverPreviewMode:"coverPreviewMode",selCoverPos:"coverPos",selCoverBgOverride:"coverBgOverride",selPlatformRatio:"platformRatio",selResolution:"resolution",inpArabicColor:"arabicColor",inpMealColor:"mealColor",inpWatermarkText:"watermarkText",inpCoverTitle:"coverTitle",inpCoverSubtitle:"coverSubtitle"};
    Object.entries(map).forEach(([id,key])=>{const el=document.getElementById(id);if(el&&st[key]!=null)el.value=st[key];});
    const ranges={rngArabicSize:"arabicSize",rngMealSize:"mealSize",rngBgDim:"bgDim",rngBgBlur:"bgBlur",rngBgBrightness:"bgBrightness",rngBgZoom:"bgZoom",rngBgPanX:"bgPanX",rngBgPanY:"bgPanY",rngReciterVol:"reciterVol",rngAmbientVol:"ambientVol",rngBgVideoVol:"bgVideoVol",rngTextShadow:"textShadow",rngLogoScale:"logoScale",rngEffectIntensity:"effectIntensity"};
    Object.entries(ranges).forEach(([id,key])=>{const el=document.getElementById(id);if(el&&st[key]!=null){el.value=st[key];el.dispatchEvent(new Event("input",{bubbles:true}));}});
  }
  async function applyProject(project){
    const st=window.TW_CORE.getState(), settings={...(project.settings||{})};
    Object.assign(st,settings);st.__twSubtitleCues=project.subtitleCues||[];
    syncControls(st);
    const wantedStart=Number(settings.ayahStart||1),wantedEnd=Number(settings.ayahEnd||wantedStart);
    const surah=document.getElementById("selSurah");
    if(surah)surah.dispatchEvent(new Event("change"));
    await new Promise(r=>setTimeout(r,80));
    st.ayahStart=wantedStart;st.ayahEnd=wantedEnd;
    const a=document.getElementById("selAyahStart"),b=document.getElementById("selAyahEnd");
    if(a)a.value=String(wantedStart);if(b)b.value=String(wantedEnd);
    await window.TW_CORE.reloadVerses();
    await window.TW_CORE.selectBackground(st.zeminId);
    Object.assign(st,settings);
    st.ayahStart=wantedStart;st.ayahEnd=wantedEnd;st.__twSubtitleCues=project.subtitleCues||[];
    syncControls(st);
    window.TW_CORE.render();
    toast(`“${project.name}” projesi açıldı.`);
  }
  async function refreshProjects(){
    projects=await getAllProjects();projects.sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
    const list=$("#twProjectList");if(!list)return;
    list.innerHTML=projects.length?projects.map(p=>`<div class="tw-pro-project"><b>${esc(p.name)}</b><small>${new Date(p.updatedAt||p.createdAt).toLocaleString("tr-TR")} · ${p.settings?.platformRatio||"9:16"} · ${p.settings?.resolution||720}p</small><div class="tw-pro-row"><button class="tw-pro-btn" data-open-project="${esc(p.id)}">Aç</button><button class="tw-pro-btn secondary" data-queue-project="${esc(p.id)}">Toplu sıraya ekle</button><button class="tw-pro-btn danger" data-delete-project="${esc(p.id)}">Sil</button></div></div>`).join(""):`<p class="tw-pro-status">Henüz kayıtlı proje yok. İlk projenizi kaydedin.</p>`;
  }
  async function saveProject(){
    const name=($("#twProjectName").value||"Tilawah Projesi").trim();
    const p=snapshot(name);await putProject(p);await refreshProjects();toast("Proje güvenli şekilde kaydedildi.");
  }
  function renderTimeline(){
    const st=window.TW_CORE.getState(),wrap=$("#twTimelineTracks");if(!wrap)return;
    const count=st.verses?.length||0, total=st.totalDuration||0;
    const widths=st.audioDurations||[];
    const widthFor=d=>total>0?Math.max(1,(d/total)*100):100/Math.max(1,count);
    const audio=widths.map(d=>`<div class="tw-pro-clip audio" style="width:${widthFor(d||0)}%" title="Tilavet"></div>`).join("");
    const ayah=widths.map((d,i)=>`<div class="tw-pro-clip" style="width:${widthFor(d||0)}%" title="${i+1}. ayet"></div>`).join("");
    const meal=widths.map((d,i)=>`<div class="tw-pro-clip meal" style="width:${widthFor(d||0)}%" title="${i+1}. meal"></div>`).join("");
    wrap.innerHTML=`<div class="tw-pro-meta"><span>ARKA PLAN</span><span>${total?total.toFixed(1)+" sn":"Hazırlanıyor"}</span></div><div class="tw-pro-track"><div class="tw-pro-clip" style="width:100%;background:linear-gradient(90deg,#3d465b,#7b879c)"></div></div><div class="tw-pro-meta"><span>AYETLER (${count})</span><span>Metin katmanı</span></div><div class="tw-pro-track">${ayah}</div><div class="tw-pro-meta"><span>MEAL / ALTYAZI</span><span>Metin katmanı</span></div><div class="tw-pro-track">${meal}</div><div class="tw-pro-meta"><span>TİLAVET SESİ</span><span>${total?total.toFixed(1)+" sn":"--"}</span></div><div class="tw-pro-track">${audio}</div><div class="tw-pro-meta"><span>LOGO / EFEKT</span><span>Proje ayarlarından</span></div><div class="tw-pro-track"><div class="tw-pro-clip" style="width:100%;background:linear-gradient(90deg,#5c4776,#9d7dbd)"></div></div>`;
    const seek=$("#twTimelineSeek");if(seek){seek.max=Math.max(1,total);seek.value=Math.min(Number(seek.value)||0,total);$("#twTimelineTime").textContent=`${Number(seek.value).toFixed(1)} / ${total.toFixed(1)} sn`;}
  }
  function renderCueEditor(){
    const st=window.TW_CORE.getState(),tbody=$("#twCueRows");if(!tbody)return;
    const cues=st.__twSubtitleCues||(st.__twSubtitleCues=[]);
    tbody.innerHTML=(st.verses||[]).map((v,i)=>{
      const c=cues[i]||{start:"",end:""};return `<tr><td>${v.numberInSurah}</td><td><input type="number" min="0" step=".1" data-cue="${i}" data-field="start" value="${esc(c.start)}" placeholder="0.0"></td><td><input type="number" min="0" step=".1" data-cue="${i}" data-field="end" value="${esc(c.end)}" placeholder="—"></td></tr>`;
    }).join("");
  }
  function activateTab(tab){
    document.querySelectorAll(".tw-pro-tabs button").forEach(b=>b.classList.toggle("active",b.dataset.protab===tab));
    document.querySelectorAll(".tw-pro-section").forEach(s=>s.classList.toggle("active",s.dataset.prosection===tab));
    if(tab==="projects")refreshProjects();if(tab==="timeline")renderTimeline();if(tab==="subtitles")renderCueEditor();
  }
  function openPanel(){const o=$("#twProOverlay");o.classList.add("open");o.setAttribute("aria-hidden","false");activateTab("projects");}
  function closePanel(){const o=$("#twProOverlay");o.classList.remove("open");o.setAttribute("aria-hidden","true");}
  function addTemplateGrid(){
    $("#twTemplateGrid").innerHTML=templates.map(t=>`<button class="tw-pro-template" data-template="${t.id}"><b>${esc(t.name)}</b><small>${esc(t.category)}</small></button>`).join("");
    $("#twTemplateCount").textContent=`${templates.length} hazır şablon`;
  }
  async function applyTemplate(t){
    const st=window.TW_CORE.getState();Object.assign(st,{arabicColor:t.arabicColor,mealColor:t.mealColor,bgDim:t.bgDim,arabicSize:t.arabicSize,mealSize:t.mealSize,transitionMode:t.transitionMode,textShadow:t.textShadow});
    syncControls(st);
    if(t.zeminId) await window.TW_CORE.selectBackground(t.zeminId);
    st.bgDim=t.bgDim;syncControls(st);
    window.TW_CORE.render();toast(`${t.name} şablonu uygulandı.`);
  }
  function downloadJSON(data,name){
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
  }
  async function importProject(file){
    const data=JSON.parse(await file.text());const p=Array.isArray(data)?data:data.project||data;
    if(Array.isArray(p)){for(const x of p)if(x.settings)await putProject(x);}else if(p.settings)await putProject({...p,id:p.id||`import_${Date.now()}`,updatedAt:Date.now()});else throw new Error("Geçersiz proje dosyası");
    await refreshProjects();toast("Proje dosyası içe aktarıldı.");
  }
  function renderBatchQueue(){
    const box=$("#twBatchQueue");if(!box)return;
    box.innerHTML=batchQueue.length?batchQueue.map((p,i)=>`<div class="tw-pro-project"><b>${i+1}. ${esc(p.name)}</b><small>Seri dışa aktarma kuyruğu</small></div>`).join(""):`<p class="tw-pro-status">Kuyruk boş. Projeler sekmesinden sıraya ekleyin.</p>`;
  }
  async function runBatch(){
    if(batchRunning||!batchQueue.length)return;
    if(!("MediaRecorder" in window)){toast("Bu tarayıcı video kaydını desteklemiyor.");return;}
    batchRunning=true;$("#twBatchStart").disabled=true;let done=0;
    try{
      while(batchQueue.length){
        const project=batchQueue.shift();renderBatchQueue();
        $("#twBatchStatus").textContent=`${done+1}. video hazırlanıyor: ${project.name}`;
        await applyProject(project);
        const st=window.TW_CORE.getState();
        if(!st.audioReady)throw new Error(`${project.name}: Sesler hazır değil.`);
        const oldBlob=st.lastExportBlob;await window.TW_CORE.startRecording();
        let waited=0;
        while(waited<15*60*1000){
          await new Promise(r=>setTimeout(r,500));waited+=500;
          if(!st.isRecording && !st.isPlaying && st.lastExportBlob && st.lastExportBlob!==oldBlob)break;
        }
        if(!st.lastExportBlob||st.lastExportBlob===oldBlob)throw new Error(`${project.name}: Kayıt tamamlanmadı veya zaman aşımına uğradı.`);
        const ext=st.lastExportExt||"webm",url=URL.createObjectURL(st.lastExportBlob),a=document.createElement("a");a.href=url;a.download=`Tilawah-${project.name.replace(/[^\p{L}\p{N}-]+/gu,"-")}.${ext}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
        done++;$("#twBatchStatus").textContent=`${done} video tamamlandı.`;
        await new Promise(r=>setTimeout(r,1200));
      }
      toast(`${done} video sırayla oluşturuldu.`);
    }catch(e){$("#twBatchStatus").textContent=e.message;toast(e.message);}
    finally{batchRunning=false;$("#twBatchStart").disabled=false;}
  }
  function addUI(){
    if($("#twProOverlay"))return;
    const ui=document.createElement("div");ui.id="twProOverlay";ui.setAttribute("aria-hidden","true");
    ui.innerHTML=`<div class="tw-pro-shell" role="dialog" aria-modal="true" aria-label="Tilawah World Pro Studio">
      <div class="tw-pro-head"><div><strong>TILAWAH WORLD · PRO STÜDYO</strong><small>Proje yönetimi · Timeline · Altyazı · Toplu üretim</small></div><button class="tw-pro-close" id="twProClose" aria-label="Kapat">×</button></div>
      <div class="tw-pro-tabs"><button data-protab="projects" class="active">Projeler</button><button data-protab="timeline">Timeline</button><button data-protab="subtitles">Altyazı</button><button data-protab="templates">Şablonlar</button><button data-protab="batch">Toplu üretim</button><button data-protab="offline">Çevrimdışı</button></div>
      <div class="tw-pro-body">
        <section class="tw-pro-section active" data-prosection="projects">
          <div class="tw-pro-card"><h3>Yeni proje kaydet</h3><label class="tw-pro-label" for="twProjectName">Proje adı</label><input id="twProjectName" class="tw-pro-input" maxlength="80" placeholder="Örn. Fatiha - Sabah Tilaveti"><div class="tw-pro-row" style="margin-top:10px"><button class="tw-pro-btn" id="twSaveProject">Projeyi kaydet</button><button class="tw-pro-btn secondary" id="twExportProject">JSON dışa aktar</button><button class="tw-pro-btn secondary" id="twImportProject">JSON içe aktar</button><input type="file" id="twImportFile" accept=".json,application/json" hidden></div></div>
          <div class="tw-pro-card"><h3>Kayıtlı projeler</h3><div id="twProjectList"></div></div>
        </section>
        <section class="tw-pro-section" data-prosection="timeline">
          <div class="tw-pro-card"><h3>Çok katmanlı zaman çizelgesi</h3><p class="tw-pro-status">Katmanlar mevcut ayet ve ses sürelerinden otomatik oluşturulur. Ses ve görsel düzenleme ana stüdyo kontrollerinden yönetilir.</p><div id="twTimelineTracks"></div><label class="tw-pro-label">Önizleme konumu</label><input id="twTimelineSeek" class="tw-pro-range" type="range" min="0" max="1" step=".1" value="0"><div class="tw-pro-meta"><span id="twTimelineTime">0 / 0 sn</span><span>Kesin zaman bilgisi</span></div><div class="tw-pro-row" style="margin-top:12px"><button class="tw-pro-btn secondary" id="twRefreshTimeline">Timeline yenile</button><button class="tw-pro-btn" id="twPlayFromStart">Baştan önizle</button></div></div>
        </section>
        <section class="tw-pro-section" data-prosection="subtitles">
          <div class="tw-pro-card"><h3>Altyazı kontrolü</h3><label class="tw-pro-label">Altyazı dili</label><select id="twSubtitleMode" class="tw-pro-select"><option value="tr">Türkçe meal</option><option value="en">English translation</option><option value="both">Türkçe + English</option><option value="none">Altyazı kapalı</option></select><p class="tw-pro-status">Ayet bazlı gösterim mevcut render motoruyla çalışır. Aşağıdaki zamanlar manuel girilir; kelime zamanları tahmin edilmez.</p><h3 style="margin-top:16px">Manuel ayet zamanları (saniye)</h3><div style="overflow:auto;max-height:290px"><table class="tw-pro-table"><thead><tr><th>Ayet</th><th>Başlangıç</th><th>Bitiş</th></tr></thead><tbody id="twCueRows"></tbody></table></div><button class="tw-pro-btn" id="twSaveCues" style="margin-top:10px">Zamanları kaydet</button></div>
        </section>
        <section class="tw-pro-section" data-prosection="templates">
          <div class="tw-pro-card"><h3>Profesyonel tasarım koleksiyonu</h3><p class="tw-pro-status"><b id="twTemplateCount">50 hazır şablon</b> · Şablon seçildiğinde yazı renkleri, boyutlar ve efekt ayarları uygulanır.</p><div class="tw-pro-grid" id="twTemplateGrid"></div></div>
        </section>
        <section class="tw-pro-section" data-prosection="batch">
          <div class="tw-pro-card"><h3>Toplu video üretimi</h3><p class="tw-pro-status">Kayıtlı projeler sırayla açılır, sesleri hazırlanır ve video kaydı başlatılır. Tarayıcı indirme izinleri ve cihaz belleği performansı etkileyebilir.</p><div id="twBatchQueue"></div><div class="tw-pro-row" style="margin-top:10px"><button class="tw-pro-btn" id="twBatchStart">Sırayı başlat</button><button class="tw-pro-btn secondary" id="twBatchClear">Kuyruğu temizle</button></div><p class="tw-pro-status" id="twBatchStatus" aria-live="polite">Beklemede.</p></div>
        </section>
        <section class="tw-pro-section" data-prosection="offline">
          <div class="tw-pro-card"><h3>Çevrimdışı içerik yönetimi</h3><p class="tw-pro-status">Uygulama kabuğu Service Worker ile önbelleğe alınır. Ayet verileri seçilen sure/ayet aralığı başarıyla yüklendiğinde Cache Storage'a kaydedilir. Ses dosyaları ve kullanıcı medyaları internet olmadan kullanılmadan önce ayrıca indirilmelidir.</p><div class="tw-pro-row"><button class="tw-pro-btn" id="twCacheCurrent">Seçili ayet aralığını indir</button><button class="tw-pro-btn secondary" id="twCheckOffline">Önbellek durumunu kontrol et</button></div><p class="tw-pro-status" id="twOfflineStatus">Henüz kontrol edilmedi.</p></div>
        </section>
      </div><div class="tw-pro-footer"><span class="tw-pro-status">Mobil öncelikli · Yerel kayıt</span><button class="tw-pro-btn secondary" id="twProClose2">Kapat</button></div>
    </div>`;
    document.body.appendChild(ui);
    $("#btnOpenProStudio").addEventListener("click",openPanel);$("#twProClose").addEventListener("click",closePanel);$("#twProClose2").addEventListener("click",closePanel);
    ui.addEventListener("click",e=>{if(e.target===ui)closePanel();});
    ui.querySelectorAll("[data-protab]").forEach(b=>b.addEventListener("click",()=>activateTab(b.dataset.protab)));
    $("#twSaveProject").onclick=saveProject;
    $("#twExportProject").onclick=()=>downloadJSON({app:"Tilawah World",version:2,projects},`tilawah-world-projects-${Date.now()}.json`);
    $("#twImportProject").onclick=()=>$("#twImportFile").click();
    $("#twImportFile").onchange=async e=>{try{if(e.target.files[0])await importProject(e.target.files[0]);}catch(err){toast("İçe aktarma hatası: "+err.message);}e.target.value="";};
    $("#twProjectList").addEventListener("click",async e=>{
      const open=e.target.closest("[data-open-project]"),del=e.target.closest("[data-delete-project]"),queue=e.target.closest("[data-queue-project]");
      if(open){const p=projects.find(x=>x.id===open.dataset.openProject);if(p)await applyProject(p);}
      if(del){await deleteProject(del.dataset.deleteProject);await refreshProjects();toast("Proje silindi.");}
      if(queue){const p=projects.find(x=>x.id===queue.dataset.queueProject);if(p){batchQueue.push(p);renderBatchQueue();toast("Toplu üretim sırasına eklendi.");}}
    });
    $("#twRefreshTimeline").onclick=renderTimeline;
    $("#twPlayFromStart").onclick=()=>{window.TW_CORE.startPreview();closePanel();};
    $("#twTimelineSeek").oninput=e=>{
      const seconds=Number(e.target.value);
      $("#twTimelineTime").textContent=`${seconds.toFixed(1)} / ${Number(e.target.max).toFixed(1)} sn`;
      window.TW_CORE.seekPreview(seconds);
    };
    $("#twSubtitleMode").onchange=e=>{const st=window.TW_CORE.getState();st.subtitleMode=e.target.value;const el=$("#selSubtitleMode");if(el)el.value=e.target.value;window.TW_CORE.render();};
    $("#twCueRows").addEventListener("change",e=>{const el=e.target.closest("[data-cue]");if(!el)return;const st=window.TW_CORE.getState();st.__twSubtitleCues=st.__twSubtitleCues||[];const i=Number(el.dataset.cue);st.__twSubtitleCues[i]=st.__twSubtitleCues[i]||{};st.__twSubtitleCues[i][el.dataset.field]=el.value;});
    $("#twSaveCues").onclick=()=>{const st=window.TW_CORE.getState();st.__twSubtitleCues=st.__twSubtitleCues||[];toast("Manuel altyazı zamanları bu projeyle birlikte kaydedilecek.");};
    $("#twTemplateGrid").addEventListener("click",e=>{const b=e.target.closest("[data-template]");if(!b)return;const t=templates.find(x=>x.id===b.dataset.template);if(t)applyTemplate(t);});
    $("#twBatchStart").onclick=runBatch;$("#twBatchClear").onclick=()=>{batchQueue=[];renderBatchQueue();};
    $("#twCacheCurrent").onclick=async()=>{
      const st=window.TW_CORE.getState(),url=`https://api.alquran.cloud/v1/surah/${st.surahNo}/editions/quran-uthmani,tr.diyanet,en.sahih?offset=${st.ayahStart-1}&limit=${st.ayahEnd-st.ayahStart+1}`;
      try{const cache=await caches.open("tilawah-quran-data-v2");const res=await fetch(url);if(!res.ok)throw Error("Sunucu yanıt vermedi");await cache.put(url,res.clone());$("#twOfflineStatus").textContent=`${st.surahNo}. sure ${st.ayahStart}-${st.ayahEnd}. ayet aralığı indirildi.`;toast("Ayet verisi çevrimdışı kullanım için indirildi.");}catch(err){$("#twOfflineStatus").textContent=err.message;toast("İndirme başarısız: "+err.message);}
    };
    $("#twCheckOffline").onclick=async()=>{try{const c=await caches.open("tilawah-quran-data-v2"),keys=await c.keys();$("#twOfflineStatus").textContent=`${keys.length} ayet verisi kaydı önbellekte.`;}catch(e){$("#twOfflineStatus").textContent="Cache Storage kullanılamıyor.";}};
    addTemplateGrid();renderBatchQueue();refreshProjects();
    // autosave draft, separate from named project records
    const autoSave=()=>{clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{const p=snapshot("Otomatik taslak");p.id="__autosave__";putProject(p);}catch(_){}},1800);};
    document.addEventListener("change",e=>{if(e.target.closest(".bottom-sheet"))autoSave();});
    window.addEventListener("beforeunload",()=>{if(saveTimer)clearTimeout(saveTimer);});
  }
  function init(){
    if(!window.TW_CORE){console.warn("Tilawah core API not available");return;}
    addUI();openDB().then(refreshProjects).catch(()=>refreshProjects());
    setInterval(()=>{if($("#twProOverlay")?.classList.contains("open")&&$(".tw-pro-section.active")?.dataset.prosection==="timeline")renderTimeline();},1000);
    // load draft only when no explicit saved state is currently active; never overwrite user selections automatically.
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
