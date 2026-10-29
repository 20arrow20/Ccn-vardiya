# Test için örnek vardiya listesi görseli üretir (kişiler × günler, kırmızı = OFF)
import sys, random
from PIL import Image, ImageDraw, ImageFont
from datetime import date, timedelta

out, shift, seed = sys.argv[1], sys.argv[2], int(sys.argv[3])
random.seed(seed)
names = {
 "1": ["Ahmet Yılmaz","Ayşe Demir","Mehmet Kaya","Fatma Çelik","Mustafa Şahin","Zeynep Öztürk","Emre Aydın","Elif Arslan","Hasan Doğan","Merve Koç"],
 "2": ["Ali Kılıç","Esra Kurt","Burak Özdemir","Gamze Aslan","Serkan Polat","Derya Yıldız","Oğuz Erdoğan","Büşra Güneş","Cem Aksoy","Seda Karaca"],
 "3": ["Kemal Uçar","Hülya Tekin","Volkan Bulut","Sevgi Ünal","Tolga Işık","Gül Akın","Murat Çakır","Ebru Şen","Kaan Yavuz","İrem Duman"],
}[shift]
start = date(2026, 11, 2); days = 14
font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 20)
bold = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 22)
nameW, cellW, rowH, top = 260, 56, 40, 70
W = nameW + cellW*days + 20; H = top + rowH*(len(names)+1) + 20
img = Image.new("RGB", (W, H), "white"); d = ImageDraw.Draw(img)
d.text((10, 20), f"{shift}. VARDİYA LİSTESİ  02.11.2026 - 15.11.2026", font=bold, fill="black")
x0, y0 = 10, top
gun = ["Pt","Sa","Ça","Pe","Cu","Ct","Pz"]
for i in range(days):
    dt = start + timedelta(days=i); x = x0 + nameW + i*cellW
    d.text((x+8, y0+2), f"{dt.day:02d}", font=font, fill="black")
    d.text((x+12, y0+20), gun[dt.weekday()], font=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 14), fill="black")
d.text((x0+8, y0+8), "AD SOYAD", font=bold, fill="black")
for r, n in enumerate(names):
    y = y0 + rowH*(r+1)
    d.text((x0+8, y+8), n, font=font, fill="black")
    offs = {(r*2+k) % 7 for k in (0, 1)}
    special = random.choice([None, None, None, "R", "Yİ"]); spday = random.randrange(days)
    for i in range(days):
        x = x0 + nameW + i*cellW
        if i == spday and special:
            d.text((x+14 if special=="Yİ" else x+20, y+8), special, font=bold, fill="black")
        elif i % 7 in offs:
            d.rectangle([x, y, x+cellW, y+rowH], fill=(230, 40, 40))
            d.text((x+8, y+8), "OFF", font=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 16), fill="white")
        else:
            d.text((x+22, y+8), shift, font=font, fill="black")
for r in range(len(names)+2):
    y = y0 + rowH*r; d.line([x0, y, x0+nameW+cellW*days, y], fill="black", width=2)
for c in range(days+2):
    x = x0 if c == 0 else x0 + nameW + (c-1)*cellW
    d.line([x, y0, x, y0+rowH*(len(names)+1)], fill="black", width=2)
img.save(out)
