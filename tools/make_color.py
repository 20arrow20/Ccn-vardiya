# Renkli zeminli isim hücreleri (sarı, yeşil, turuncu, açık kırmızı, koyu mavi/beyaz yazı), küçük yazı, JPEG
import sys
from PIL import Image, ImageDraw, ImageFont
from datetime import date, timedelta
F = lambda s, b=False: ImageFont.truetype(f"/usr/share/fonts/truetype/liberation/LiberationSans{'-Bold' if b else '-Regular'}.ttf", s)
N = [("ZEYNEP SOYLU", (255,255,0), "black"), ("ÜNSAL KARAYTU", (146,208,80), "black"), ("İLKER KAYAKAN", (255,192,0), "black"), ("FEYZA MARAŞ", (255,150,150), "black"),
     ("YÜKSEL ARAN", (0,112,192), "white"), ("NESLİHAN RAŞİT", (0,176,80), "black"), ("FERHAT BARIMLAY", (255,255,255), "black"), ("SONGÜL ÇALAMAN", (180,198,231), "black"),
     ("ÖZNUR İLENDEMLİ", (255,230,153), "black"), ("ONUR UZUNMEHMET", (198,224,180), "black")]
start = date(2026, 10, 26); days = 14; rowH, nameW, cellW = 17, 150, 22
W = 10 + nameW + cellW*days + 10; H = 34 + rowH*(len(N)+1) + 8
im = Image.new("RGB", (W, H), "white"); d = ImageDraw.Draw(im)
d.text((10, 8), "2. VARDİYA 26.10.2026-08.11.2026", font=F(13, True), fill="black")
y0 = 34; d.text((14, y0+3), "ADI SOYADI", font=F(10, True), fill="black")
for i in range(days): d.text((10+nameW+i*cellW+4, y0+3), f"{(start+timedelta(days=i)).day:02d}", font=F(10, True), fill="black")
for r, (n, bg, fg) in enumerate(N):
    y = y0 + rowH*(r+1); d.rectangle([10, y, 10+nameW, y+rowH], fill=bg); d.text((13, y+3), n, font=F(10), fill=fg)
    offs = {(r*2) % 7, (r*2+1) % 7}
    for i in range(days):
        x = 10+nameW+i*cellW
        if i % 7 in offs: d.rectangle([x, y, x+cellW, y+rowH], fill=(255,0,0))
        else: d.text((x+8, y+3), "2", font=F(10), fill="black")
for k in range(len(N)+2): d.line([10, y0+k*rowH, W-10, y0+k*rowH], fill="black", width=1)
for x in [10, 10+nameW] + [10+nameW+cellW*(i+1) for i in range(days)]: d.line([x, y0, x, y0+rowH*(len(N)+1)], fill="black", width=1)
im.save(sys.argv[1], quality=75)
