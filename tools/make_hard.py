# Zor test: ince çizgi, Sıra No sütunu, yazısız kırmızı OFF, gri hafta sonu başlığı, Toplam sütunu, JPEG, hafif bulanıklık
import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from datetime import date, timedelta
names = ["AHMET YILMAZ","AYŞE DEMİR","MEHMET KAYA","FATMA ÇELİK","MUSTAFA ŞAHİN","ZEYNEP ÖZTÜRK","EMRE AYDIN","ELİF ARSLAN","HASAN DOĞAN","MERVE KOÇ","SİNAN EREN","PINAR UYSAL"]
start = date(2026, 11, 16); days = 14
f = ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf", 15)
fb = ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf", 15)
noW, nameW, cellW, rowH, top = 40, 190, 34, 26, 50
W = noW + nameW + cellW*days + 60 + 30; H = top + rowH*(len(names)+1) + 30
img = Image.new("RGB", (W, H), "white"); d = ImageDraw.Draw(img)
d.text((10, 15), "3. VARDİYA ÇALIŞMA LİSTESİ (16.11.2026 - 29.11.2026)", font=fb, fill="black")
x0, y0 = 10, top
cols = [x0, x0+noW, x0+noW+nameW] + [x0+noW+nameW+cellW*(i+1) for i in range(days)] + [x0+noW+nameW+cellW*days+60]
d.text((x0+6, y0+5), "No", font=fb, fill="black"); d.text((cols[1]+6, y0+5), "Adı Soyadı", font=fb, fill="black")
for i in range(days):
    dt = start + timedelta(days=i); x = cols[2+i]
    if dt.weekday() >= 5: d.rectangle([x, y0, x+cellW, y0+rowH], fill=(200,200,200))
    d.text((x+8, y0+5), f"{dt.day}", font=fb, fill="black")
d.text((cols[-2]+6, y0+5), "Top.", font=fb, fill="black")
for r, n in enumerate(names):
    y = y0 + rowH*(r+1)
    d.text((x0+12, y+5), str(r+1), font=f, fill="black"); d.text((cols[1]+6, y+5), n, font=f, fill="black")
    offs = {(r*3) % 7, (r*3+1) % 7}; work = 0
    for i in range(days):
        x = cols[2+i]
        if r == 4 and i in (5,6,7): d.text((x+10, y+5), "R", font=fb, fill="black")
        elif r == 9 and 9 <= i <= 12: d.text((x+8, y+5), "Yİ", font=fb, fill="black")
        elif i % 7 in offs: d.rectangle([x, y, x+cellW, y+rowH], fill=(255, 0, 0))
        else: d.text((x+13, y+5), "3", font=f, fill="black"); work += 1
    d.text((cols[-2]+20, y+5), str(work), font=f, fill="black")
for r in range(len(names)+2):
    y = y0 + rowH*r; d.line([x0, y, cols[-1], y], fill=(60,60,60), width=1)
for x in cols: d.line([x, y0, x, y0+rowH*(len(names)+1)], fill=(60,60,60), width=1)
img = img.filter(ImageFilter.GaussianBlur(0.6))
img.save(sys.argv[1], quality=55)
