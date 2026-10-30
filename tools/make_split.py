# Bölünmüş görünen tek tablo: isim + 4 gün | birleştirilmiş "GÖREV" sütunu (yatay çizgi yok) | 10 gün
import sys
from PIL import Image, ImageDraw, ImageFont
from datetime import date, timedelta
F = lambda s, b=False: ImageFont.truetype(f"/usr/share/fonts/truetype/liberation/LiberationSans{'-Bold' if b else '-Regular'}.ttf", s)
N = ["ELANUR GÖRKEM","ELÇİN ALPAY","FİGEN KARAÇAY","GÜLTEN YURDAKUL","İSMAİL ENES SOYLU","İSMET ÖZTÜRK","MEHMET ALİ ŞENTÜRK","MERT EREN ÖZBAĞ","NURDAGÜL ŞİŞKİN","ÖZLEM GÜLER","RABİA ÇOŞKUN","SEFA BİÇER"]
start = date(2026, 10, 27); rowH, nameW, cellW, gw = 24, 190, 34, 70
x0 = 10; cols = [x0, x0+nameW] + [x0+nameW+cellW*(i+1) for i in range(4)]
gx = cols[-1]; cols2 = [gx+gw] + [gx+gw+cellW*(i+1) for i in range(10)]
W = cols2[-1] + 10; H = 50 + rowH*(len(N)+1) + 10
im = Image.new("RGB", (W, H), "white"); d = ImageDraw.Draw(im)
d.text((10, 14), "2. VARDİYA ÇALIŞMA LİSTESİ  27.10.2026 - 09.11.2026", font=F(16, True), fill="black")
y0 = 50; dayx = cols[1:5] + cols2[:10]
d.text((14, y0+5), "ADI SOYADI", font=F(12, True), fill="black"); d.text((gx+8, y0+5), "GÖREV", font=F(12, True), fill="black")
for i, x in enumerate(dayx): d.text((x+8, y0+5), f"{(start+timedelta(days=i)).day:02d}", font=F(12, True), fill="black")
for r, n in enumerate(N):
    y = y0 + rowH*(r+1); d.text((14, y+5), n, font=F(12), fill="black")
    offs = {(r*2) % 7, (r*2+1) % 7}
    for i, x in enumerate(dayx):
        if i % 7 in offs: d.rectangle([x, y, x+cellW, y+rowH], fill=(255,0,0))
        elif r == 3 and i == 8: d.text((x+11, y+4), "R", font=F(13, True), fill="black")
        else: d.text((x+13, y+4), "2", font=F(13), fill="black")
d.text((gx+8, y0+rowH*6), "ACİL", font=F(13, True), fill="black")
for k in range(len(N)+2):
    y = y0+k*rowH; d.line([cols[0], y, gx, y], fill="black", width=1); d.line([cols2[0], y, cols2[-1], y], fill="black", width=1)
d.line([gx, y0+rowH*(len(N)+1), cols2[0], y0+rowH*(len(N)+1)], fill="black", width=1); d.line([gx, y0, cols2[0], y0], fill="black", width=1); d.line([gx, y0+rowH, cols2[0], y0+rowH], fill="black", width=1)
for x in cols + cols2: d.line([x, y0, x, y0+rowH*(len(N)+1)], fill="black", width=1)
im.save(sys.argv[1])
