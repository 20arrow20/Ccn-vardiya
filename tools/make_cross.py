# Tablolar arası: 1. vardiya tablosunda "2", 2. vardiya tablosunda "1" ve "08-16" yazan günler; iki tabloda da olan kişi
import sys
src = open(sys.path[0] + '/make_multi.py').read().split('A = [')[0]
exec(src)
A = ["Ahmet Yılmaz","Ayşe Demir","Mehmet Kaya","Fatma Çelik","Mustafa Şahin"]
C = ["Ali Kılıç","Esra Kurt","Burak Özdemir","Gamze Aslan","Fatma Çelik"]
im = Image.new("RGB", (900, 330), "white"); d = ImageDraw.Draw(im)
table(d, 10, 10, A, "1", "1. VARDİYA 02.11.2026 - 15.11.2026", odd={(1, 2): "2"})
im.save(sys.argv[1] + "/capraz-1.png")
im = Image.new("RGB", (900, 330), "white"); d = ImageDraw.Draw(im)
table(d, 10, 10, C, "2", "2. VARDİYA 02.11.2026 - 15.11.2026", odd={(0, 2): "1", (1, 3): "08-16"})
im.save(sys.argv[1] + "/capraz-2.png")
