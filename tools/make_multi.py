# Test: tek görselde birden çok tablo (alt alta devam tablosu, iki vardiya, yan yana)
import sys
from PIL import Image, ImageDraw, ImageFont
from datetime import date, timedelta
F = lambda s, b=False: ImageFont.truetype(f"/usr/share/fonts/truetype/dejavu/DejaVuSans{'-Bold' if b else ''}.ttf", s)
GUN = ["Pt","Sa","Ça","Pe","Cu","Ct","Pz"]
def table(d, x0, y0, names, shift, title=None, header=True, start=date(2026,11,2), days=14, rowoff=0, odd=None):
    nameW, cellW, rowH = 230, 44, 34
    if title: d.text((x0, y0), title, font=F(20, True), fill="black"); y0 += 40
    y = y0
    if header:
        d.text((x0+8, y+8), "AD SOYAD", font=F(16, True), fill="black")
        for i in range(days):
            dt = start + timedelta(days=i); x = x0+nameW+i*cellW
            d.text((x+8, y+1), f"{dt.day:02d}", font=F(16), fill="black"); d.text((x+10, y+18), GUN[dt.weekday()], font=F(11), fill="black")
        y += rowH
    for r, n in enumerate(names):
        rr = r + rowoff; d.text((x0+8, y+r*rowH+7), n, font=F(16), fill="black")
        offs = {(rr*2) % 7, (rr*2+1) % 7}
        for i in range(days):
            x = x0+nameW+i*cellW; yy = y+r*rowH
            if odd and (r, i) in odd: d.text((x+14, yy+6), odd[(r, i)], font=F(17, True), fill="black")
            elif i % 7 in offs: d.rectangle([x, yy, x+cellW, yy+rowH], fill=(230,40,40)); d.text((x+6, yy+9), "OFF", font=F(13, True), fill="white")
            else: d.text((x+17, yy+6), shift, font=F(17), fill="black")
    nrows = len(names) + (1 if header else 0); W = nameW + cellW*days
    for k in range(nrows+1): d.line([x0, y0+k*rowH, x0+W, y0+k*rowH], fill="black", width=2)
    for c in range(days+2):
        x = x0 if c == 0 else x0+nameW+(c-1)*cellW; d.line([x, y0, x, y0+nrows*rowH], fill="black", width=2)
    return y0 + nrows*rowH
A = ["Ahmet Yılmaz","Ayşe Demir","Mehmet Kaya","Fatma Çelik","Mustafa Şahin"]
B = ["Zeynep Öztürk","Emre Aydın","Elif Arslan","Hasan Doğan","Merve Koç"]
C = ["Ali Kılıç","Esra Kurt","Burak Özdemir","Gamze Aslan","Serkan Polat"]
out = sys.argv[1]
# 1) devam tablosu: 1. vardiya + başlıksız devamı (bir hücre "2", bir "R", bir "Yİ")
im = Image.new("RGB", (900, 560), "white"); d = ImageDraw.Draw(im)
yb = table(d, 10, 10, A, "1", "1. VARDİYA LİSTESİ 02.11.2026 - 15.11.2026")
table(d, 10, yb+50, B, "1", header=False, rowoff=5, odd={(0,3):"2",(1,4):"R",(2,9):"Yİ"})
im.save(out+"/coklu-devam.png")
# 2) alt alta iki vardiya
im = Image.new("RGB", (900, 620), "white"); d = ImageDraw.Draw(im)
yb = table(d, 10, 10, A, "1", "1. VARDİYA 02.11.2026 - 15.11.2026")
table(d, 10, yb+40, C, "2", "2. VARDİYA 02.11.2026 - 15.11.2026")
im.save(out+"/coklu-iki.png")
# 3) yan yana (7 günlük iki tablo)
im = Image.new("RGB", (1180, 300), "white"); d = ImageDraw.Draw(im)
table(d, 10, 10, A, "1", "1. VARDİYA 02.11.2026 - 08.11.2026", days=7)
table(d, 600, 10, C, "2", "2. VARDİYA 02.11.2026 - 08.11.2026", days=7)
im.save(out+"/coklu-yanyana.png")
