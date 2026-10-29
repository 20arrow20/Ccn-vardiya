'use strict';
/* Vardiya Panosu — vardiya listesi görsellerinden 1/2/3 vardiya, OFF, rapor ve izin listeleri çıkarır.
   Tüm veri cihazda (localStorage) tutulur; APK (Capacitor) içinde de aynı kod çalışır. */

// ---------- Sabitler ----------
const CODES = {
  '1':   { label: '1. Vardiya', short: '1' },
  '2':   { label: '2. Vardiya', short: '2' },
  '3':   { label: '3. Vardiya', short: '3' },
  'OFF': { label: 'OFF (Hafta tatili)', short: 'OFF' },
  'R':   { label: 'Raporlu', short: 'R' },
  'YI':  { label: 'Yıllık İzin', short: 'Yİ' },
  'MI':  { label: 'Diğer İzin', short: 'İ' },
  '':    { label: 'Boş', short: '–' },
};
const CODE_ORDER = ['1', '2', '3', 'OFF', 'R', 'YI', 'MI', ''];
const ABSENT = [
  { code: 'OFF', title: 'OFF' },
  { code: 'R', title: 'Raporlu' },
  { code: 'YI', title: 'Yıllık İzin' },
  { code: 'MI', title: 'Diğer İzin' },
];
const COLOR_NAMES = { red: 'Kırmızı', orange: 'Turuncu', yellow: 'Sarı', green: 'Yeşil', blue: 'Mavi', purple: 'Mor', gray: 'Gri' };
const DAY_NAMES = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const DAY_SHORT = ['Pz', 'Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct'];
const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const STORE_KEY = 'vardiya-panosu-v1';

// ---------- Tarih yardımcıları (yerel saat, saat dilimi kayması olmadan) ----------
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseIso = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseIso(s); d.setDate(d.getDate() + n); return iso(d); };
const todayIso = () => iso(new Date());
const fmtLong = (s) => { const d = parseIso(s); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
const fmtShort = (s) => { const d = parseIso(s); return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`; };
const dayName = (s) => DAY_NAMES[parseIso(s).getDay()];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nameKey = (s) => String(s).toLocaleLowerCase('tr').replace(/[^a-zçğıöşüâîû]/g, '');
const uid = () => Math.random().toString(36).slice(2, 10);
const cmpName = (a, b) => a.name.localeCompare(b.name, 'tr');

// ---------- Veri ----------
function defaultStore() {
  return {
    v: 1, demo: false,
    people: {},           // key -> { name, group: '1'|'2'|'3'|'', days: { 'YYYY-MM-DD': code } }
    uploads: [],          // { id, at, group, start, days, count, file }
    settings: {
      company: '',
      hours: { '1': '08:00–16:00', '2': '16:00–24:00', '3': '00:00–08:00' },
      colors: { red: 'OFF', orange: '', yellow: '', green: '', blue: '', purple: '', gray: '' },
    },
  };
}
let store = load();
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) { const s = JSON.parse(raw); const d = defaultStore(); return { ...d, ...s, settings: { ...d.settings, ...s.settings, hours: { ...d.settings.hours, ...(s.settings || {}).hours }, colors: { ...d.settings.colors, ...(s.settings || {}).colors } } }; }
  } catch (e) { /* depolama yoksa örnek veriyle devam */ }
  return makeDemo();
}
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* yoksay */ } }

// Örnek veri: üç ekip, 14 günlük dönem, döner OFF günleri
function makeDemo() {
  const s = defaultStore(); s.demo = true;
  const teams = {
    '1': ['Ahmet Yılmaz', 'Ayşe Demir', 'Mehmet Kaya', 'Fatma Çelik', 'Mustafa Şahin', 'Zeynep Öztürk', 'Emre Aydın', 'Elif Arslan', 'Hasan Doğan', 'Merve Koç'],
    '2': ['Ali Kılıç', 'Esra Kurt', 'Burak Özdemir', 'Gamze Aslan', 'Serkan Polat', 'Derya Yıldız', 'Oğuz Erdoğan', 'Büşra Güneş', 'Cem Aksoy', 'Seda Karaca'],
    '3': ['Kemal Uçar', 'Hülya Tekin', 'Volkan Bulut', 'Sevgi Ünal', 'Tolga Işık', 'Gül Akın', 'Murat Çakır', 'Ebru Şen', 'Kaan Yavuz', 'İrem Duman'],
  };
  // Dönem: bu haftanın pazartesisinden başlayan 14 gün
  const t = new Date(); const back = (t.getDay() + 6) % 7; t.setDate(t.getDate() - back);
  const start = iso(t);
  for (const g of ['1', '2', '3']) {
    teams[g].forEach((name, r) => {
      const days = {};
      const offs = new Set([(r * 2 + Number(g)) % 7, (r * 2 + Number(g) + 1) % 7]);
      for (let i = 0; i < 14; i++) days[addDays(start, i)] = offs.has(i % 7) ? 'OFF' : g;
      if (r === 3) days[addDays(start, 2)] = 'R', days[addDays(start, 3)] = 'R';
      if (r === 6) for (let i = 7; i < 12; i++) days[addDays(start, i)] = 'YI';
      if (r === 8 && g === '2') days[addDays(start, 1)] = 'YI', days[addDays(start, 2)] = 'YI';
      s.people[nameKey(name)] = { name, group: g, days };
    });
  }
  s.uploads = [];
  return s;
}

// ---------- Uygulama durumu ----------
const ui = {
  view: 'gunluk',
  date: todayIso(),
  gridStart: null,
  gridGroup: 'all',
  review: null,     // görsel analizi sonrası düzenleme taslağı
  busy: null,       // { text, pct }
  collapsed: {},
};
const $app = document.getElementById('app');
const $overlay = document.getElementById('overlay');

function allPeople() { return Object.entries(store.people).map(([key, p]) => ({ key, ...p })); }
function dataRange() {
  let min = null, max = null;
  for (const p of Object.values(store.people)) for (const d of Object.keys(p.days)) { if (!min || d < min) min = d; if (!max || d > max) max = d; }
  return { min, max };
}

// ---------- Yönlendirme ----------
const VIEWS = ['gunluk', 'cizelge', 'yukle', 'ayarlar'];
function go(view) { if (location.hash !== '#' + view) location.hash = view; else render(); }
function fromHash() { const h = location.hash.replace('#', ''); ui.view = VIEWS.includes(h) ? h : 'gunluk'; render(); }
window.addEventListener('hashchange', fromHash);
document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => go(b.dataset.view)));

function render() {
  document.querySelectorAll('.tab').forEach((b) => b.setAttribute('aria-current', b.dataset.view === ui.view ? 'page' : 'false'));
  const sub = document.getElementById('brand-sub');
  sub.textContent = store.settings.company ? store.settings.company : '1 · 2 · 3 vardiya, OFF ve izin takibi';
  const banner = store.demo ? `<div class="banner"><p><b>Örnek veri gösteriliyor.</b> Kendi vardiya listenizin görselini “Liste Yükle” bölümünden ekleyin; örnek veri o zaman silinir.</p><button class="btn" data-act="clear-demo">Örnek veriyi temizle</button></div>` : '';
  const views = { gunluk: viewDaily, cizelge: viewGrid, yukle: viewUpload, ayarlar: viewSettings };
  $app.innerHTML = banner + views[ui.view]();
  bindView();
}

// ---------- Günlük görünüm ----------
function dayLists(date) {
  const people = allPeople();
  const out = {};
  for (const g of ['1', '2', '3']) {
    const working = people.filter((p) => p.days[date] === g).sort(cmpName);
    const absent = {};
    for (const a of ABSENT) absent[a.code] = people.filter((p) => p.group === g && p.days[date] === a.code).sort(cmpName);
    const unknown = people.filter((p) => p.group === g && !p.days[date]).sort(cmpName);
    out[g] = { working, absent, unknown };
  }
  return out;
}

function viewDaily() {
  const d = ui.date; const lists = dayLists(d);
  const t = todayIso();
  const chips = [[addDays(t, -1), 'Dün'], [t, 'Bugün'], [addDays(t, 1), 'Yarın']]
    .map(([v, l]) => `<button class="chip" data-act="set-date" data-date="${v}" aria-pressed="${v === d}">${l}</button>`).join('');
  const tot = (k) => ['1', '2', '3'].reduce((n, g) => n + lists[g].absent[k].length, 0);
  const working = ['1', '2', '3'].reduce((n, g) => n + lists[g].working.length, 0);
  const hasAny = Object.keys(store.people).length > 0;
  const range = dataRange();
  const outOfRange = hasAny && range.min && (d < range.min || d > range.max);

  const shiftCard = (g) => {
    const L = lists[g];
    const grp = (code, title, arr, open) => {
      const id = `${g}-${code}`; const collapsed = ui.collapsed[id] ?? !open;
      return `<div class="grp ${collapsed && arr.length ? 'collapsed' : ''}">
        <button class="grp-h btn ghost" style="width:100%;padding:0;min-height:28px" data-act="toggle-grp" data-id="${id}" aria-expanded="${!collapsed}"><span class="dot k-${code}"></span>${title}<span class="count">${arr.length} kişi</span></button>
        ${arr.length ? `<ol class="names">${arr.map((p, i) => `<li><span class="n">${i + 1}</span><span>${esc(p.name)}</span></li>`).join('')}</ol>` : `<div class="empty">Kimse yok</div>`}
      </div>`;
    };
    return `<section class="shift" data-s="${g}">
      <div class="shift-head"><div class="shift-num">${g}</div><div class="grow"><h3>${g}. Vardiya</h3><div class="hrs">${esc(store.settings.hours[g] || '')}</div></div>
        <button class="iconbtn" title="${g}. vardiyayı paylaş" aria-label="${g}. vardiyayı paylaş" data-act="share" data-g="${g}">${ICON_SHARE}</button></div>
      ${grp(g, 'Çalışanlar', L.working, true)}
      ${ABSENT.filter((a) => a.code !== 'MI' || L.absent.MI.length).map((a) => grp(a.code, a.title, L.absent[a.code], true)).join('')}
      ${L.unknown.length ? grp('', 'Bu gün için bilgi yok', L.unknown, false) : ''}
    </section>`;
  };

  return `
  <div class="card stack">
    <div class="datebar">
      <button class="iconbtn" aria-label="Önceki gün" data-act="shift-date" data-n="-1">${ICON_LEFT}</button>
      <div class="dtitle"><h2>${fmtLong(d)}</h2><span>${dayName(d)}${d === t ? ' · bugün' : ''}</span></div>
      <button class="iconbtn" aria-label="Sonraki gün" data-act="shift-date" data-n="1">${ICON_RIGHT}</button>
    </div>
    <div class="row">
      <div class="chips">${chips}</div>
      <input type="date" id="date-pick" value="${d}" aria-label="Tarih seç">
      <span style="flex:1"></span>
      <button class="btn primary" data-act="share" data-g="all">${ICON_SHARE}Tümünü paylaş</button>
    </div>
    ${outOfRange ? `<div class="note">Bu tarih yüklenen listelerin dışında (${fmtShort(range.min)} – ${fmtShort(range.max)}). Yeni dönemin listesini “Liste Yükle”den ekleyin.</div>` : ''}
    <div class="summary">
      <div class="sumtile"><b>${working}</b><span>Çalışan</span></div>
      <div class="sumtile"><b style="color:var(--off)">${tot('OFF')}</b><span>OFF</span></div>
      <div class="sumtile"><b>${tot('R') + tot('YI') + tot('MI')}</b><span>Rapor / izin</span></div>
    </div>
  </div>
  ${hasAny ? `<div class="shifts">${['1', '2', '3'].map(shiftCard).join('')}</div>` : `<div class="card stack"><h2>Henüz liste yok</h2><p class="muted">Şirketin gönderdiği vardiya listesi görselini yükleyin; isimler ve günler otomatik okunur, kırmızı hücreler OFF sayılır.</p><div><button class="btn primary" data-act="goto" data-view="yukle">${ICON_UPLOAD}Liste yükle</button></div></div>`}`;
}

function shareText(date, which) {
  const lists = dayLists(date);
  const head = `${store.settings.company ? store.settings.company + ' · ' : ''}${fmtShort(date)} ${dayName(date)}`;
  const block = (g) => {
    const L = lists[g]; const lines = [`*${g}. VARDİYA*${store.settings.hours[g] ? ` (${store.settings.hours[g]})` : ''}`];
    lines.push(`Çalışanlar (${L.working.length}):`);
    L.working.forEach((p, i) => lines.push(`${i + 1}. ${p.name}`));
    if (!L.working.length) lines.push('-');
    for (const a of ABSENT) if (L.absent[a.code].length) lines.push(`${a.title} (${L.absent[a.code].length}): ${L.absent[a.code].map((p) => p.name).join(', ')}`);
    return lines.join('\n');
  };
  const groups = which === 'all' ? ['1', '2', '3'] : [which];
  return [head, ...groups.map(block)].join('\n\n');
}

// ---------- Çizelge ----------
function viewGrid() {
  const range = dataRange();
  if (!range.min) return `<div class="card stack"><h2>Çizelge boş</h2><p class="muted">Önce bir vardiya listesi yükleyin.</p><div><button class="btn primary" data-act="goto" data-view="yukle">${ICON_UPLOAD}Liste yükle</button></div></div>`;
  if (!ui.gridStart) {
    // Seçili günü içeren 14 günlük pencere
    let s = range.min; while (addDays(s, 14) <= ui.date && addDays(s, 14) <= range.max) s = addDays(s, 14);
    ui.gridStart = s;
  }
  const days = Array.from({ length: 14 }, (_, i) => addDays(ui.gridStart, i));
  const t = todayIso();
  let people = allPeople().sort((a, b) => (a.group || '9').localeCompare(b.group || '9') || cmpName(a, b));
  if (ui.gridGroup !== 'all') people = people.filter((p) => p.group === ui.gridGroup);
  const head = days.map((d) => { const dt = parseIso(d); const we = dt.getDay() === 0 || dt.getDay() === 6; return `<th class="${d === t ? 'today' : ''} ${we ? 'we' : ''}">${pad(dt.getDate())}<small>${DAY_SHORT[dt.getDay()]}</small></th>`; }).join('');
  const rows = people.map((p) => `<tr><td class="name"><button data-act="person" data-key="${esc(p.key)}">${esc(p.name)}</button>${p.group ? `<span class="gtag k-${p.group}">${p.group}</span>` : ''}</td>${days.map((d) => { const c = p.days[d] || ''; return `<td><button class="code k-${c}" data-act="cell" data-key="${esc(p.key)}" data-date="${d}" aria-label="${esc(p.name)} ${fmtShort(d)}: ${CODES[c] ? CODES[c].label : c}">${CODES[c] ? CODES[c].short : '?'}</button></td>`; }).join('')}</tr>`).join('');
  const filt = [['all', 'Tümü'], ['1', '1. Vardiya'], ['2', '2. Vardiya'], ['3', '3. Vardiya']].map(([v, l]) => `<button class="chip" data-act="grid-group" data-g="${v}" aria-pressed="${ui.gridGroup === v}">${l}</button>`).join('');
  return `<div class="card stack">
    <div class="datebar">
      <button class="iconbtn" aria-label="Önceki hafta" data-act="grid-move" data-n="-7">${ICON_LEFT}</button>
      <div class="dtitle"><h2>${fmtShort(days[0])} – ${fmtShort(days[13])}</h2><span>${people.length} kişi · hücreye dokunarak güncelleyin</span></div>
      <button class="iconbtn" aria-label="Sonraki hafta" data-act="grid-move" data-n="7">${ICON_RIGHT}</button>
    </div>
    <div class="row"><div class="chips">${filt}</div><span style="flex:1"></span><button class="btn" data-act="add-person">${ICON_PLUS}Kişi ekle</button></div>
    <div class="legend">${CODE_ORDER.filter((c) => c).map((c) => `<span><span class="dot k-${c}"></span>${CODES[c].short} = ${CODES[c].label}</span>`).join('')}</div>
  </div>
  <div class="tablewrap"><table class="grid"><thead><tr><th class="name">Ad Soyad</th>${head}</tr></thead><tbody>${rows || `<tr><td class="name">Kimse yok</td></tr>`}</tbody></table></div>`;
}

// ---------- Yükleme / inceleme ----------
function viewUpload() {
  if (ui.busy) return `<div class="card stack"><h2>Liste okunuyor…</h2><p class="muted">${esc(ui.busy.text)}</p><div class="progress"><i style="width:${Math.round(ui.busy.pct * 100)}%"></i></div><p class="small muted">İlk okumada metin tanıma modeli yüklenir; birkaç saniye sürebilir.</p></div>`;
  if (ui.review) return viewReview();
  const ups = store.uploads.slice().reverse();
  return `<div class="card stack">
    <div><div class="eyebrow">Her 2 haftada bir</div><h2 style="font-size:24px">Vardiya listesi yükle</h2></div>
    <label class="drop" id="drop" for="file-in">
      ${ICON_IMAGE}
      <b>Liste görselini seçin veya buraya sürükleyin</b>
      <span class="small muted">JPG / PNG ekran görüntüsü veya fotoğraf. Birden fazla seçebilirsiniz (1., 2., 3. vardiya listeleri).</span>
      <span class="btn primary">${ICON_UPLOAD}Dosyadan seç</span>
    </label>
    <input type="file" id="file-in" accept="image/*" multiple hidden>
    <div class="note">Program tablodaki çizgileri bulur, her satırdan <b>ad soyad</b>ı okur, <b>kırmızı hücreleri OFF</b> sayar; hücrelerdeki <b>R</b> (rapor), <b>Yİ</b> (yıllık izin) ve 1/2/3 yazılarını tanır. Kaydetmeden önce her şeyi kontrol edip düzeltebilirsiniz.</div>
    <div class="row"><span class="small muted">Denemek için örnek görseller:</span>
      <button class="btn" data-act="sample" data-n="1">1. vardiya örneği</button>
      <button class="btn" data-act="sample" data-n="2">2. vardiya örneği</button>
      <button class="btn" data-act="sample" data-n="3">3. vardiya örneği</button></div>
  </div>
  <div class="card stack"><h3 style="font-size:19px">Yüklenen listeler</h3>
    ${ups.length ? `<ul class="uploads">${ups.map((u) => `<li><span class="gtag k-${u.group || ''}" style="margin:0">${u.group ? u.group + '. vardiya' : 'Karışık'}</span><span>${fmtShort(u.start)} – ${fmtShort(addDays(u.start, u.days - 1))}</span><span class="muted small">${u.count} kişi · ${esc(u.file || '')}</span></li>`).join('')}</ul>` : `<p class="muted small">Henüz liste yüklenmedi.</p>`}
  </div>`;
}

function viewReview() {
  const R = ui.review;
  const days = Array.from({ length: R.cols.length }, (_, i) => addDays(R.start, i));
  const head = days.map((d) => { const dt = parseIso(d); return `<th>${pad(dt.getDate())}<small>${DAY_SHORT[dt.getDay()]}</small></th>`; }).join('');
  const rows = R.rows.map((r, ri) => `<tr class="${r.skip ? 'skip' : ''}">
    <td><input type="checkbox" data-act="rv-skip" data-r="${ri}" ${r.skip ? '' : 'checked'} aria-label="Bu satırı al"></td>
    <td class="name"><input type="text" id="rv-name-${ri}" data-act="rv-name" data-r="${ri}" value="${esc(r.name)}" aria-label="Ad soyad"></td>
    ${r.cells.map((c, ci) => `<td><button class="code k-${CODES[c.code] ? c.code : 'Q'}" data-act="rv-cell" data-r="${ri}" data-c="${ci}" title="${c.raw ? 'Okunan: ' + esc(c.raw) : ''}${c.fill && c.fill !== 'white' ? ' Renk: ' + (COLOR_NAMES[c.fill] || c.fill) : ''}">${CODES[c.code] ? CODES[c.code].short : '?'}</button></td>`).join('')}</tr>`).join('');
  const warn = R.warnings.map((w) => `<div class="note">${esc(w)}</div>`).join('');
  return `<div class="card stack">
    <div class="row"><div style="flex:1;min-width:0"><div class="eyebrow">Kontrol et ve düzelt</div><h2 style="font-size:24px">${esc(R.file)}</h2></div>
      <button class="btn" data-act="rv-cancel">Vazgeç</button><button class="btn primary" data-act="rv-save">${ICON_CHECK}Kaydet</button></div>
    ${warn}
    <div class="review-top">
      <div class="preview"><canvas id="rv-canvas"></canvas></div>
      <div class="stack">
        <div class="settings-grid">
          <label class="field">Bu liste hangi vardiya?
            <select id="rv-group">${[['1', '1. Vardiya'], ['2', '2. Vardiya'], ['3', '3. Vardiya'], ['', 'Karışık (hücrelerde 1/2/3 yazıyor)']].map(([v, l]) => `<option value="${v}" ${R.group === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <label class="field">İlk sütunun tarihi<input type="date" id="rv-start" value="${R.start}"></label>
        </div>
        <p class="small muted" style="margin:0">${R.rows.filter((r) => !r.skip).length} kişi, ${R.cols.length} gün bulundu. Hücreye dokunarak değiştirin. Yazısız beyaz hücreler seçilen vardiya sayılır. “?” işaretli hücreler okunamadı.</p>
        <div class="row"><button class="btn" data-act="rv-add-row">${ICON_PLUS}Satır ekle</button><button class="btn" data-act="rv-fill">Boşları ${R.group ? R.group + '. vardiya' : 'vardiya'} yap</button></div>
      </div>
    </div>
  </div>
  <div class="tablewrap"><table class="grid"><thead><tr><th></th><th class="name">Ad Soyad</th>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

// ---------- Ayarlar ----------
function viewSettings() {
  const S = store.settings;
  return `<div class="card stack">
    <h2 style="font-size:22px">Genel</h2>
    <div class="settings-grid">
      <label class="field">Şirket / bölüm adı (paylaşımda görünür)<input type="text" id="set-company" value="${esc(S.company)}" placeholder="Örn. Üretim Bölümü"></label>
      ${['1', '2', '3'].map((g) => `<label class="field">${g}. vardiya saatleri<input type="text" id="set-h${g}" value="${esc(S.hours[g])}"></label>`).join('')}
    </div>
  </div>
  <div class="card stack">
    <h2 style="font-size:22px">Hücre renkleri</h2>
    <p class="small muted" style="margin:0">Listede renkli hücreler ne anlama geliyor? Kırmızı varsayılan olarak OFF. Şirketiniz izinleri başka renkle gösteriyorsa buradan eşleştirin.</p>
    <div class="settings-grid">${Object.keys(COLOR_NAMES).map((c) => `<label class="field"><span class="row" style="gap:6px"><span class="dot" style="background:${SWATCH[c]}"></span>${COLOR_NAMES[c]} hücre</span>
      <select id="set-c-${c}">${[['', 'Dikkate alma'], ['OFF', 'OFF'], ['R', 'Raporlu'], ['YI', 'Yıllık İzin'], ['MI', 'Diğer İzin']].map(([v, l]) => `<option value="${v}" ${S.colors[c] === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`).join('')}</div>
  </div>
  <div class="card stack">
    <h2 style="font-size:22px">Veri</h2>
    <p class="small muted" style="margin:0">Veriler yalnızca bu cihazda saklanır. Başka telefona aktarmak için yedeği kopyalayıp diğer cihazda “Yedekten yükle”ye yapıştırın.</p>
    <div class="row"><button class="btn" data-act="backup">Yedeği kopyala</button><button class="btn" data-act="restore-open">Yedekten yükle</button><button class="btn" data-act="load-demo">Örnek veriyi yükle</button><button class="btn danger" data-act="wipe">Tüm verileri sil</button></div>
  </div>`;
}

const SWATCH = { red: '#e02828', orange: '#f08a1c', yellow: '#f2cf1d', green: '#2fa84f', blue: '#2f7de1', purple: '#8e44c9', gray: '#9aa3ad' };

// ---------- Olaylar ----------
function bindView() {
  $app.querySelectorAll('[data-act]').forEach((el) => {
    const act = el.dataset.act;
    if (el.tagName === 'INPUT') {
      if (act === 'rv-name') el.addEventListener('input', () => { ui.review.rows[+el.dataset.r].name = el.value; });
      if (act === 'rv-skip') el.addEventListener('change', () => { ui.review.rows[+el.dataset.r].skip = !el.checked; el.closest('tr').classList.toggle('skip', !el.checked); });
      return;
    }
    el.addEventListener('click', (e) => { e.preventDefault(); actions[act] && actions[act](el); });
  });
  const dp = document.getElementById('date-pick');
  if (dp) dp.addEventListener('change', () => { if (dp.value) { ui.date = dp.value; ui.gridStart = null; render(); } });
  const fi = document.getElementById('file-in');
  if (fi) fi.addEventListener('change', () => { if (fi.files.length) handleFiles([...fi.files]); });
  const drop = document.getElementById('drop');
  if (drop) {
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); const f = [...e.dataTransfer.files].filter((x) => x.type.startsWith('image/')); if (f.length) handleFiles(f); });
  }
  if (ui.view === 'yukle' && ui.review) {
    const cv = document.getElementById('rv-canvas'); const src = ui.review.preview;
    cv.width = src.width; cv.height = src.height; cv.getContext('2d').drawImage(src, 0, 0);
    document.getElementById('rv-group').addEventListener('change', (e) => { ui.review.group = e.target.value; render(); });
    document.getElementById('rv-start').addEventListener('change', (e) => { if (e.target.value) { ui.review.start = e.target.value; render(); } });
  }
  if (ui.view === 'ayarlar') {
    const S = store.settings;
    const bind = (id, fn) => { const el = document.getElementById(id); el.addEventListener('change', () => { fn(el.value); save(); toast('Kaydedildi'); }); };
    bind('set-company', (v) => { S.company = v.trim(); document.getElementById('brand-sub').textContent = S.company || '1 · 2 · 3 vardiya, OFF ve izin takibi'; });
    ['1', '2', '3'].forEach((g) => bind('set-h' + g, (v) => { S.hours[g] = v.trim(); }));
    Object.keys(COLOR_NAMES).forEach((c) => bind('set-c-' + c, (v) => { S.colors[c] = v; }));
  }
}

const actions = {
  'goto': (el) => go(el.dataset.view),
  'clear-demo': () => { store = defaultStore(); save(); render(); toast('Örnek veri temizlendi'); },
  'set-date': (el) => { ui.date = el.dataset.date; ui.gridStart = null; render(); },
  'shift-date': (el) => { ui.date = addDays(ui.date, +el.dataset.n); ui.gridStart = null; render(); },
  'toggle-grp': (el) => { const id = el.dataset.id; const grp = el.closest('.grp'); const c = !grp.classList.contains('collapsed'); grp.classList.toggle('collapsed', c); el.setAttribute('aria-expanded', String(!c)); ui.collapsed[id] = c; },
  'share': (el) => doShare(shareText(ui.date, el.dataset.g), el.dataset.g === 'all' ? 'Günün vardiya listesi' : `${el.dataset.g}. vardiya listesi`),
  'grid-group': (el) => { ui.gridGroup = el.dataset.g; render(); },
  'grid-move': (el) => { ui.gridStart = addDays(ui.gridStart, +el.dataset.n); render(); },
  'cell': (el) => pickCode(store.people[el.dataset.key].days[el.dataset.date] || '', `${store.people[el.dataset.key].name} · ${fmtShort(el.dataset.date)} ${dayName(el.dataset.date)}`, (code) => {
    const p = store.people[el.dataset.key]; if (code) p.days[el.dataset.date] = code; else delete p.days[el.dataset.date];
    store.demo = false; save(); render();
  }),
  'person': (el) => personSheet(el.dataset.key),
  'add-person': () => personSheet(null),
  'sample': async (el) => {
    const n = el.dataset.n;
    try { const blob = await (await fetch(`samples/vardiya-${n}.png`)).blob(); handleFiles([new File([blob], `vardiya-${n}.png`, { type: 'image/png' })]); }
    catch (e) { toast('Örnek görsel açılamadı'); }
  },
  'rv-cell': (el) => { const r = +el.dataset.r, c = +el.dataset.c; const cell = ui.review.rows[r].cells[c];
    pickCode(cell.code, `${ui.review.rows[r].name || 'Satır ' + (r + 1)} · ${fmtShort(addDays(ui.review.start, c))}${cell.raw ? ' · okunan: “' + cell.raw + '”' : ''}`, (code) => { cell.code = code; render(); }); },
  'rv-add-row': () => { ui.review.rows.push({ name: '', skip: false, cells: ui.review.cols.map(() => ({ code: ui.review.group || '', raw: '' })) }); render(); },
  'rv-fill': () => { const g = ui.review.group; if (!g) { toast('Önce listenin vardiyasını seçin'); return; } ui.review.rows.forEach((r) => r.cells.forEach((c) => { if (!c.code || !CODES[c.code]) c.code = g; })); render(); },
  'rv-cancel': () => { ui.review = null; nextQueued(); },
  'rv-save': () => saveReview(),
  'backup': async () => { const txt = JSON.stringify(store); try { await navigator.clipboard.writeText(txt); toast('Yedek panoya kopyalandı'); } catch (e) { showText('Yedek', 'Aşağıdaki metnin tamamını seçip kopyalayın:', txt); } },
  'restore-open': () => restoreSheet(),
  'load-demo': () => confirmSheet('Örnek veri yüklensin mi?', 'Mevcut tüm vardiya verileri silinir ve yerine örnek veri gelir.', 'Örnek veriyi yükle', () => { store = makeDemo(); save(); render(); }),
  'wipe': () => confirmSheet('Tüm veriler silinsin mi?', 'Yüklenen bütün listeler ve kişiler bu cihazdan silinir. Bu işlem geri alınamaz.', 'Hepsini sil', () => { store = defaultStore(); save(); render(); toast('Tüm veriler silindi'); }),
};

// ---------- Paylaşım ----------
async function doShare(text, title) {
  // APK (Capacitor) içinde yerel paylaşım menüsü
  const cap = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Share;
  if (cap) { try { await cap.share({ title, text, dialogTitle: title }); return; } catch (e) { /* menü kapatıldı */ return; } }
  if (navigator.share) { try { await navigator.share({ title, text }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  showText(title, 'Metni kopyalayıp WhatsApp, SMS veya e-postaya yapıştırabilirsiniz.', text, true);
}

// ---------- Alt sayfalar ----------
function sheet(html, onBind) {
  $overlay.innerHTML = `<div class="sheet-bg" data-close="1"><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`;
  const bg = $overlay.firstElementChild;
  bg.addEventListener('click', (e) => { if (e.target.dataset.close) closeSheet(); });
  bg.querySelectorAll('[data-x]').forEach((b) => b.addEventListener('click', closeSheet));
  onBind && onBind(bg);
  const f = bg.querySelector('button, input, select'); f && f.focus();
}
function closeSheet() { $overlay.innerHTML = ''; }
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $overlay.innerHTML) closeSheet(); });

function pickCode(current, title, cb) {
  sheet(`<h3>${esc(title)}</h3><div class="codegrid">${CODE_ORDER.map((c) => `<button class="k-${c}" data-code="${c}" aria-pressed="${c === current}">${CODES[c].short}<small>${CODES[c].label.replace(' (Hafta tatili)', '')}</small></button>`).join('')}</div><button class="btn" data-x="1">Kapat</button>`,
    (bg) => bg.querySelectorAll('[data-code]').forEach((b) => b.addEventListener('click', () => { closeSheet(); cb(b.dataset.code); })));
}

function personSheet(key) {
  const p = key ? store.people[key] : { name: '', group: '1', days: {} };
  sheet(`<h3>${key ? 'Kişiyi düzenle' : 'Kişi ekle'}</h3>
    <label class="field">Ad soyad<input type="text" id="ps-name" value="${esc(p.name)}"></label>
    <label class="field">Ekip / vardiya<select id="ps-group">${[['1', '1. Vardiya'], ['2', '2. Vardiya'], ['3', '3. Vardiya'], ['', 'Belirsiz']].map(([v, l]) => `<option value="${v}" ${p.group === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <div class="row"><button class="btn primary" id="ps-save">Kaydet</button><button class="btn" data-x="1">Vazgeç</button>${key ? '<span style="flex:1"></span><button class="btn danger" id="ps-del">Sil</button>' : ''}</div>`, (bg) => {
    bg.querySelector('#ps-save').addEventListener('click', () => {
      const name = bg.querySelector('#ps-name').value.trim(); const group = bg.querySelector('#ps-group').value;
      if (!name) { toast('Ad soyad yazın'); return; }
      const nk = nameKey(name);
      if (key && nk !== key) { store.people[nk] = { ...store.people[key], ...(store.people[nk] || {}), name, group, days: { ...store.people[key].days, ...((store.people[nk] || {}).days) } }; delete store.people[key]; }
      else store.people[nk] = { ...(store.people[nk] || p), name, group };
      store.demo = false; save(); closeSheet(); render();
    });
    const del = bg.querySelector('#ps-del');
    del && del.addEventListener('click', () => { if (del.dataset.sure) { delete store.people[key]; save(); closeSheet(); render(); toast('Silindi'); } else { del.dataset.sure = '1'; del.textContent = 'Silmeyi onayla'; } });
  });
}

function confirmSheet(title, body, okLabel, onOk) {
  sheet(`<h3>${esc(title)}</h3><p class="muted" style="margin:0">${esc(body)}</p><div class="row"><button class="btn danger" id="cf-ok">${esc(okLabel)}</button><button class="btn" data-x="1">Vazgeç</button></div>`,
    (bg) => bg.querySelector('#cf-ok').addEventListener('click', () => { closeSheet(); onOk(); }));
}

function showText(title, hint, text, wa) {
  sheet(`<h3>${esc(title)}</h3><p class="small muted" style="margin:0">${esc(hint)}</p><div class="share-box"><pre id="st-pre">${esc(text)}</pre>
    <div class="row"><button class="btn primary" id="st-copy">Kopyala</button>${wa ? `<a class="btn" href="https://wa.me/?text=${encodeURIComponent(text)}" target="_blank" rel="noopener">WhatsApp’ta aç</a>` : ''}<button class="btn" data-x="1">Kapat</button></div></div>`, (bg) => {
    bg.querySelector('#st-copy').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(text); toast('Kopyalandı'); }
      catch (e) { const r = document.createRange(); r.selectNodeContents(bg.querySelector('#st-pre')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast('Metin seçildi, kopyalayın'); }
    });
  });
}

function restoreSheet() {
  sheet(`<h3>Yedekten yükle</h3><p class="small muted" style="margin:0">Diğer cihazda “Yedeği kopyala” ile aldığınız metni yapıştırın. Mevcut verilerin yerine geçer.</p><textarea id="rs-text" aria-label="Yedek metni"></textarea><div class="row"><button class="btn primary" id="rs-ok">Yükle</button><button class="btn" data-x="1">Vazgeç</button></div>`, (bg) => {
    bg.querySelector('#rs-ok').addEventListener('click', () => {
      try { const s = JSON.parse(bg.querySelector('#rs-text').value); if (!s || typeof s.people !== 'object') throw 0; const d = defaultStore(); store = { ...d, ...s, settings: { ...d.settings, ...s.settings } }; save(); closeSheet(); render(); toast('Yedek yüklendi'); }
      catch (e) { toast('Bu metin geçerli bir yedek değil'); }
    });
  });
}

let toastT;
function toast(msg) {
  let el = document.querySelector('.toast'); if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = msg; clearTimeout(toastT); toastT = setTimeout(() => el.remove(), 2200);
}

// ---------- Kaydetme ----------
function saveReview() {
  const R = ui.review;
  const rows = R.rows.filter((r) => !r.skip && r.name.trim());
  if (!rows.length) { toast('Kaydedilecek kişi yok'); return; }
  if (store.demo) { store.people = {}; store.uploads = []; store.demo = false; }
  for (const r of rows) {
    const name = r.name.trim().replace(/\s+/g, ' '); const k = nameKey(name);
    const p = store.people[k] || { name, group: R.group, days: {} };
    p.name = name; if (R.group) p.group = R.group;
    r.cells.forEach((c, i) => { const d = addDays(R.start, i); let code = CODES[c.code] ? c.code : ''; if (!code && R.group && !c.raw) code = R.group; if (code) p.days[d] = code; else delete p.days[d]; });
    if (!R.group) { // karışık listede ekip = en çok çalışılan vardiya
      const cnt = { '1': 0, '2': 0, '3': 0 }; Object.values(p.days).forEach((c) => { if (cnt[c] != null) cnt[c]++; });
      const best = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0]; if (best[1]) p.group = best[0];
    }
    store.people[k] = p;
  }
  store.uploads.push({ id: uid(), at: new Date().toISOString(), group: R.group, start: R.start, days: R.cols.length, count: rows.length, file: R.file });
  save();
  ui.date = (todayIso() >= R.start && todayIso() <= addDays(R.start, R.cols.length - 1)) ? todayIso() : R.start;
  ui.gridStart = null; ui.review = null;
  toast(`${rows.length} kişi kaydedildi`);
  if (!nextQueued()) go('gunluk');
}

// ---------- Görsel analizi ----------
let queue = [];
async function handleFiles(files) { queue.push(...files); if (!ui.busy && !ui.review) nextQueued(); }
function nextQueued() {
  const f = queue.shift();
  if (!f) { render(); return false; }
  analyzeFile(f); return true;
}
function setBusy(text, pct) { ui.busy = { text, pct }; if (ui.view !== 'yukle') go('yukle'); else render(); }

async function analyzeFile(file) {
  setBusy('Görsel açılıyor', 0.02);
  try {
    const img = await loadImg(file);
    const res = await analyzeImage(img, (t, p) => setBusy(t, p));
    res.file = file.name || 'Liste';
    ui.review = res;
  } catch (e) {
    console.error(e);
    toast('Görsel okunamadı: ' + (e.message || e));
  }
  ui.busy = null; render();
}

function loadImg(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file); const im = new Image();
    im.onload = () => res(im); im.onerror = () => rej(new Error('Dosya bir görsel değil'));
    im.src = url;
  });
}

// Renk yardımcıları
function hsv(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
  return [h, mx ? d / mx : 0, mx / 255];
}
function hueName(h) { if (h < 15 || h >= 340) return 'red'; if (h < 40) return 'orange'; if (h < 70) return 'yellow'; if (h < 170) return 'green'; if (h < 250) return 'blue'; return 'purple'; }

// Tablo çizgilerini bul: koşu uzunluğu (küçük boşluklara toleranslı) eşiği geçen satır/sütun bantları
function findBands(mask, w, h, horizontal, minRun, lo, hi, maxThick) {
  const N = horizontal ? h : w; const hits = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    let best = 0, run = 0, gap = 0;
    for (let j = lo; j < hi; j++) {
      const on = horizontal ? mask[i * w + j] : mask[j * w + i];
      if (on) { run += gap + 1; gap = 0; if (run > best) best = run; }
      else if (run) { if (++gap > 5) { run = 0; gap = 0; } }
    }
    hits[i] = best >= minRun ? 1 : 0;
  }
  const bands = [];
  for (let i = 0; i < N; i++) if (hits[i]) { let j = i; while (j + 1 < N && hits[j + 1]) j++; if (j - i + 1 <= maxThick) bands.push({ a: i, b: j, c: (i + j) / 2 }); i = j; }
  // birbirine çok yakın bantları birleştir
  const out = [];
  for (const b of bands) { const last = out[out.length - 1]; if (last && b.a - last.b <= 4) { last.b = b.b; last.c = (last.a + last.b) / 2; } else out.push({ ...b }); }
  return out;
}

function detectGrid(px, w, h) {
  // Her pikselin en parlak kanalı: saf kırmızı dolgu (255,0,0) parlak sayılır, koyu çizgi koyu kalır
  const n = w * h; const v = new Uint8Array(n);
  for (let i = 0, p = 0; i < n; i++, p += 4) v[i] = Math.max(px[p], px[p + 1], px[p + 2]);
  const abs = (t) => { const m = new Uint8Array(n); for (let i = 0; i < n; i++) m[i] = v[i] < t ? 1 : 0; return m; };
  // ince/soluk çizgiler için: iki yanındaki (2–5 px) en parlak pikselden belirgin koyu olan pikseller
  const ridge = (step) => {
    const m = new Uint8Array(n); const lo = 5 * step, hi = n - 5 * step;
    for (let i = lo; i < hi; i++) {
      const c = v[i]; if (c > 215) continue;
      let a = 0, b = 0;
      for (let k = 2; k <= 5; k++) { const x = v[i - k * step], y = v[i + k * step]; if (x > a) a = x; if (y > b) b = y; }
      m[i] = Math.min(a, b) - c >= 30 ? 1 : 0;
    }
    return m;
  };
  const a150 = abs(150);
  const variants = [[a150, a150], [abs(190), null], [ridge(w), ridge(1)]];
  const maxThick = Math.max(8, Math.round(Math.min(w, h) * 0.012));
  let best = null;
  for (const [mh, mvIn] of variants) {
    const mv = mvIn || mh;
    for (const frac of [0.5, 0.35, 0.22]) {
      const hs = findBands(mh, w, h, true, Math.round(w * frac), 0, w, maxThick);
      if (hs.length < 3) continue;
      const top = Math.floor(hs[0].a), bot = Math.ceil(hs[hs.length - 1].b);
      const vs = findBands(mv, w, h, false, Math.round((bot - top) * 0.5), top, bot + 1, maxThick);
      if (vs.length >= 3) { if (!best || hs.length * vs.length > best.hs.length * best.vs.length) best = { hs, vs }; break; }
    }
  }
  return best;
}

function cellStats(px, w, x0, y0, x1, y1) {
  const ix = Math.max(2, Math.round((x1 - x0) * 0.12)), iy = Math.max(2, Math.round((y1 - y0) * 0.12));
  let tot = 0, ink = 0, red = 0, white = 0, gray = 0; const hue = {};
  for (let y = Math.round(y0 + iy); y < y1 - iy; y++) for (let x = Math.round(x0 + ix); x < x1 - ix; x++) {
    const p = (y * w + x) * 4, r = px[p], g = px[p + 1], b = px[p + 2]; tot++;
    const [hh, s, v] = hsv(r, g, b);
    if (s > 0.3 && v > 0.35) { const n = hueName(hh); hue[n] = (hue[n] || 0) + 1; if (n === 'red') red++; }
    else if (v < 0.5) ink++;
    else if (v > 0.82) white++;
    else gray++;
  }
  tot = tot || 1;
  let fill = 'white', fillFrac = white / tot;
  for (const [n, c] of Object.entries(hue)) if (c / tot > 0.3 && c / tot > fillFrac * 0.6) { fill = n; fillFrac = c / tot; }
  if (fill === 'white' && gray / tot > 0.5) fill = 'gray';
  const colored = Object.values(hue).reduce((a, b) => a + b, 0);
  // kırmızı yazı (beyaz zemin üzerinde)
  const redText = fill === 'white' && red / tot > 0.015 && red > ink;
  return { fill, inkFrac: ink / tot, redText, coloredFrac: colored / tot };
}

let workerP = null;
function getWorker(onProgress) {
  if (!window.Tesseract) return Promise.reject(new Error('Metin tanıma yüklenemedi'));
  if (!workerP) {
    const abs = (p) => new URL(p, location.href).href;
    workerP = fetch('vendor/lang/tur.b64.txt').then((r) => { if (!r.ok) throw new Error('Türkçe dil modeli bulunamadı'); return r.text(); }).then((b64) => {
      const bin = atob(b64.trim()); const data = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);
      return Tesseract.createWorker([{ code: 'tur', data }], 1, {
      workerPath: abs('vendor/worker.min.js'), corePath: abs('vendor/core'),
      cacheMethod: 'none', errorHandler: (e) => console.warn('OCR', e),
      logger: (m) => { if (onProgress && m.status && /load|initializ/i.test(m.status)) onProgress('Metin tanıma modeli yükleniyor', 0.05 + 0.1 * (m.progress || 0)); },
      });
    }).catch((e) => { workerP = null; throw e; });
  }
  return workerP;
}

function crop(src, x0, y0, x1, y1, scale) {
  const pad = 12; const w = Math.max(1, Math.round(x1 - x0)), h = Math.max(1, Math.round(y1 - y0));
  const c = document.createElement('canvas'); c.width = Math.round(w * scale) + pad * 2; c.height = Math.round(h * scale) + pad * 2;
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.imageSmoothingEnabled = true; ctx.drawImage(src, x0, y0, w, h, pad, pad, w * scale, h * scale);
  return { c, pad, scale };
}

async function ocr(worker, canvas, params) {
  await worker.setParameters(params);
  const { data } = await worker.recognize(canvas);
  return data;
}

// Bir satırın gün hücrelerini tek seferde oku; karakterleri x konumuna göre sütunlara dağıt.
// (Tek karakterli hücreleri ayrı ayrı okumak güvenilmez; satır bağlamında çok daha iyi tanınıyor.)
async function readStrip(worker, clean, y0, y1, cols, psm) {
  const x0 = cols[0][0], x1 = cols[cols.length - 1][1];
  const hgt = y1 - y0; const s = hgt < 40 ? 48 / hgt : 1;
  const { c, pad, scale } = crop(clean, x0, y0, x1, y1, s);
  const d = await ocr(worker, c, { tessedit_pageseg_mode: psm, tessedit_char_whitelist: '' });
  const out = cols.map(() => '');
  const X = (v) => x0 + (v - pad) / scale;
  const colOf = (cx) => cols.findIndex(([a, b]) => cx >= a - 3 && cx <= b + 3);
  for (const word of d.words || []) {
    // kelime tek sütuna sığıyorsa bütün olarak ata (ör. "Yİ"), değilse harf harf dağıt (ör. "1 1" birleşmişse)
    const a = colOf(X(word.bbox.x0 + 2)), b = colOf(X(word.bbox.x1 - 2));
    if (a >= 0 && a === b) { out[a] += word.text; continue; }
    for (const sym of word.symbols || []) { const k = colOf(X((sym.bbox.x0 + sym.bbox.x1) / 2)); if (k >= 0) out[k] += sym.text; }
  }
  // komşu hücreye taşan harfleri geri al (ör. "Y" | "İ1"  ->  "Yİ" | "1")
  for (let k = 1; k < out.length; k++) {
    if (parseCode(out[k]) !== null) continue;
    const m = out[k].match(/^([^\d]+)(.*)$/);
    if (m && parseCode(out[k - 1] + m[1]) && (m[2] === '' || parseCode(m[2]) !== null)) { out[k - 1] += m[1]; out[k] = m[2]; }
  }
  return out;
}

async function readRowCells(worker, clean, [y0, y1], cols, stats) {
  const out = await readStrip(worker, clean, y0, y1, cols, '7');
  // yazısı olup satır okumasında kaçan hücreleri tek tek dene
  for (let k = 0; k < cols.length; k++) {
    const st = stats[k];
    if (out[k] || st.inkFrac < 0.012 || (st.fill !== 'white' && st.fill !== 'gray')) continue;
    const hgt = y1 - y0; const s = hgt < 40 ? 48 / hgt : 1.5;
    const { c } = crop(clean, cols[k][0], y0, cols[k][1], y1, s);
    out[k] = (await ocr(worker, c, { tessedit_pageseg_mode: '7', tessedit_char_whitelist: '' })).text.trim();
  }
  return out;
}

function parseCode(t) {
  const s = t.replace(/[l|]/g, '1').toLocaleUpperCase('tr').replace(/[^A-ZÇĞİÖŞÜ0-9]/g, '');
  if (!s) return '';
  if (/^(OFF|0FF|OF|FF|0F|O)$/.test(s)) return 'OFF';
  if (/^(Yİ|YI|Y1|YL|Y)$/.test(s)) return 'YI';
  if (/^(R|RP|RAP|RAPOR|RS|RE|RA)$/.test(s)) return 'R';
  if (/^(İ|I|İZ|IZ|İZİN|IZIN|Mİ|MI|Üİ|UI|Üİ)$/.test(s)) return 'MI';
  if (/^[123]$/.test(s)) return s;
  if (/^1+$/.test(s)) return '1';
  return null; // okunamadı
}

async function analyzeImage(img, progress) {
  // 1) Görseli işlenebilir boyuta getir
  const W0 = img.naturalWidth, H0 = img.naturalHeight;
  const scale = W0 < 1400 ? Math.min(2.5, 1400 / W0) : Math.min(1, 2400 / W0);
  const w = Math.round(W0 * scale), h = Math.round(H0 * scale);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;
  const preview = document.createElement('canvas'); const ps = Math.min(1, 900 / w); preview.width = Math.round(w * ps); preview.height = Math.round(h * ps);
  preview.getContext('2d').drawImage(cv, 0, 0, preview.width, preview.height);

  progress('Tablo çizgileri aranıyor', 0.04);
  await new Promise((r) => setTimeout(r, 30));
  const warnings = [];
  const grid = detectGrid(px, w, h);
  if (!grid) throw new Error('Tablo çizgileri bulunamadı. Listeyi düz ve tamamı görünecek şekilde çekin ya da ekran görüntüsü kullanın.');
  const rowsB = []; for (let i = 0; i + 1 < grid.hs.length; i++) { const a = grid.hs[i].b + 1, b = grid.hs[i + 1].a - 1; if (b - a >= 12) rowsB.push([a, b]); }
  const colsB = []; for (let i = 0; i + 1 < grid.vs.length; i++) { const a = grid.vs[i].b + 1, b = grid.vs[i + 1].a - 1; if (b - a >= 12) colsB.push([a, b]); }
  if (colsB.length < 3 || rowsB.length < 2) throw new Error('Tablo yapısı anlaşılamadı (sütun/satır bulunamadı).');

  // 2) İsim sütunu = ilk sütunlardan en genişi; gün sütunları = sağındaki benzer genişlikteki sütunlar
  const widths = colsB.map(([a, b]) => b - a);
  let nameCol = 0; for (let i = 0; i < Math.min(4, colsB.length); i++) if (widths[i] > widths[nameCol]) nameCol = i;
  const right = colsB.map((c, i) => i).filter((i) => i > nameCol);
  const med = right.map((i) => widths[i]).sort((a, b) => a - b)[Math.floor(right.length / 2)] || 1;
  let dayCols = right.filter((i) => widths[i] >= med * 0.55 && widths[i] <= med * 1.8);
  const tableTop = grid.hs[0].a, tableLeft = grid.vs[0].a;

  // 3) Metin tanıma için temiz (siyah-beyaz, çizgisiz) kopya
  const clean = document.createElement('canvas'); clean.width = w; clean.height = h;
  const cctx = clean.getContext('2d'); const cd = cctx.createImageData(w, h);
  for (let i = 0, p = 0; i < w * h; i++, p += 4) {
    const r = px[p], g = px[p + 1], b = px[p + 2]; const lum = (r * 299 + g * 587 + b * 114) / 1000;
    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    const v = lum < 140 && sat < 90 ? 0 : 255; cd.data[p] = cd.data[p + 1] = cd.data[p + 2] = v; cd.data[p + 3] = 255;
  }
  cctx.putImageData(cd, 0, 0); cctx.fillStyle = '#fff';
  for (const b of grid.hs) cctx.fillRect(0, b.a - 2, w, b.b - b.a + 5);
  for (const b of grid.vs) cctx.fillRect(b.a - 2, 0, b.b - b.a + 5, h);

  // 4) Hücre renkleri
  const stats = rowsB.map(([y0, y1]) => dayCols.map((ci) => cellStats(px, w, colsB[ci][0], y0, colsB[ci][1], y1)));

  // 5) Metin tanıma (isimler, hücre yazıları, başlık)
  let worker = null;
  try {
    progress('Metin tanıma modeli yükleniyor', 0.06);
    // model başlatılamazsa takılıp kalmasın
    worker = await Promise.race([getWorker(progress), new Promise((_, rej) => setTimeout(() => rej(new Error('zaman aşımı')), 60000))]);
  }
  catch (e) { console.warn(e); warnings.push('Metin tanıma bu cihazda çalışmadı; isimleri elle yazmanız gerekiyor. Renkler (OFF) yine de okundu.'); }

  const names = [], texts = [];
  let title = '';
  if (worker) {
    if (tableTop > 20) {
      const { c } = crop(clean, 0, 0, w, tableTop, 1);
      try { title = (await ocr(worker, c, { tessedit_pageseg_mode: '6', tessedit_char_whitelist: '' })).text; } catch (e) { /* başlık isteğe bağlı */ }
    }
    for (let r = 0; r < rowsB.length; r++) {
      progress(`İsimler okunuyor (${r + 1}/${rowsB.length})`, 0.15 + 0.4 * (r / rowsB.length));
      const [y0, y1] = rowsB[r]; const [x0, x1] = colsB[nameCol];
      const hgt = y1 - y0; const s = hgt < 40 ? 48 / hgt : 1;
      const { c } = crop(clean, x0, y0, x1, y1, s);
      const d = await ocr(worker, c, { tessedit_pageseg_mode: '7', tessedit_char_whitelist: '' });
      names.push(d.text.replace(/[Ââ]/g, (c) => (c === 'Â' ? 'A' : 'a')).replace(/[Ûû]/g, (c) => (c === 'Û' ? 'U' : 'u')).replace(/[^A-Za-zÇĞİÖŞÜçğıöşüÂÎÛâîû .'-]/g, ' ').replace(/\s+/g, ' ').trim());
    }
    for (let r = 0; r < rowsB.length; r++) {
      progress(`Hücreler okunuyor (${r + 1}/${rowsB.length})`, 0.55 + 0.42 * (r / rowsB.length));
      texts.push(await readRowCells(worker, clean, rowsB[r], dayCols.map((ci) => colsB[ci]), stats[r]));
    }
  } else {
    rowsB.forEach(() => { names.push(''); texts.push(dayCols.map(() => '')); });
  }

  // 6) Başlık satırı / kişi satırları
  const headerWord = /^(ad|adı|soyad|soyadı|ad soyad|adı soyadı|isim|personel|sicil|no|sıra|tarih|gün|günler)$/i;
  const isHeader = (s) => !s || headerWord.test(s.trim()) || /(AD\s*SOYAD|ADI\s*SOYADI|PERSONEL|İSİM)/i.test(s);
  let firstPerson = 0;
  if (worker) { while (firstPerson < rowsB.length && (isHeader(names[firstPerson]) || names[firstPerson].replace(/[^A-Za-zÇĞİÖŞÜçğıöşü]/g, '').length < 3)) firstPerson++; if (firstPerson >= rowsB.length) firstPerson = 1; }
  else firstPerson = 1;
  // Başlıktaki gün numaraları
  const headerDays = [];
  if (worker && firstPerson > 0) {
    const [y0, y1] = rowsB[firstPerson - 1];
    const cols = dayCols.map((ci) => colsB[ci]);
    const txt = await readStrip(worker, clean, y0, y0 + (y1 - y0) * 0.6, cols, '7');
    txt.forEach((t) => { const n = parseInt(t.replace(/\D/g, '').slice(0, 2), 10); headerDays.push(n >= 1 && n <= 31 ? n : null); });
    // sondaki gün olmayan sütunları at (Toplam vb.)
    const found = headerDays.filter((n) => n).length;
    if (found >= dayCols.length * 0.6) while (dayCols.length && headerDays[headerDays.length - 1] == null) { dayCols.pop(); headerDays.pop(); stats.forEach((r) => r.pop()); texts.forEach((r) => r.pop()); }
  }

  // 7) Vardiya ve başlangıç tarihi tahmini
  let group = '';
  const tm = title.match(/([123])\s*[.\-]?\s*V[A-ZİI]{1,3}[İI]YA/i); if (tm) group = tm[1];
  const dates = [...title.matchAll(/(\d{1,2})\s*[./-]+\s*(\d{1,2})\s*[./-]+\s*(\d{4}|\d{2})/g)]
    .map((m) => { const y = m[3].length === 2 ? 2000 + +m[3] : +m[3]; return new Date(y, +m[2] - 1, +m[1]); })
    .filter((d) => !isNaN(d) && d.getFullYear() > 2000)
    .map((d) => { // yıl yanlış okunduysa bugüne en yakın yılı al
      const now = new Date(); let best = d;
      for (const y of [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]) { const c = new Date(y, d.getMonth(), d.getDate()); if (Math.abs(c - now) < Math.abs(best - now)) best = c; }
      return best;
    });
  let start = null;
  // Başlıktaki gün numaralarından oy çokluğu ile ilk sütunun ayın kaçı olduğunu bul (OCR hatalarına dayanıklı).
  // Ay dönümünde (30, 31, 1, 2) değer negatife düşer; JS Date bunu doğru tarihe çevirir.
  const votes = {};
  headerDays.forEach((n, k) => { if (n) votes[n - k] = (votes[n - k] || 0) + 1; });
  const vote = Object.entries(votes).sort((x, y) => y[1] - x[1])[0];
  if (vote && (vote[1] >= 2 || headerDays.filter((n) => n).length === 1)) {
    const s0 = +vote[0]; const ref = dates[0] || new Date();
    let bestD = null, bestDiff = Infinity;
    for (let m = -2; m <= 2; m++) { const d = new Date(ref.getFullYear(), ref.getMonth() + m, s0); const diff = Math.abs(d - ref); if (diff < bestDiff) { bestDiff = diff; bestD = d; } }
    start = iso(bestD);
  } else if (dates.length) start = iso(dates[0]);
  if (!start) { start = todayIso(); warnings.push('Liste tarihleri okunamadı. “İlk sütunun tarihi” alanını kontrol edin.'); }

  // Sondaki toplam/özet sütunlarını at (çoğunluğu 4+ veya çok basamaklı sayı)
  while (dayCols.length > 1) {
    const k = dayCols.length - 1; let numeric = 0, filled = 0;
    for (let r = firstPerson; r < rowsB.length; r++) { const t = (texts[r][k] || '').replace(/[^0-9A-Za-zİı]/g, ''); if (t) filled++; if (/^(\d{2,}|[04-9])$/.test(t)) numeric++; }
    if (filled && numeric / filled > 0.5) { dayCols.pop(); headerDays.pop(); stats.forEach((r) => r.pop()); texts.forEach((r) => r.pop()); } else break;
  }

  // 8) Hücre kodları
  const colorMap = store.settings.colors;
  const digitCount = { '1': 0, '2': 0, '3': 0 };
  const rows = [];
  for (let r = firstPerson; r < rowsB.length; r++) {
    const cells = dayCols.map((_, k) => {
      const st = stats[r][k]; const raw = texts[r][k] || '';
      let code = '';
      const mapped = colorMap[st.fill];
      if (st.fill !== 'white' && st.fill !== 'gray' && mapped) code = mapped;
      else if (st.redText && colorMap.red) code = colorMap.red;
      else if (raw) { const pc = parseCode(raw); code = pc == null ? 'Q' : pc; }
      else if (st.inkFrac >= 0.012 && worker) code = 'Q';
      if (digitCount[code] != null) digitCount[code]++;
      return { code, raw: code === 'Q' || raw ? raw : '', fill: st.fill };
    });
    const nm = names[r] || (worker ? '' : `Kişi ${r - firstPerson + 1}`);
    const empty = !nm && cells.every((c) => !c.code);
    if (empty) continue;
    rows.push({ name: nm, skip: !nm && !!worker, cells });
  }
  if (!group) { const best = Object.entries(digitCount).sort((a, b) => b[1] - a[1])[0]; const nonzero = Object.values(digitCount).filter((n) => n > 0).length; if (best[1] && nonzero === 1) group = best[0]; else if (!best[1]) group = '1'; }
  // Yazısız beyaz hücreler = listenin vardiyası (kaydederken de uygulanır)
  if (group) rows.forEach((r) => r.cells.forEach((c) => { if (!c.code) c.code = group; }));
  if (!rows.length) warnings.push('Hiç kişi satırı bulunamadı. “Satır ekle” ile elle ekleyebilirsiniz.');
  progress('Bitti', 1);
  return { start, group, cols: dayCols, rows, warnings, preview };
}

// ---------- İkonlar ----------
const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON_LEFT = svg('<path d="M15 18l-6-6 6-6"/>');
const ICON_RIGHT = svg('<path d="M9 18l6-6-6-6"/>');
const ICON_SHARE = svg('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>');
const ICON_UPLOAD = svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5M12 3v12"/>');
const ICON_IMAGE = svg('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>');
const ICON_PLUS = svg('<path d="M12 5v14M5 12h14"/>');
const ICON_CHECK = svg('<path d="M20 6L9 17l-5-5"/>');

fromHash();
