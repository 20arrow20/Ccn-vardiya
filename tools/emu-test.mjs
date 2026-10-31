// Emülatördeki uygulamada (WebView, Chrome DevTools protokolü üzerinden) liste okumanın hızını ve doğruluğunu ölçer.
// ML Kit (yeni) ile Tesseract (eski) aynı görsellerle karşılaştırılır. Yalnızca GitHub Actions emülatör işinde çalışır.
import { readFileSync } from 'node:fs';

const dir = new URL('./test/', import.meta.url);
const truth = JSON.parse(readFileSync(new URL('liste-40.json', dir), 'utf8'));

const targets = await (await fetch('http://127.0.0.1:9222/json')).json();
const page = targets.find((t) => t.type === 'page') || targets[0];
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let seq = 0; const waiting = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && waiting.has(d.id)) { waiting.get(d.id)(d); waiting.delete(d.id); } };
const send = (method, params = {}) => new Promise((res) => { const id = ++seq; waiting.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.error) throw new Error(JSON.stringify(r.error));
  if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 800));
  return r.result.result.value;
};

console.log('UYGULAMA', await evaluate('JSON.stringify({ surum: APP_VERSION, mlkit: !!nativeOcr(), cekirdek: navigator.hardwareConcurrency, ua: navigator.userAgent })'));

// files: [{ ad, tip }] ya da uygulamanın içindeki örnekler için { ornek: 'samples/vardiya-1.png' }
async function run(label, files, noNative) {
  const parts = files.map((f) => (f.ornek ? `fetch('${f.ornek}').then((r) => r.blob()).then((b) => new File([b], '${f.ornek}', { type: 'image/png' }))`
    : `Promise.resolve((() => { const bin = atob('${readFileSync(new URL(f.ad, dir)).toString('base64')}'); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new File([u], '${f.ad}', { type: '${f.tip}' }); })())`));
  const out = JSON.parse(await evaluate(`(async () => {
    window.__noNative = ${noNative}; window.__mlInfo = null; ui.review = null;
    const fs = await Promise.all([${parts.join(',')}]);
    const t = performance.now(); handleFiles(fs); await new Promise((r) => setTimeout(r, 50));
    const T0 = Date.now(); while ((ui.busy || !ui.review) && Date.now() - T0 < 900000) await new Promise((r) => setTimeout(r, 100));
    const P = ui.review ? ui.review.parts : [];
    return JSON.stringify({ ms: Math.round(performance.now() - t), ml: window.__mlInfo, start: P[0] && P[0].start, group: P[0] && P[0].group,
      warnings: P.flatMap((x) => x.warnings), rows: P.flatMap((x) => x.rows.map((r) => ({ name: r.name, skip: r.skip, cells: r.cells.map((c) => c.code) }))) });
  })()`));
  let line = `${label}: ${(out.ms / 1000).toFixed(1)} sn, ${out.rows.filter((r) => !r.skip).length} kişi`;
  if (out.ml) line += ` | ML Kit kendi süresi ${out.ml.nativeMs} ms, köprü dahil ${out.ml.totalMs} ms, ${out.ml.words} kelime`;
  if (files[0].ad) {
    const got = out.rows.filter((r) => !r.skip);
    let nameOk = 0, cellOk = 0, cellN = 0; const badNames = [], badCells = [];
    truth.forEach((t, i) => {
      const g = got.find((x) => x.name === t.name); if (g) nameOk++; else badNames.push(`${t.name} → ${got[i] ? got[i].name : '(yok)'}`);
      const gg = g || got[i]; if (gg) t.cells.forEach((c, k) => { cellN++; if (gg.cells[k] === c) cellOk++; else badCells.push(`${t.name} ${k + 2}. gün: ${c} → ${gg.cells[k]}`); });
    });
    line += ` | isim ${nameOk}/${truth.length}, hücre ${cellOk}/${cellN}, ilk gün ${out.start}, vardiya ${out.group}`;
    if (badNames.length) line += `\n   yanlış isimler: ${badNames.slice(0, 12).join(' ; ')}`;
    if (badCells.length) line += `\n   yanlış hücreler: ${badCells.slice(0, 12).join(' ; ')}`;
  }
  if (out.warnings.length) line += `\n   uyarılar: ${out.warnings.join(' | ')}`;
  console.log('SONUÇ ' + line);
}

const three = [{ ornek: 'samples/vardiya-1.png' }, { ornek: 'samples/vardiya-2.png' }, { ornek: 'samples/vardiya-3.png' }];
await run('ML Kit · 40 kişi PNG', [{ ad: 'liste-40.png', tip: 'image/png' }], false);
await run('ML Kit · 40 kişi JPEG (küçültülmüş)', [{ ad: 'liste-40.jpg', tip: 'image/jpeg' }], false);
await run('ML Kit · 3 tablo birlikte', three, false);
await run('Tesseract (eski) · 40 kişi PNG', [{ ad: 'liste-40.png', tip: 'image/png' }], true);
await run('Tesseract (eski) · 3 tablo birlikte', three, true);
console.log('HATA KAYDI', await evaluate("localStorage.getItem('ccn-vardiya-hatalar')"));
ws.close();
