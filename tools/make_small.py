# Küçük yazılı, büyük harfli gerçekçi liste (WhatsApp ekran görüntüsü gibi), JPEG
import sys
from PIL import Image, ImageDraw, ImageFont
from datetime import date, timedelta
F = lambda s, b=False: ImageFont.truetype(f"/usr/share/fonts/truetype/liberation/LiberationSans{'-Bold' if b else '-Regular'}.ttf", s)
N = ["BERRA KESKİN","BİLGENUR DEMİREL","CEYDA ÜNLÜSOY","ELİF NAS TAŞKIN","ELİF SILA YILMAZ","FIRAT ANLİ","HATİCENUR ŞENAYDINER","İZZET EFE SARIOĞLU","MAHMUT CAN ERTUÇ","MERT TUNCER","MERVE SEZER","MUHAMMED EMİN YILMAZ","MUHAMMED TAHSİN ÇEVİK","MUHAMMET BARAN GÖK","MUSTAFA BAYRAM","MUSTAFA ÇINAR","AYŞEGÜL ÖZTÜRK","ŞEYMA NUR AKGÜL"]
start = date(2026, 10, 26); days = 14; rowH, nameW, cellW = 17, 150, 22
W = 10 + nameW + cellW*days + 10; H = 34 + rowH*(len(N)+1) + 8
im = Image.new("RGB", (W, H), "white"); d = ImageDraw.Draw(im)
d.text((10, 8), "1. VARDİYA 26.10.2026-08.11.2026", font=F(13, True), fill="black")
y0 = 34; d.rectangle([10, y0, W-10, y0+rowH], fill=(217,217,217)); d.text((14, y0+3), "ADI SOYADI", font=F(10, True), fill="black")
for i in range(days): d.text((10+nameW+i*cellW+4, y0+3), f"{(start+timedelta(days=i)).day:02d}", font=F(10, True), fill="black")
for r, n in enumerate(N):
    y = y0 + rowH*(r+1); d.text((13, y+3), n, font=F(10), fill="black")
    offs = {(r*2) % 7, (r*2+1) % 7}
    for i in range(days):
        x = 10+nameW+i*cellW
        if i % 7 in offs: d.rectangle([x, y, x+cellW, y+rowH], fill=(255,0,0))
        elif r == 5 and i == 9: d.text((x+6, y+3), "R", font=F(10, True), fill="black")
        else: d.text((x+8, y+3), "1", font=F(10), fill="black")
for k in range(len(N)+2): d.line([10, y0+k*rowH, W-10, y0+k*rowH], fill="black", width=1)
for x in [10, 10+nameW] + [10+nameW+cellW*(i+1) for i in range(days)]: d.line([x, y0, x, y0+rowH*(len(N)+1)], fill="black", width=1)
im.save(sys.argv[1], quality=70)
