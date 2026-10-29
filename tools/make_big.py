# Ölçek testi: 108 kişi, 3 görsel (her biri 36 kişi), gri başlık
import sys, random
from PIL import Image, ImageDraw, ImageFont
from datetime import date, timedelta
F = lambda s, b=False: ImageFont.truetype(f"/usr/share/fonts/truetype/liberation/LiberationSans{'-Bold' if b else '-Regular'}.ttf", s)
AD = ["Ahmet","Ayşe","Mehmet","Fatma","Mustafa","Zeynep","Emre","Elif","Hasan","Merve","Ali","Esra","Burak","Gamze","Serkan","Derya","Oğuz","Büşra","Cem","Seda","Kemal","Hülya","Volkan","Sevgi","Tolga","Gül","Murat","Ebru","Kaan","İrem","Sinan","Pınar","Yusuf","Aslı","Onur","Nur"]
SOY = ["Yılmaz","Demir","Kaya","Çelik","Şahin","Öztürk","Aydın","Arslan","Doğan","Koç","Kılıç","Kurt","Özdemir","Aslan","Polat","Yıldız","Erdoğan","Güneş","Aksoy","Karaca","Uçar","Tekin","Bulut","Ünal","Işık","Akın","Çakır","Şen","Yavuz","Duman","Eren","Uysal","Bal","Tunç","Ateş","Er"]
start = date(2026, 11, 2); days = 14; rowH, nameW, cellW = 24, 190, 34
for g in "123":
    random.seed(int(g)); names = [f"{AD[(i*7+int(g)*5) % 36]} {SOY[(i*11+int(g)*3) % 36]}" for i in range(36)]
    W = 10 + 30 + nameW + cellW*days + 10; H = 50 + rowH*37 + 10
    im = Image.new("RGB", (W, H), "white"); d = ImageDraw.Draw(im)
    d.text((10, 12), f"{g}. VARDİYA  02.11.2026 - 15.11.2026", font=F(18, True), fill="black")
    y0 = 50; d.rectangle([10, y0, W-10, y0+rowH], fill=(217,217,217))
    d.text((44, y0+5), "Adı Soyadı", font=F(13, True), fill="black")
    for i in range(days): d.text((10+30+nameW+i*cellW+8, y0+5), f"{(start+timedelta(days=i)).day:02d}", font=F(13, True), fill="black")
    for r, n in enumerate(names):
        y = y0 + rowH*(r+1); d.text((14, y+5), str(r+1), font=F(12), fill="black"); d.text((44, y+5), n, font=F(13), fill="black")
        offs = {(r*2) % 7, (r*2+1) % 7}
        for i in range(days):
            x = 10+30+nameW+i*cellW
            if i % 7 in offs: d.rectangle([x, y, x+cellW, y+rowH], fill=(255,0,0)); d.text((x+5, y+6), "OFF", font=F(11, True), fill="white")
            elif r % 9 == 4 and i == 10: d.text((x+12, y+4), "R", font=F(14, True), fill="black")
            else: d.text((x+13, y+4), g, font=F(14), fill="black")
    for k in range(38): d.line([10, y0+k*rowH, W-10, y0+k*rowH], fill="black", width=1)
    for x in [10, 40, 40+nameW] + [40+nameW+cellW*(i+1) for i in range(days)]: d.line([x, y0, x, y0+rowH*37], fill="black", width=1)
    im.save(f"{sys.argv[1]}/buyuk-{g}.png")
