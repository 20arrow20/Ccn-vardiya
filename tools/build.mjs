// src/ -> www/ : Capacitor (APK) ve normal tarayıcı için tam HTML belgesi üretir
import { readFileSync, writeFileSync, rmSync, cpSync, mkdirSync, readdirSync } from 'node:fs';
const root = new URL('..', import.meta.url).pathname;
// OCR dosyalarını node_modules'tan src/vendor'a kopyala (git'e girmez)
const nm = root + 'node_modules/';
mkdirSync(root + 'src/vendor/core', { recursive: true });
mkdirSync(root + 'src/vendor/lang', { recursive: true });
cpSync(nm + 'tesseract.js/dist/tesseract.min.js', root + 'src/vendor/tesseract.min.js');
// tesseract.js 5.1.1 hatası: dil nesnesiyle başlatırken kodu değil veriyi birleştiriyor (t.data -> t.code)
const bug = '"string"==typeof t?t:t.data})).join("+")';
const workerSrc = readFileSync(nm + 'tesseract.js/dist/worker.min.js', 'utf8');
if (!workerSrc.includes(bug)) throw new Error('worker.min.js beklenen yerde değil; yamayı kontrol edin');
writeFileSync(root + 'src/vendor/worker.min.js', workerSrc.replace(bug, '"string"==typeof t?t:t.code})).join("+")'));
for (const f of ['tesseract-core-simd-lstm.wasm.js', 'tesseract-core-lstm.wasm.js']) cpSync(nm + 'tesseract.js-core/' + f, root + 'src/vendor/core/' + f);
// Türkçe model: sıkıştırılmış dosya base64 metin olarak (her sunucu .txt dosyasını sorunsuz verir)
writeFileSync(root + 'src/vendor/lang/tur.b64.txt', readFileSync(nm + '@tesseract.js-data/tur/4.0.0_best_int/tur.traineddata.gz').toString('base64'));

// klasörü silmeden içini temizle (açık bir yerel sunucu klasörü kaybetmesin)
mkdirSync(root + 'www', { recursive: true });
for (const f of readdirSync(root + 'www')) rmSync(root + 'www/' + f, { recursive: true, force: true });
cpSync(root + 'src', root + 'www', { recursive: true });
const body = readFileSync(root + 'src/index.html', 'utf8');
writeFileSync(root + 'www/index.html', `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#1f5f8b">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>
</head>
<body>
${body}
</body>
</html>
`);
console.log('www/ hazır');
