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
// İsim eşleştirme anahtarı: büyük/küçük harf ve Türkçe karakter farkları (ı/i, ş/s, ğ/g…) yok sayılır,
// böylece farklı görsellerde biraz farklı okunan aynı isim tek kişide birleşir.
const FOLD = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };
const nameKey = (s) => String(s).toLocaleLowerCase('tr').replace(/[çğıöşüâîû]/g, (c) => FOLD[c]).replace(/[^a-z]/g, '');
const uid = () => Math.random().toString(36).slice(2, 10);
const cmpName = (a, b) => a.name.localeCompare(b.name, 'tr');

// ---------- Veri ----------
function defaultAreas() {
  const all = ['1', '2', '3'];
  return [
    ['tomo-mr', 'Tomo-MR', all], ['rontgen-usg', 'Röntgen-USG', all], ['numune', 'Numune', all],
    ['kadin-dogum', 'Kadın Doğum', all], ['cocuk-acil', 'Çocuk Acil', all], ['yesil-alan', 'Yeşil Alan', all],
    ['sari-alan', 'Sarı Alan', all], ['yogun-bakim', 'Yoğun Bakım', all], ['kirmizi-alan', 'Kırmızı Alan', all],
    ['merkez-lab', 'Merkez Lab', ['2', '3']],
  ].map(([id, name, shifts]) => ({ id, name, shifts: [...shifts] }));
}
function defaultStore() {
  return {
    v: 1, keyV: 2, demo: false,
    people: {},           // key -> { name, group: '1'|'2'|'3'|'', days: { 'YYYY-MM-DD': code } }
    uploads: [],          // { id, at, group, start, days, count, file }
    areas: defaultAreas(), // görev alanları: { id, name, shifts: ['1','2','3'] }
    dayAreas: {},         // tek günlük alan değişiklikleri: { 'YYYY-MM-DD': { kişiKey: alanId } }
    settings: {
      company: '',
      hours: { '1': '08:00–16:00', '2': '16:00–24:00', '3': '00:00–08:00' },
      colors: { red: 'OFF', orange: '', yellow: '', green: '', blue: '', purple: '', gray: '' },
    },
  };
}
let store = load();
function normalize(raw) {
  const s = migrateKeys(raw); const d = defaultStore();
  return { ...d, ...s, areas: Array.isArray(s.areas) ? s.areas : d.areas, dayAreas: s.dayAreas || {}, settings: { ...d.settings, ...s.settings, hours: { ...d.settings.hours, ...(s.settings || {}).hours }, colors: { ...d.settings.colors, ...(s.settings || {}).colors } } };
}
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch (e) { /* depolama yoksa örnek veriyle devam */ }
  return makeDemo();
}
// Eski sürümde kişiler farklı anahtarla tutuluyordu: yeni anahtara taşı
function migrateKeys(s) {
  if (s.keyV === 2 || !s.people) return s;
  const people = {}; const map = {};
  for (const [k, p] of Object.entries(s.people)) { const nk = nameKey(p.name); map[k] = nk; people[nk] = people[nk] ? { ...people[nk], days: { ...people[nk].days, ...p.days } } : p; }
  const dayAreas = {};
  for (const [d, m] of Object.entries(s.dayAreas || {})) { dayAreas[d] = {}; for (const [k, a] of Object.entries(m)) dayAreas[d][map[k] || k] = a; }
  return { ...s, people, dayAreas, keyV: 2 };
}
// Kayıt: cihazda (localStorage — APK'da kalıcı) ve sayfa claude.ai'de açıldıysa kalıcı veritabanına.
// claude.ai görüntüleyicisinde tarayıcı belleği kalıcı değil; asıl kayıt veritabanıdır.
const CLIENT = uid();
let remote = null, remoteTimer = null;
function save() {
  store.savedAt = Date.now();
  // 4 aydan eski gün kayıtlarını at (veri sınırsız büyümesin)
  const cut = addDays(todayIso(), -120);
  for (const p of Object.values(store.people)) for (const d of Object.keys(p.days)) if (d < cut) delete p.days[d];
  for (const d of Object.keys(store.dayAreas)) if (d < cut) delete store.dayAreas[d];
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* yoksay */ }
  if (remote && !store.demo) { clearTimeout(remoteTimer); remoteTimer = setTimeout(pushRemote, 300); }
}
async function pushRemote() {
  try { await remote.set({ json: JSON.stringify(store), at: store.savedAt, by: CLIENT }); }
  catch (e) { toast('Kaydedilemedi: ' + (e && (e.message || e.code) || 'bağlantı hatası')); }
}
async function initRemote() {
  try {
    if (!window.claude || typeof window.claude.use !== 'function') return; // APK veya normal tarayıcı
    const db = await window.claude.use('db'); if (!db) return;
    const ref = db.doc('app/state');
    const apply = (snap) => {
      if (!snap.exists) return false;
      const d = snap.data();
      if (!d || typeof d.json !== 'string' || d.by === CLIENT || (store.savedAt && d.at <= store.savedAt)) return true;
      store = normalize(JSON.parse(d.json));
      try { localStorage.setItem(STORE_KEY, d.json); } catch (e) { /* yoksay */ }
      render(); return true;
    };
    const had = apply(await ref.get());
    remote = ref;
    if (!had && !store.demo) pushRemote(); // ilk kez: cihazdaki veriyi yükle
    ref.onSnapshot(apply, () => {});
  } catch (e) { console.warn('db', e); }
}

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
  // örnek alan atamaları
  const ids = s.areas.map((a) => a.id);
  Object.values(s.people).forEach((p, i) => { const a = s.areas[i % ids.length]; if (a.shifts.includes(p.group)) p.area = a.id; });
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
  areaShift: null,   // alan listesi için seçili vardiya
  areaShown: false,  // "Listeyi oluştur" basıldı mı
  areaMode: 'liste', // 'liste' | 'ata'
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
const VIEWS = ['gunluk', 'alanlar', 'cizelge', 'yukle', 'ayarlar'];
function go(view) {
  ui.view = VIEWS.includes(view) ? view : 'gunluk'; render(); window.scrollTo(0, 0);
  try { if (location.hash !== '#' + ui.view) location.hash = ui.view; } catch (e) { /* çerçeve izin vermezse yoksay */ }
}
function fromHash() { const h = location.hash.replace('#', ''); const v = VIEWS.includes(h) ? h : 'gunluk'; if (v !== ui.view || !$app.innerHTML) { ui.view = v; render(); } }
window.addEventListener('hashchange', fromHash);
document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => go(b.dataset.view)));

function render() {
  document.querySelectorAll('.tab').forEach((b) => b.setAttribute('aria-current', b.dataset.view === ui.view ? 'page' : 'false'));
  const sub = document.getElementById('brand-sub');
  sub.textContent = store.settings.company ? store.settings.company : '1 · 2 · 3 vardiya, OFF ve izin takibi';
  const banner = store.demo ? `<div class="banner"><p><b>Örnek veri gösteriliyor.</b> Kendi vardiya listenizin görselini “Liste Yükle” bölümünden ekleyin; örnek veri o zaman silinir.</p><button class="btn" data-act="clear-demo">Örnek veriyi temizle</button></div>` : '';
  const views = { gunluk: viewDaily, alanlar: viewAreas, cizelge: viewGrid, yukle: viewUpload, ayarlar: viewSettings };
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
        <button class="iconbtn" title="${g}. vardiya alan listesi" aria-label="${g}. vardiya alan listesi" data-act="daily-areas" data-g="${g}">${ICON_LIST}</button>
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
      <div class="dtitle"><h2>${fmtShort(d)}</h2><span>${d === t ? 'Bugün' : d === addDays(t, 1) ? 'Yarın' : d === addDays(t, -1) ? 'Dün' : '&nbsp;'}</span></div>
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
  const head = `${store.settings.company ? store.settings.company + ' · ' : ''}${fmtShort(date)}`;
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

// ---------- Alan listesi (görev dağılımı) ----------
function areaOf(p, date) { const o = (store.dayAreas[date] || {})[p.key]; return o !== undefined ? o : (p.area || ''); }
function renameDayAreas(oldK, newK) {
  for (const m of Object.values(store.dayAreas)) if (oldK in m) { if (newK) m[newK] = m[oldK]; delete m[oldK]; }
}
function shiftNow() {
  // ayarlardaki saatlere göre şu an hangi vardiya (ör. "08:00–16:00")
  const now = new Date(); const mins = now.getHours() * 60 + now.getMinutes();
  for (const g of ['1', '2', '3']) {
    const m = (store.settings.hours[g] || '').match(/(\d{1,2})[:.](\d{2})\D+(\d{1,2})[:.](\d{2})/); if (!m) continue;
    const a = +m[1] * 60 + +m[2]; let b = +m[3] * 60 + +m[4]; if (b <= a) b += 1440;
    if ((mins >= a && mins < b) || (mins + 1440 >= a && mins + 1440 < b)) return g;
  }
  return '1';
}
function areaList(date, g) {
  const L = dayLists(date)[g];
  const valid = store.areas.filter((a) => a.shifts.includes(g));
  const byArea = {}; valid.forEach((a) => { byArea[a.id] = []; });
  const unassigned = [];
  for (const p of L.working) { const a = areaOf(p, date); if (byArea[a]) byArea[a].push(p); else unassigned.push(p); }
  return { valid, byArea, unassigned, absent: L.absent };
}
function areaShareText(date, g) {
  const A = areaList(date, g); const h = store.settings.hours[g];
  const lines = [`${store.settings.company ? store.settings.company + ' · ' : ''}${fmtShort(date)}`, `*${g}. VARDİYA*${h ? ` (${h})` : ''}`, ''];
  for (const a of A.valid) lines.push(`*${a.name}:* ${A.byArea[a.id].map((p) => p.name).join(', ') || '-'}`);
  if (A.unassigned.length) lines.push(`*Atanmamış:* ${A.unassigned.map((p) => p.name).join(', ')}`);
  const abs = ABSENT.filter((x) => A.absent[x.code].length);
  if (abs.length) { lines.push(''); abs.forEach((x) => lines.push(`${x.title}: ${A.absent[x.code].map((p) => p.name).join(', ')}`)); }
  return lines.join('\n');
}
const shiftsLabel = (a) => a.shifts.length === 3 ? 'Tüm vardiyalar' : a.shifts.map((g) => g + '.').join(' ') + ' vardiya';

function viewAreas() {
  if (!ui.areaShift) ui.areaShift = shiftNow();
  const seg = `<div class="seg" role="tablist">${[['liste', 'Liste oluştur'], ['ata', 'Kişileri alanlara ata']].map(([v, l]) => `<button role="tab" data-act="area-mode" data-m="${v}" aria-selected="${ui.areaMode === v}">${l}</button>`).join('')}</div>`;
  if (ui.areaMode === 'ata') return seg + viewAreaAssign();
  const d = ui.date, t = todayIso(), g = ui.areaShift;
  const shiftChips = ['1', '2', '3'].map((x) => `<button class="chip k-${x} shiftchip" data-act="area-shift" data-g="${x}" aria-pressed="${x === g}">${x}. Vardiya<small>${esc(store.settings.hours[x] || '')}</small></button>`).join('');
  let result = '';
  if (ui.areaShown) {
    const A = areaList(d, g);
    const chip = (p) => `<button class="pchip" data-act="area-move" data-key="${esc(p.key)}">${esc(p.name)}</button>`;
    const total = A.unassigned.length + A.valid.reduce((n, a) => n + A.byArea[a.id].length, 0);
    const range = dataRange(); const hasDay = Object.values(store.people).some((p) => p.days[d]);
    if (!hasDay) {
      result = `<section class="card stack arealist"><h2 style="font-size:22px">${fmtShort(d)} için vardiya listesi yok</h2>
        <p class="muted" style="margin:0">${range.min ? `Yüklenen listeler ${fmtShort(range.min)} – ${fmtShort(range.max)} tarihlerini kapsıyor. O aralıktan bir tarih seçin ya da bu tarihin listesini yükleyin.` : 'Henüz vardiya listesi yüklenmedi. Önce “Liste Yükle”den görselleri ekleyin.'}</p>
        <div class="row">${range.min ? `<button class="btn primary" data-act="set-date" data-date="${todayIso() >= range.min && todayIso() <= range.max ? todayIso() : range.min}">${fmtShort(todayIso() >= range.min && todayIso() <= range.max ? todayIso() : range.min)} tarihine git</button>` : ''}<button class="btn" data-act="goto" data-view="yukle">${ICON_UPLOAD}Liste yükle</button></div></section>`;
    } else if (!total) {
      result = `<section class="card stack arealist"><h2 style="font-size:22px">${fmtShort(d)} · ${g}. vardiyada çalışan yok</h2><p class="muted" style="margin:0">Bu gün ${g}. vardiyada çalışan görünmüyor. Başka bir vardiya seçin.</p></section>`;
    } else
    result = `<section class="card stack arealist">
      <div class="row"><div style="flex:1;min-width:0"><div class="eyebrow">${fmtShort(d)} · ${total} çalışan</div><h2 style="font-size:24px">${g}. Vardiya alan listesi</h2></div>
        <button class="btn" data-act="area-copy">Kopyala</button><button class="btn primary" data-act="area-share">${ICON_SHARE}Paylaş</button></div>
      <div class="areas">${A.valid.map((a) => `<div class="arow ${A.byArea[a.id].length ? '' : 'none'}"><div class="aname">${esc(a.name)}<span>${A.byArea[a.id].length}</span></div><div class="pchips">${A.byArea[a.id].map(chip).join('') || '<span class="empty">Kimse yok</span>'}</div></div>`).join('')}
        ${A.unassigned.length ? `<div class="arow warn"><div class="aname">Atanmamış<span>${A.unassigned.length}</span></div><div class="pchips">${A.unassigned.map(chip).join('')}</div></div>` : ''}</div>
      <div class="absent">${ABSENT.filter((x) => A.absent[x.code].length).map((x) => `<div><span class="dot k-${x.code}"></span><b>${x.title} (${A.absent[x.code].length}):</b> ${A.absent[x.code].map((p) => esc(p.name)).join(', ')}</div>`).join('') || '<span class="small muted">Bu vardiyada OFF, rapor veya izinli yok.</span>'}</div>
      <p class="small muted" style="margin:0">Bir isme dokunarak o kişinin alanını bu gün için ya da kalıcı olarak değiştirebilirsiniz.</p>
    </section>`;
  }
  return seg + `<div class="card stack">
    <div class="datebar">
      <button class="iconbtn" aria-label="Önceki gün" data-act="shift-date" data-n="-1">${ICON_LEFT}</button>
      <div class="dtitle"><h2>${fmtShort(d)}</h2><span>${d === t ? 'Bugün' : d === addDays(t, 1) ? 'Yarın' : d === addDays(t, -1) ? 'Dün' : '&nbsp;'}</span></div>
      <button class="iconbtn" aria-label="Sonraki gün" data-act="shift-date" data-n="1">${ICON_RIGHT}</button>
    </div>
    <div class="row"><input type="date" id="date-pick" value="${d}" aria-label="Tarih seç"><button class="chip" data-act="set-date" data-date="${t}" aria-pressed="${d === t}">Bugün</button><button class="chip" data-act="set-date" data-date="${addDays(t, 1)}" aria-pressed="${d === addDays(t, 1)}">Yarın</button></div>
    <div class="shiftchips">${shiftChips}</div>
    <button class="btn primary big" data-act="area-make">${ICON_LIST}Listeyi oluştur</button>
  </div>${result}`;
}

function viewAreaAssign() {
  const people = allPeople();
  const byArea = {}; store.areas.forEach((a) => { byArea[a.id] = []; });
  const none = [];
  for (const p of people.sort(cmpName)) (byArea[p.area] || none).push(p);
  const chip = (p) => `<span class="pchip static">${esc(p.name)}${p.group ? `<span class="gtag k-${p.group}">${p.group}</span>` : ''}</span>`;
  return `<div class="card stack">
    <div class="row"><div style="flex:1;min-width:0"><div class="eyebrow">Kalıcı atamalar</div><h2 style="font-size:24px">Görev alanları</h2></div><button class="btn" data-act="areas-edit">Alanları düzenle</button><button class="btn primary" data-act="area-go-list">${ICON_LIST}Listeyi oluştur</button></div>
    <p class="small muted" style="margin:0">Her alan için “Kişi seç”e basıp çalışanları işaretleyin. Atamalar kaydedilir; yeni liste yüklendiğinde de korunur. Listede isimler o gün çalışanlara göre otomatik dağıtılır.</p>
  </div>
  <div class="assign">${store.areas.map((a) => `<section class="card stack acard">
      <div class="row"><div style="flex:1;min-width:0"><h3 style="font-size:19px">${esc(a.name)}</h3><span class="small muted">${shiftsLabel(a)} · ${byArea[a.id].length} kişi</span></div><button class="btn" data-act="area-pick" data-id="${a.id}">${ICON_PLUS}Kişi seç</button></div>
      <div class="pchips">${byArea[a.id].map(chip).join('') || '<span class="empty">Henüz kimse seçilmedi</span>'}</div>
    </section>`).join('')}</div>
  <div class="card stack"><h3 style="font-size:19px">Atanmamış kişiler (${none.length})</h3><div class="pchips">${none.map((p) => `<button class="pchip" data-act="person-area" data-key="${esc(p.key)}">${esc(p.name)}${p.group ? `<span class="gtag k-${p.group}">${p.group}</span>` : ''}</button>`).join('') || '<span class="empty">Herkes bir alana atanmış</span>'}</div></div>`;
}

// Alan için kişi seçme (işaretleme) penceresi
function areaPickSheet(id) {
  const a = store.areas.find((x) => x.id === id); if (!a) return;
  const people = allPeople().filter((p) => !p.group || a.shifts.includes(p.group))
    .sort((x, y) => (x.group || '9').localeCompare(y.group || '9') || cmpName(x, y));
  const areaName = (aid) => (store.areas.find((x) => x.id === aid) || {}).name || '';
  sheet(`<h3>${esc(a.name)} · kişi seç</h3>
    <input type="text" id="ap-q" placeholder="İsim ara" aria-label="İsim ara">
    <div class="checklist" id="ap-list">${people.map((p) => `<label data-n="${esc(p.name.toLocaleLowerCase('tr'))}"><input type="checkbox" value="${esc(p.key)}" ${p.area === id ? 'checked' : ''}><span class="cn">${esc(p.name)}</span>${p.group ? `<span class="gtag k-${p.group}">${p.group}</span>` : ''}${p.area && p.area !== id ? `<span class="small muted cur">${esc(areaName(p.area))}</span>` : ''}</label>`).join('') || '<p class="muted">Bu alanın vardiyalarında kişi yok.</p>'}</div>
    <p class="small muted" style="margin:0">Başka alanda olan birini işaretlerseniz bu alana taşınır.</p>
    <div class="row"><button class="btn primary" id="ap-save">Kaydet</button><button class="btn" data-x="1">Vazgeç</button><span style="flex:1"></span><span class="small muted" id="ap-count"></span></div>`, (bg) => {
    const q = bg.querySelector('#ap-q'); const cnt = bg.querySelector('#ap-count');
    const upd = () => { cnt.textContent = bg.querySelectorAll('#ap-list input:checked').length + ' kişi seçili'; };
    upd(); bg.querySelector('#ap-list').addEventListener('change', upd);
    q.addEventListener('input', () => { const v = q.value.toLocaleLowerCase('tr'); bg.querySelectorAll('#ap-list label').forEach((l) => { l.hidden = !!v && !l.dataset.n.includes(v); }); });
    bg.querySelector('#ap-save').addEventListener('click', () => {
      bg.querySelectorAll('#ap-list input').forEach((c) => { const p = store.people[c.value]; if (c.checked) p.area = id; else if (p.area === id) p.area = ''; });
      store.demo = false; save(); closeSheet(); render(); toast(`${a.name} kaydedildi`);
    });
  });
}

// Bir kişinin alanını değiştir (listeden: bu gün / kalıcı; atama ekranından: kalıcı)
function areaMoveSheet(key, date) {
  const p = { key, ...store.people[key] }; const g = date ? p.days[date] : null;
  const cur = date ? areaOf(p, date) : (p.area || '');
  const opts = store.areas.filter((a) => !g || a.shifts.includes(g) || !['1', '2', '3'].includes(g));
  sheet(`<h3>${esc(p.name)}${date ? ' · ' + fmtShort(date) : ''}</h3>
    <div class="optlist">${opts.map((a) => `<button data-a="${a.id}" aria-pressed="${cur === a.id}">${esc(a.name)}</button>`).join('')}<button data-a="" aria-pressed="${!cur}">Atanmamış</button></div>
    ${date ? `<label class="row small" style="gap:8px"><input type="checkbox" id="am-perm"> Kalıcı olarak ata (sonraki günlerde de bu alanda olsun)</label>` : ''}
    <button class="btn" data-x="1">Kapat</button>`, (bg) => {
    bg.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => {
      const aid = b.dataset.a; const perm = !date || bg.querySelector('#am-perm').checked;
      if (perm) { store.people[key].area = aid; if (date && store.dayAreas[date]) delete store.dayAreas[date][key]; }
      else { (store.dayAreas[date] = store.dayAreas[date] || {})[key] = aid; if ((store.people[key].area || '') === aid) delete store.dayAreas[date][key]; }
      store.demo = false; save(); closeSheet(); render(); toast(perm ? 'Kalıcı olarak atandı' : 'Bu gün için değiştirildi');
    }));
  });
}

// Alanları ekle / yeniden adlandır / sil / vardiyalarını ayarla
function areasEditSheet(draft) {
  draft = draft || store.areas.map((a) => ({ ...a, shifts: [...a.shifts] }));
  const read = (bg) => bg.querySelectorAll('.aedit').forEach((row, i) => {
    draft[i].name = row.querySelector('input[type=text]').value;
    draft[i].shifts = [...row.querySelectorAll('input[type=checkbox]')].filter((c) => c.checked).map((c) => c.value);
  });
  sheet(`<h3>Alanları düzenle</h3>
    <div class="stack">${draft.map((a, i) => `<div class="aedit"><input type="text" value="${esc(a.name)}" aria-label="Alan adı">
      <div class="row" style="gap:10px">${['1', '2', '3'].map((g) => `<label class="row small" style="gap:4px"><input type="checkbox" value="${g}" ${a.shifts.includes(g) ? 'checked' : ''}>${g}.</label>`).join('')}
      <button class="iconbtn" data-del="${i}" aria-label="${esc(a.name)} alanını sil">${ICON_TRASH}</button></div></div>`).join('')}</div>
    <button class="btn" id="ae-add">${ICON_PLUS}Alan ekle</button>
    <p class="small muted" style="margin:0">İşaretli vardiyalar o alanın hangi vardiyalarda olduğunu gösterir (ör. Merkez Lab: 2. ve 3.).</p>
    <div class="row"><button class="btn primary" id="ae-save">Kaydet</button><button class="btn" data-x="1">Vazgeç</button></div>`, (bg) => {
    bg.querySelector('#ae-add').addEventListener('click', () => { read(bg); draft.push({ id: uid(), name: '', shifts: ['1', '2', '3'] }); areasEditSheet(draft); const ins = document.querySelectorAll('.aedit input[type=text]'); ins[ins.length - 1].focus(); });
    bg.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => { read(bg); draft.splice(+b.dataset.del, 1); areasEditSheet(draft); }));
    bg.querySelector('#ae-save').addEventListener('click', () => {
      read(bg);
      const clean = draft.map((a) => ({ ...a, name: a.name.trim() })).filter((a) => a.name);
      if (clean.some((a) => !a.shifts.length)) { toast('Her alan için en az bir vardiya seçin'); return; }
      const ids = new Set(clean.map((a) => a.id));
      Object.values(store.people).forEach((p) => { if (p.area && !ids.has(p.area)) p.area = ''; });
      for (const m of Object.values(store.dayAreas)) for (const k of Object.keys(m)) if (m[k] && !ids.has(m[k])) delete m[k];
      store.areas = clean; save(); closeSheet(); render(); toast('Alanlar kaydedildi');
    });
  });
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
  const head = days.map((d) => { const dt = parseIso(d); const we = dt.getDay() === 0 || dt.getDay() === 6; return `<th class="${d === t ? 'today' : ''} ${we ? 'we' : ''}">${pad(dt.getDate())}<small>${pad(dt.getMonth() + 1)}.${dt.getFullYear() % 100}</small></th>`; }).join('');
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
  if (ui.busy) return `<div class="card stack"><h2>Görseller okunuyor…</h2><p class="muted">${esc(ui.busy.text)}</p><div class="progress"><i style="width:${Math.round(ui.busy.pct * 100)}%"></i></div><p class="small muted">İlk okumada metin tanıma modeli yüklenir; birkaç saniye sürebilir.</p></div>`;
  if (ui.review) return viewReview();
  const ups = store.uploads.slice().reverse();
  return `<div class="card stack">
    <div><div class="eyebrow">Her 2 haftada bir</div><h2 style="font-size:24px">Vardiya listesi yükle</h2></div>
    <label class="drop" id="drop" for="file-in">
      ${ICON_IMAGE}
      <b>Liste görsellerini seçin veya buraya sürükleyin</b>
      <span class="small muted">Birden fazla görseli birlikte seçin (1., 2., 3. vardiya ya da aynı listenin parçaları). Hepsi okunur, isimler tek listede toplanır.</span>
      <span class="btn primary">${ICON_UPLOAD}Görselleri seç</span>
    </label>
    <input type="file" id="file-in" accept="image/*" multiple hidden>
    <div class="note">Program tablodaki çizgileri bulur, her satırdan <b>ad soyad</b>ı okur, <b>kırmızı hücreleri OFF</b> sayar; hücrelerdeki <b>R</b> (rapor), <b>Yİ</b> (yıllık izin) ve 1/2/3 yazılarını tanır. Kaydetmeden önce her şeyi kontrol edip düzeltebilirsiniz.</div>
    <div class="row"><span class="small muted">Denemek için örnek görseller:</span>
      <button class="btn" data-act="sample" data-n="all">3 örnek görseli birlikte yükle</button>
      <button class="btn" data-act="sample" data-n="1">Sadece 1. vardiya örneği</button></div>
  </div>
  <div class="card stack"><h3 style="font-size:19px">Yüklenen listeler</h3>
    ${ups.length ? `<ul class="uploads">${ups.map((u) => `<li><span class="gtag k-${u.group || ''}" style="margin:0">${u.group ? u.group + '. vardiya' : 'Karışık'}</span><span>${fmtShort(u.start)} – ${fmtShort(addDays(u.start, u.days - 1))}</span><span class="muted small">${u.count} kişi · ${esc(u.file || '')}</span></li>`).join('')}</ul>` : `<p class="muted small">Henüz liste yüklenmedi.</p>`}
  </div>`;
}

// Birden çok görselin satırlarını isme göre birleştir: aynı kişi farklı görsellerde/tarihlerde olabilir
function mergedReview() {
  const R = ui.review; const map = new Map(); const order = [];
  const add = (src, rawName, group, cells) => {
    const name = String(R.names[src] ?? rawName).trim().replace(/\s+/g, ' ');
    const key = name ? nameKey(name) : '?' + src;
    let m = map.get(key);
    if (!m) { m = { key, name, srcs: [], groups: new Set(), files: new Set(), cells: {} }; map.set(key, m); order.push(m); }
    m.srcs.push(src); if (group) m.groups.add(group);
    for (const [d, c] of Object.entries(cells)) m.cells[d] = c;
    return m;
  };
  for (const P of R.parts) P.rows.forEach((row, ri) => {
    const cells = {};
    row.cells.forEach((c, ci) => { let code = c.code; if (!code && P.group && !c.raw) code = P.group; cells[addDays(P.start, ci)] = { code, raw: c.raw, fill: c.fill }; });
    add(`${P.id}:${ri}`, row.name, P.group, cells).files.add(P.file);
  });
  R.extra.forEach((id) => add(`x:${id}`, '', '', {}));
  for (const m of order) for (const [d, code] of Object.entries(R.cellEdits[m.key] || {})) m.cells[d] = { code, raw: '', fill: '' };
  let min = null, max = null;
  for (const P of R.parts) { const e = addDays(P.start, P.ncols - 1); if (!min || P.start < min) min = P.start; if (!max || e > max) max = e; }
  const dates = []; if (min) for (let d = min; d <= max && dates.length < 62; d = addDays(d, 1)) dates.push(d);
  return { rows: order, dates };
}

function viewReview() {
  const R = ui.review; const M = mergedReview();
  const head = M.dates.map((d) => { const dt = parseIso(d); return `<th>${pad(dt.getDate())}<small>${pad(dt.getMonth() + 1)}.${dt.getFullYear() % 100}</small></th>`; }).join('');
  const rows = M.rows.map((m) => { const skip = !!R.skip[m.key]; return `<tr class="${skip ? 'skip' : ''}">
    <td><input type="checkbox" data-act="rv-skip" data-key="${esc(m.key)}" ${skip ? '' : 'checked'} aria-label="Bu kişiyi al"></td>
    <td class="name rv"><div class="rvn"><input type="text" data-act="rv-name" data-key="${esc(m.key)}" value="${esc(m.name)}" placeholder="Ad soyad yazın" aria-label="Ad soyad">${[...m.groups].map((g) => `<span class="gtag k-${g}">${g}</span>`).join('')}${m.files.size > 1 ? `<span class="small muted nowrap">${m.files.size} görsel</span>` : ''}</div></td>
    ${M.dates.map((d) => { const c = m.cells[d] || { code: '' }; const k = CODES[c.code] ? c.code : 'Q'; return `<td><button class="code k-${k}" data-act="rv-cell" data-key="${esc(m.key)}" data-date="${d}" title="${c.raw ? 'Okunan: ' + esc(c.raw) : ''}${c.fill && c.fill !== 'white' && c.fill !== 'gray' ? ' Renk: ' + (COLOR_NAMES[c.fill] || c.fill) : ''}">${CODES[c.code] ? CODES[c.code].short : '?'}</button></td>`; }).join('')}</tr>`; }).join('');
  const people = M.rows.filter((m) => !R.skip[m.key] && m.name).length;
  const warn = R.parts.flatMap((P) => P.warnings.map((w) => `<div class="note"><b>${esc(P.file)}:</b> ${esc(w)}</div>`)).join('');
  const parts = R.parts.map((P) => `<div class="part">
      <canvas id="rv-cv-${P.id}" class="thumb"></canvas>
      <div class="stack" style="gap:8px;min-width:0">
        <div class="row" style="flex-wrap:nowrap"><b class="fname">${esc(P.file)}</b><span style="flex:1"></span><button class="iconbtn" data-act="rv-remove" data-id="${P.id}" aria-label="${esc(P.file)} görselini çıkar">${ICON_TRASH}</button></div>
        <span class="small muted">${P.rows.length} satır · ${fmtShort(P.start)} – ${fmtShort(addDays(P.start, P.ncols - 1))}</span>
        <div class="settings-grid" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px">
          <label class="field">Vardiya<select class="rv-group" data-id="${P.id}">${[['1', '1. Vardiya'], ['2', '2. Vardiya'], ['3', '3. Vardiya'], ['', 'Karışık']].map(([v, l]) => `<option value="${v}" ${P.group === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <label class="field">İlk sütun tarihi<input type="date" class="rv-start" data-id="${P.id}" value="${P.start}"></label>
        </div>
      </div>
    </div>`).join('');
  return `<div class="card stack">
    <div class="row"><div style="flex:1;min-width:0"><div class="eyebrow">Kontrol et ve düzelt</div><h2 style="font-size:24px">${R.parts.length} görsel · ${people} kişi</h2></div>
      <button class="btn" data-act="rv-cancel">Vazgeç</button><button class="btn primary" data-act="rv-save">${ICON_CHECK}Hepsini kaydet</button></div>
    <p class="small muted" style="margin:0">Tüm görsellerdeki isimler tek listede toplandı. Aynı isim birden fazla görselde varsa tek satırda birleşir. Hücreye dokunarak değiştirin; “?” okunamayan hücredir.</p>
    ${warn}
    <div class="parts">${parts}
      <label class="part addpart" for="file-in">${ICON_PLUS}<span>Görsel ekle</span></label>
      <input type="file" id="file-in" accept="image/*" multiple hidden>
    </div>
    <div class="row"><button class="btn" data-act="rv-add-row">${ICON_PLUS}Kişi ekle</button></div>
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
      if (act === 'rv-name') el.addEventListener('change', () => renameReviewRow(el.dataset.key, el.value));
      if (act === 'rv-skip') el.addEventListener('change', () => { ui.review.skip[el.dataset.key] = !el.checked; el.closest('tr').classList.toggle('skip', !el.checked); });
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
  if (ui.view === 'yukle' && ui.review && !ui.busy) {
    for (const P of ui.review.parts) { const cv = document.getElementById('rv-cv-' + P.id); cv.width = P.preview.width; cv.height = P.preview.height; cv.getContext('2d').drawImage(P.preview, 0, 0); }
    const part = (el) => ui.review.parts.find((P) => P.id === el.dataset.id);
    $app.querySelectorAll('.rv-group').forEach((el) => el.addEventListener('change', () => { part(el).group = el.value; render(); }));
    $app.querySelectorAll('.rv-start').forEach((el) => el.addEventListener('change', () => { if (el.value) { part(el).start = el.value; render(); } }));
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
  'cell': (el) => pickCode(store.people[el.dataset.key].days[el.dataset.date] || '', `${store.people[el.dataset.key].name} · ${fmtShort(el.dataset.date)}`, (code) => {
    const p = store.people[el.dataset.key]; if (code) p.days[el.dataset.date] = code; else delete p.days[el.dataset.date];
    store.demo = false; save(); render();
  }),
  'person': (el) => personSheet(el.dataset.key),
  'area-mode': (el) => { ui.areaMode = el.dataset.m; render(); },
  'area-go-list': () => { ui.areaMode = 'liste'; ui.areaShown = true; render(); const r = document.querySelector('.arealist'); r && r.scrollIntoView({ block: 'start' }); },
  'area-shift': (el) => { ui.areaShift = el.dataset.g; render(); },
  'area-make': () => { ui.areaShown = true; render(); const r = document.querySelector('.arealist'); r && r.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
  'area-move': (el) => areaMoveSheet(el.dataset.key, ui.date),
  'person-area': (el) => areaMoveSheet(el.dataset.key, null),
  'area-pick': (el) => areaPickSheet(el.dataset.id),
  'areas-edit': () => areasEditSheet(),
  'area-share': () => doShare(areaShareText(ui.date, ui.areaShift), `${ui.areaShift}. vardiya alan listesi`),
  'area-copy': async () => { const txt = areaShareText(ui.date, ui.areaShift); try { await navigator.clipboard.writeText(txt); toast('Liste kopyalandı'); } catch (e) { showText('Alan listesi', 'Metni seçip kopyalayın:', txt, true); } },
  'daily-areas': (el) => { ui.areaShift = el.dataset.g; ui.areaShown = true; ui.areaMode = 'liste'; go('alanlar'); },
  'add-person': () => personSheet(null),
  'sample': async (el) => {
    const ns = el.dataset.n === 'all' ? ['1', '2', '3'] : [el.dataset.n];
    try { handleFiles(await Promise.all(ns.map(async (n) => new File([await (await fetch(`samples/vardiya-${n}.png`)).blob()], `vardiya-${n}.png`, { type: 'image/png' })))); }
    catch (e) { toast('Örnek görsel açılamadı'); }
  },
  'rv-cell': (el) => { const key = el.dataset.key, d = el.dataset.date; const m = mergedReview().rows.find((x) => x.key === key); const c = (m && m.cells[d]) || { code: '' };
    pickCode(c.code, `${(m && m.name) || 'İsimsiz'} · ${fmtShort(d)}${c.raw ? ' · okunan: “' + c.raw + '”' : ''}`, (code) => { (ui.review.cellEdits[key] = ui.review.cellEdits[key] || {})[d] = code; render(); }); },
  'rv-add-row': () => { ui.review.extra.push(uid()); render(); const ins = $app.querySelectorAll('td.name input'); ins[ins.length - 1].focus(); },
  'rv-remove': (el) => { ui.review.parts = ui.review.parts.filter((P) => P.id !== el.dataset.id); if (!ui.review.parts.length) ui.review = null; render(); },
  'rv-cancel': () => { ui.review = null; queue = []; render(); },
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
  // telefonda klavye açılmasın diye metin kutusuna değil pencereye odaklan
  const sh = bg.querySelector('.sheet'); sh.tabIndex = -1; sh.focus();
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
    <label class="field">Görev alanı<select id="ps-area"><option value="">Atanmamış</option>${store.areas.map((a) => `<option value="${a.id}" ${p.area === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>
    <label class="field">Ekip / vardiya<select id="ps-group">${[['1', '1. Vardiya'], ['2', '2. Vardiya'], ['3', '3. Vardiya'], ['', 'Belirsiz']].map(([v, l]) => `<option value="${v}" ${p.group === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <div class="row"><button class="btn primary" id="ps-save">Kaydet</button><button class="btn" data-x="1">Vazgeç</button>${key ? '<span style="flex:1"></span><button class="btn danger" id="ps-del">Sil</button>' : ''}</div>`, (bg) => {
    bg.querySelector('#ps-save').addEventListener('click', () => {
      const name = bg.querySelector('#ps-name').value.trim(); const group = bg.querySelector('#ps-group').value; const area = bg.querySelector('#ps-area').value;
      if (!name) { toast('Ad soyad yazın'); return; }
      const nk = nameKey(name);
      if (key && nk !== key) { store.people[nk] = { ...store.people[key], ...(store.people[nk] || {}), name, group, area, days: { ...store.people[key].days, ...((store.people[nk] || {}).days) } }; delete store.people[key]; renameDayAreas(key, nk); }
      else store.people[nk] = { ...(store.people[nk] || p), name, group, area };
      store.demo = false; save(); closeSheet(); render();
    });
    const del = bg.querySelector('#ps-del');
    del && del.addEventListener('click', () => { if (del.dataset.sure) { delete store.people[key]; renameDayAreas(key, null); save(); closeSheet(); render(); toast('Silindi'); } else { del.dataset.sure = '1'; del.textContent = 'Silmeyi onayla'; } });
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
function renameReviewRow(key, value) {
  const R = ui.review; const m = mergedReview().rows.find((x) => x.key === key); if (!m) return;
  const name = value.trim().replace(/\s+/g, ' ');
  m.srcs.forEach((src) => { R.names[src] = name; });
  const nk = name ? nameKey(name) : '?' + m.srcs[0];
  if (nk !== key) {
    if (R.cellEdits[key]) { R.cellEdits[nk] = { ...(R.cellEdits[nk] || {}), ...R.cellEdits[key] }; delete R.cellEdits[key]; }
    if (R.skip[key]) { R.skip[nk] = true; delete R.skip[key]; }
  }
  render();
}

function saveReview() {
  const R = ui.review; if (!R) { go('gunluk'); return; }
  const M = mergedReview();
  const rows = M.rows.filter((m) => !R.skip[m.key] && m.name);
  if (!rows.length) { toast('Kaydedilecek kişi yok'); return; }
  if (store.demo) { store.people = {}; store.uploads = []; store.dayAreas = {}; store.demo = false; }
  for (const m of rows) {
    const k = nameKey(m.name);
    const p = store.people[k] || { name: m.name, group: '', days: {} };
    p.name = m.name;
    for (const [d, c] of Object.entries(m.cells)) { if (CODES[c.code] && c.code) p.days[d] = c.code; else if (c.code === '') delete p.days[d]; }
    if (m.groups.size === 1) p.group = [...m.groups][0];
    else { // karışık listede ekip = en çok çalışılan vardiya
      const cnt = { '1': 0, '2': 0, '3': 0 }; Object.values(p.days).forEach((c) => { if (cnt[c] != null) cnt[c]++; });
      const best = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0]; if (best[1]) p.group = best[0];
    }
    store.people[k] = p;
  }
  for (const P of R.parts) store.uploads.push({ id: uid(), at: new Date().toISOString(), group: P.group, start: P.start, days: P.ncols, count: P.rows.length, file: P.file });
  save();
  const t = todayIso();
  ui.date = M.dates.includes(t) ? t : M.dates[0] || t;
  ui.gridStart = null; ui.review = null;
  toast(`${rows.length} kişi kaydedildi`);
  go('gunluk');
}

// ---------- Görsel analizi ----------
let queue = [];
let batch = { done: 0, total: 0 };
function handleFiles(files) {
  if (!files.length) return;
  queue.push(...files); batch.total += files.length;
  if (!ui.busy) nextQueued();
}
async function nextQueued() {
  const f = queue.shift();
  if (!f) { ui.busy = null; batch = { done: 0, total: 0 }; render(); return; }
  await analyzeFile(f); batch.done++;
  nextQueued();
}
function setBusy(text, pct) {
  const n = batch.total || 1, i = Math.min(batch.done, n - 1);
  ui.busy = { text: `Görsel ${i + 1}/${n}: ${text}`, pct: (i + pct) / n };
  if (ui.view !== 'yukle') go('yukle'); else render();
}

async function analyzeFile(file) {
  setBusy('açılıyor', 0.02);
  try {
    const img = await loadImg(file);
    const res = await analyzeImage(img, (t, p) => setBusy(t, p));
    if (!ui.review) ui.review = { parts: [], names: {}, cellEdits: {}, skip: {}, extra: [] };
    const prev = ui.review.parts[ui.review.parts.length - 1];
    // aynı listenin devamı olan (başlıksız) görsel: tarihi ve vardiyayı öncekinden al
    if (prev && !res.dateFound) { res.start = prev.start; res.warnings = res.warnings.filter((w) => !/tarih/i.test(w)); res.warnings.push('Tarih bulunamadı; önceki görselin tarihleri kullanıldı.'); }
    if (prev && !res.groupFound) res.group = prev.group;
    ui.review.parts.push({ id: uid(), file: file.name || 'Liste', start: res.start, group: res.group, ncols: res.cols.length, preview: res.preview, rows: res.rows, warnings: res.warnings });
  } catch (e) {
    console.error(e);
    toast(`${file.name || 'Görsel'} okunamadı: ${e.message || e}`);
  }
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
  let group = ''; let groupDefault = false;
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
  const dateFound = !!start;
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
  if (!group) { const best = Object.entries(digitCount).sort((a, b) => b[1] - a[1])[0]; const nonzero = Object.values(digitCount).filter((n) => n > 0).length; if (best[1] && nonzero === 1) group = best[0]; else if (!best[1]) { group = '1'; groupDefault = true; } }
  // Yazısız beyaz hücreler = listenin vardiyası (kaydederken de uygulanır)
  if (!rows.length) warnings.push('Hiç kişi satırı bulunamadı. “Satır ekle” ile elle ekleyebilirsiniz.');
  progress('Bitti', 1);
  return { start, group, cols: dayCols, rows, warnings, preview, dateFound, groupFound: !groupDefault };
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
const ICON_LIST = svg('<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>');
const ICON_TRASH = svg('<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>');

{ const h = location.hash.replace('#', ''); ui.view = VIEWS.includes(h) ? h : 'gunluk'; render(); }
initRemote();
