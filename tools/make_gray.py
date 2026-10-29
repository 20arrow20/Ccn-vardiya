# Test: gri alanlı tablo — gri tarih başlığı, gri "Unvan" sütunu (yazılı), gri vardiya bantları
import sys
from PIL import Image, ImageDraw, ImageFont
from datetime import date, timedelta
F = lambda s, b=False: ImageFont.truetype(f"/usr/share/fonts/truetype/liberation/LiberationSans{'-Bold' if b else '-Regular'}.ttf", s)
GRAY, GRAY2 = (217,217,217), (191,191,191)
start = date(2026, 11, 2); days = 14
sec = {"1": ["Ahmet Yılmaz","Ayşe Demir","Mehmet Kaya","Fatma Çelik"], "2": ["Ali Kılıç","Esra Kurt","Burak Özdemir"], "3": ["Kemal Uçar","Hülya Tekin","Volkan Bulut"]}
noW, nameW, unvW, cellW, rowH = 36, 200, 110, 36, 28
cols = [10, 10+noW, 10+noW+nameW, 10+noW+nameW+unvW] + [10+noW+nameW+unvW+cellW*(i+1) for i in range(days)]
W = cols[-1] + 10; nrows = 1 + sum(len(v)+1 for v in sec.values()); H = 60 + rowH*nrows + 20
im = Image.new("RGB", (W, H), "white"); d = ImageDraw.Draw(im)
d.text((10, 15), "RADYOLOJİ BÖLÜMÜ ÇALIŞMA ÇİZELGESİ  KASIM 2026", font=F(18, True), fill="black")
y = 60
d.rectangle([10, y, W-10, y+rowH], fill=GRAY)
d.text((14, y+6), "No", font=F(14, True), fill="black"); d.text((cols[1]+6, y+6), "Adı Soyadı", font=F(14, True), fill="black"); d.text((cols[2]+6, y+6), "Unvan", font=F(14, True), fill="black")
for i in range(days): d.text((cols[3]+i*cellW+6, y+6), (start+timedelta(days=i)).strftime("%d.%m")[:5], font=F(11, True), fill="black")
y += rowH; n = 0
for g, names in sec.items():
    d.rectangle([10, y, W-10, y+rowH], fill=GRAY2); d.text((cols[1]+6, y+6), f"{g}. VARDİYA (08:00-16:00)" if g=="1" else f"{g}. VARDİYA", font=F(15, True), fill="black"); y += rowH
    for r, name in enumerate(names):
        n += 1; d.text((16, y+6), str(n), font=F(14), fill="black"); d.text((cols[1]+6, y+6), name, font=F(14), fill="black")
        d.rectangle([cols[2], y, cols[3], y+rowH], fill=GRAY); d.text((cols[2]+6, y+6), "TEKNİKER", font=F(13), fill="black")
        offs = {(n*2) % 7, (n*2+1) % 7}
        for i in range(days):
            x = cols[3]+i*cellW
            if n == 2 and i == 4: d.text((x+11, y+6), "R", font=F(15, True), fill="black")
            elif n == 6 and i in (8, 9): d.text((x+8, y+6), "Yİ", font=F(15, True), fill="black")
            elif i % 7 in offs: d.rectangle([x, y, x+cellW, y+rowH], fill=(255,0,0)); d.text((x+5, y+8), "OFF", font=F(11, True), fill="white")
            else: d.text((x+13, y+6), g, font=F(15), fill="black")
        y += rowH
for k in range(nrows+1): d.line([10, 60+k*rowH, W-10, 60+k*rowH], fill="black", width=1)
for x in cols + [W-10]: d.line([x, 60, x, 60+rowH*nrows], fill="black", width=1)
im.save(sys.argv[1])
