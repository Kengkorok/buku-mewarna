#!/usr/bin/env python3
"""Generate coloring pages (SVG line-art, region-based) -> site/pages.js

Every colorable shape is emitted with class "r" (region) so the web app can
flood-fill it by tapping. Decorative strokes use class "d", solid dots "f".
All pages use a 400x400 viewBox.
"""
import json
import math
import os

W = 4  # stroke width


# ---------------------------------------------------------------- helpers
def R(d, evenodd=False):
    extra = ' fill-rule="evenodd"' if evenodd else ""
    return f'<path class="r" d="{d}"{extra}/>'


def C(cx, cy, r):
    return f'<circle class="r" cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}"/>'


def E(cx, cy, rx, ry, rot=0):
    t = f' transform="rotate({rot:.1f} {cx:.1f} {cy:.1f})"' if rot else ""
    return f'<ellipse class="r" cx="{cx:.1f}" cy="{cy:.1f}" rx="{rx:.1f}" ry="{ry:.1f}"{t}/>'


def RC(x, y, w, h, rx=0, rot=None, cx=None, cy=None):
    t = f' transform="rotate({rot:.1f} {cx} {cy})"' if rot is not None else ""
    return f'<rect class="r" x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{rx:.1f}"{t}/>'


def P(pts):
    d = "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in pts) + " Z"
    return R(d)


def D(d):
    return f'<path class="d" d="{d}"/>'


def DC(cx, cy, r):
    return f'<circle class="f" cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}"/>'


def DE(cx, cy, rx, ry, rot=0):
    t = f' transform="rotate({rot:.1f} {cx:.1f} {cy:.1f})"' if rot else ""
    return f'<ellipse class="f" cx="{cx:.1f}" cy="{cy:.1f}" rx="{rx:.1f}" ry="{ry:.1f}"{t}/>'


def DL(x1, y1, x2, y2):
    return f'<line class="d" x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}"/>'


def ring_band(cx, cy, r_out, r_in, y_base, a0=180, a1=360):
    """Half-ring band (used for rainbow arcs)."""
    x0o, y0o = cx + r_out * math.cos(math.radians(a0)), y_base + r_out * math.sin(math.radians(a0))
    x1o, y1o = cx + r_out * math.cos(math.radians(a1)), y_base + r_out * math.sin(math.radians(a1))
    x0i, y0i = cx + r_in * math.cos(math.radians(a0)), y_base + r_in * math.sin(math.radians(a0))
    x1i, y1i = cx + r_in * math.cos(math.radians(a1)), y_base + r_in * math.sin(math.radians(a1))
    return R(
        f"M{x0o:.1f},{y0o:.1f} A{r_out:.1f},{r_out:.1f} 0 0 1 {x1o:.1f},{y1o:.1f} "
        f"L{x1i:.1f},{y1i:.1f} A{r_in:.1f},{r_in:.1f} 0 0 0 {x0i:.1f},{y0i:.1f} Z"
    )


def star(cx, cy, ro, ri=None, points=5, rot=-90):
    ri = ri if ri is not None else ro * 0.45
    pts = []
    for i in range(points * 2):
        a = math.radians(rot + i * 180.0 / points)
        rad = ro if i % 2 == 0 else ri
        pts.append((cx + rad * math.cos(a), cy + rad * math.sin(a)))
    return P(pts)


def petals(cx, cy, count, dist, rx, ry, start=0, jitter_rot=True):
    out = []
    for k in range(count):
        a = start + k * (360.0 / count)
        rad = math.radians(a)
        px, py = cx + dist * math.cos(rad), cy + dist * math.sin(rad)
        out.append(E(px, py, rx, ry, rot=a + 90 if jitter_rot else 0))
    return "".join(out)


def rays(cx, cy, count, r0, r1, half_w):
    """Triangular sun rays."""
    out = []
    for k in range(count):
        a = math.radians(k * (360.0 / count))
        tipx, tipy = cx + r1 * math.cos(a), cy + r1 * math.sin(a)
        b = math.radians(k * (360.0 / count) + half_w)
        c = math.radians(k * (360.0 / count) - half_w)
        p1 = (cx + r0 * math.cos(b), cy + r0 * math.sin(b))
        p2 = (cx + r0 * math.cos(c), cy + r0 * math.sin(c))
        out.append(P([p1, (tipx, tipy), p2]))
    return "".join(out)


def cloud(cx, cy, s=1.0):
    return (
        E(cx - 45 * s, cy, 40 * s, 30 * s)
        + E(cx, cy - 12 * s, 48 * s, 38 * s)
        + E(cx + 45 * s, cy + 4 * s, 34 * s, 26 * s)
        + E(cx + 5 * s, cy + 14 * s, 60 * s, 22 * s)
    )


def face(cy, dx=35, r=11, mouth=None):
    out = DC(200 - dx, cy, r) + DC(200 + dx, cy, r)
    if mouth:
        out += D(mouth)
    return out


# ---------------------------------------------------------------- pages
def cat():
    s = P([(120, 125), (100, 32), (188, 88)]) + P([(280, 125), (300, 32), (212, 88)])
    s += E(200, 345, 100, 55)
    s += C(140, 372, 26) + C(260, 372, 26)
    s += C(200, 190, 96)
    s += D("M134,112 L176,146 M266,112 L224,146")
    s += face(180, 38, 12)
    s += D("M200,214 l-16,14 h32 z")
    s += D("M200,228 q-14,16 -28,4 M200,228 q14,16 28,4")
    s += D("M112,196 L58,182 M112,212 L60,214 M288,196 L342,182 M288,212 L340,214")
    return s


def dog():
    s = E(108, 180, 34, 64, rot=-18) + E(292, 180, 34, 64, rot=18)
    s += E(200, 330, 100, 62)
    s += RC(140, 360, 48, 46, 20) + RC(212, 360, 48, 46, 20)
    s += C(200, 185, 92)
    s += E(200, 238, 58, 44)
    s += E(200, 212, 24, 16)
    s += face(168, 34, 11)
    s += DC(200, 212, 11)
    s += D("M200,228 v14 M200,242 q-16,18 -30,4 M200,242 q16,18 30,4")
    s += E(200, 288, 17, 24) + D("M200,270 v24")
    return s


def rabbit():
    s = E(162, 92, 28, 78, rot=-10) + E(238, 92, 28, 78, rot=10)
    s += DE(162, 92, 12, 52, rot=-10) + DE(238, 92, 12, 52, rot=10)
    s += E(200, 340, 96, 58)
    s += E(140, 380, 40, 24) + E(260, 380, 40, 24)
    s += C(200, 212, 82)
    s += face(200, 34, 12)
    s += D("M200,228 l-14,12 h28 z")
    s += D("M200,240 q-16,16 -30,2 M200,240 q16,16 30,2")
    s += D("M126,224 L74,212 M126,240 L76,242 M274,224 L326,212 M274,240 L324,242")
    return s


def bear():
    s = C(126, 118, 44) + C(274, 118, 44)
    s += E(200, 335, 104, 64)
    s += C(96, 300, 38) + C(304, 300, 38)
    s += E(150, 385, 42, 24) + E(250, 385, 42, 24)
    s += C(200, 190, 94)
    s += E(200, 240, 60, 46)
    s += E(200, 214, 24, 16)
    s += face(170, 35, 11)
    s += DC(200, 214, 11)
    s += D("M200,230 v12 M200,242 q-16,16 -30,2 M200,242 q16,16 30,2")
    return s


def panda():
    s = C(122, 112, 46) + C(278, 112, 46)
    s += E(200, 335, 102, 62)
    s += C(92, 300, 36) + C(308, 300, 36)
    s += C(200, 190, 100)
    s += E(155, 176, 33, 42, rot=-12) + E(245, 176, 33, 42, rot=12)
    s += DC(155, 176, 12) + DC(245, 176, 12)
    s += E(200, 236, 24, 16)
    s += DC(200, 236, 10)
    s += D("M200,252 q-16,16 -30,2 M200,252 q16,16 30,2")
    return s


def elephant():
    s = E(200, 300, 118, 78)
    s += RC(112, 348, 52, 44, 18) + RC(176, 356, 50, 38, 18)
    s += RC(238, 356, 50, 38, 18) + RC(300, 344, 52, 46, 18)
    s += E(200, 212, 86, 74)
    s += E(108, 200, 46, 64, rot=-14) + E(292, 200, 46, 64, rot=14)
    s += R("M180,250 C158,312 166,354 200,366 C232,354 240,312 220,250 Z")
    s += D("M182,336 q18,10 36,0")
    s += DC(166, 192, 10) + DC(234, 192, 10)
    s += D("M160,236 q-18,26 -8,44 M240,236 q18,26 8,44")
    return s


def lion():
    s = petals(200, 200, 13, 96, 40, 50)
    s += C(200, 200, 82)
    s += DC(172, 186, 11) + DC(228, 186, 11)
    s += E(200, 228, 46, 34)
    s += D("M200,214 l-14,12 h28 z")
    s += D("M200,228 q-16,18 -30,2 M200,228 q16,18 30,2")
    s += D("M150,168 q22,-14 44,-4 M250,168 q-22,-14 -44,-4")
    return s


def fish():
    s = R("M62,200 C62,138 132,108 200,108 C268,108 320,148 320,200 "
          "C320,252 268,292 200,292 C132,292 62,262 62,200 Z")
    s += P([(318, 200), (386, 142), (386, 258)])
    s += P([(150, 112), (200, 48), (244, 118)])
    s += P([(160, 288), (200, 350), (232, 284)])
    s += DC(108, 174, 14)
    s += D("M108,174 a14,14 0 0 0 0,26")
    s += D("M170,130 q14,70 0,140 M212,120 q16,80 0,160 M254,132 q14,68 0,136")
    s += C(70, 84, 15) + C(40, 52, 10)
    return s


def butterfly():
    s = E(126, 158, 62, 82, rot=-26) + E(274, 158, 62, 82, rot=26)
    s += E(140, 274, 52, 62, rot=-16) + E(260, 274, 52, 62, rot=16)
    s += E(200, 218, 20, 92)
    s += C(200, 112, 27)
    s += D("M186,90 q-24,-34 -46,-40 M214,90 q24,-34 46,-40")
    s += DC(138, 48, 8) + DC(262, 48, 8)
    s += DC(150, 158, 15) + DC(250, 158, 15)
    s += DC(160, 272, 12) + DC(240, 272, 12)
    return s


def turtle():
    s = C(200, 96, 46)
    s += DC(184, 88, 8) + DC(216, 88, 8)
    s += D("M200,112 q-14,14 -26,2 M200,112 q14,14 26,2")
    s += E(200, 234, 122, 96)
    s += D("M200,234 m0,-46 a46,46 0 0 1 0,92 a46,46 0 0 1 0,-92")
    s += D("M158,214 l-46,-34 M242,214 l46,-34 M156,262 l-44,36 M244,262 l44,36")
    s += E(96, 292, 40, 28, rot=-20) + E(304, 292, 40, 28, rot=20)
    s += E(112, 344, 38, 26, rot=14) + E(288, 344, 38, 26, rot=-14)
    return s


def car():
    s = R("M38,272 L38,216 Q38,196 62,196 L122,196 L156,136 Q166,120 186,120 "
          "L266,120 Q286,120 294,138 L322,196 L348,206 Q366,214 366,236 L366,272 Z")
    s += R("M150,190 L150,138 Q150,132 160,132 L212,132 L212,190 Z")
    s += R("M226,132 L262,132 Q276,132 282,148 L302,190 L226,190 Z")
    s += C(118, 274, 44) + C(118, 274, 17)
    s += C(288, 274, 44) + C(288, 274, 17)
    s += E(362, 226, 10, 16)
    s += D("M212,196 L212,272")
    return s


def bus():
    s = RC(38, 118, 324, 182, 24)
    s += RC(58, 138, 82, 62, 10)
    s += RC(154, 138, 70, 62, 10)
    s += RC(238, 138, 70, 62, 10)
    s += RC(300, 150, 46, 112, 8)
    s += C(112, 306, 40) + C(112, 306, 15)
    s += C(286, 306, 40) + C(286, 306, 15)
    s += C(52, 250, 12)
    return s


def truck():
    s = RC(148, 116, 214, 156, 12)
    s += R("M38,272 L38,168 Q38,152 54,152 L142,152 L142,272 Z")
    s += RC(54, 168, 72, 52, 8)
    s += C(94, 288, 36) + C(94, 288, 13)
    s += C(216, 288, 36) + C(216, 288, 13)
    s += C(304, 288, 36) + C(304, 288, 13)
    return s


def rocket():
    s = R("M200,28 C252,80 266,150 266,232 L134,232 C134,150 148,80 200,28 Z")
    s += C(200, 152, 44)
    s += C(200, 152, 27)
    s += P([(134, 178), (86, 272), (134, 272)]) + P([(266, 178), (314, 272), (266, 272)])
    s += RC(132, 230, 136, 32, 8)
    s += P([(158, 264), (200, 352), (242, 264)])
    s += P([(178, 264), (200, 316), (222, 264)])
    return s


def boat():
    s = RC(194, 116, 12, 154, 6)
    s += P([(188, 132), (86, 256), (188, 256)])
    s += P([(212, 146), (312, 256), (212, 256)])
    s += P([(200, 74), (240, 108), (200, 108)])
    s += R("M58,270 L342,270 L310,332 L90,332 Z")
    s += D("M20,352 q26,-14 52,0 t52,0 t52,0 t52,0 t52,0 t52,0")
    return s


def bike():
    s = C(114, 292, 62) + C(114, 292, 48)
    s += C(286, 292, 62) + C(286, 292, 48)
    s += P([(114, 292), (176, 188), (206, 292)])
    s += P([(206, 292), (176, 188), (250, 188), (286, 292)])
    s += E(246, 176, 30, 13)
    s += D("M176,188 L152,146 M138,138 L176,140")
    s += C(200, 292, 16)
    return s


def icecream():
    s = P([(140, 222), (260, 222), (200, 380)])
    s += D("M150,246 L250,246 M160,272 L240,272 M172,300 L228,300 M182,328 L218,328")
    s += C(158, 186, 56) + C(242, 186, 56) + C(200, 122, 56)
    s += C(200, 58, 19)
    s += D("M200,40 q6,-24 26,-28")
    return s


def donut():
    s = R("M200,58 A142,142 0 1 0 200,342 A142,142 0 1 0 200,58 Z "
          "M200,155 A45,45 0 1 1 200,245 A45,45 0 1 1 200,155 Z", evenodd=True)
    sprinkles = []
    for i in range(12):
        a = math.radians(i * 30 + 12)
        x, y = 200 + 100 * math.cos(a), 200 + 100 * math.sin(a)
        sprinkles.append(RC(x - 11, y - 5, 22, 10, 5, rot=i * 30 + 40, cx=x, cy=y))
    s += "".join(sprinkles)
    return s


def cake():
    s = E(200, 344, 152, 22)
    s += RC(84, 250, 232, 84, 10)
    s += R("M84,250 L84,214 C100,196 118,214 134,200 C150,186 168,206 186,196 "
           "C204,186 220,206 238,196 C256,186 274,204 292,196 C306,190 314,202 316,214 "
           "L316,250 Z")
    s += RC(190, 110, 22, 76, 8)
    s += P([(201, 74), (218, 106), (184, 106)])
    s += D("M84,290 L316,290")
    return s


def apple():
    s = R("M200,124 C152,92 78,122 78,202 C78,292 140,362 200,362 "
          "C260,362 322,292 322,202 C322,122 248,92 200,124 Z")
    s += R("M204,112 C226,60 288,56 302,76 C304,110 250,132 204,112 Z")
    s += R("M196,116 q-10,-42 4,-64 q12,-2 14,10 q-10,28 -8,54 Z")
    s += D("M120,180 q-14,60 24,104")
    return s


def strawberry():
    s = R("M200,362 C120,304 88,222 118,172 C148,120 252,120 282,172 "
          "C312,222 280,304 200,362 Z")
    s += P([(200, 146), (140, 96), (200, 104)]) + P([(200, 146), (260, 96), (200, 104)])
    s += P([(200, 146), (200, 84), (176, 118)]) + P([(200, 146), (200, 84), (224, 118)])
    for i, (x, y) in enumerate([(150, 210), (200, 196), (250, 210), (172, 254),
                                (228, 254), (200, 300), (140, 246), (260, 246)]):
        s += RC(x - 10, y - 4, 20, 8, 4, rot=i * 25, cx=x, cy=y)
    return s


def hotchoc():
    s = ""
    s += R("M110,182 L290,182 L274,344 L126,344 Z")
    s += R("M292,206 C342,206 348,296 288,300 L288,274 C318,270 316,230 292,232 Z")
    s += E(200, 182, 90, 24)
    s += RC(160, 148, 46, 34, 9) + RC(220, 154, 42, 30, 9)
    s += D("M162,116 q-14,-20 2,-34 M200,108 q-14,-20 2,-34 M240,116 q-14,-20 2,-34")
    return s


def house():
    s = ""
    s += RC(272, 98, 40, 66, 4)
    s += P([(56, 196), (200, 66), (344, 196)])
    s += RC(88, 192, 224, 162, 8)
    s += RC(168, 262, 64, 92, 8)
    s += RC(110, 226, 58, 58, 6) + RC(232, 226, 58, 58, 6)
    s += D("M139,226 L139,284 M110,255 L168,255 M261,226 L261,284 M232,255 L290,255")
    s += C(62, 62, 34) + rays(62, 62, 8, 40, 62, 10)
    s += D("M20,364 q40,-14 80,0 t80,0 t80,0 t80,0")
    return s


def tree():
    s = ""
    s += RC(178, 232, 44, 128, 10)
    s += C(200, 176, 92) + C(126, 226, 62) + C(274, 226, 62)
    s += C(160, 152, 20) + C(246, 196, 20) + C(200, 116, 20)
    s += E(200, 372, 164, 24)
    s += D("M178,300 q-24,10 -34,26 M222,300 q24,10 34,26")
    return s


def flower():
    s = ""
    s += RC(194, 240, 14, 126, 7)
    s += E(152, 296, 46, 22, rot=-30) + E(248, 296, 46, 22, rot=30)
    s += petals(200, 200, 6, 70, 44, 60)
    s += C(200, 200, 46)
    s += DC(200, 200, 12) + DC(200, 176, 8) + DC(200, 224, 8) + DC(176, 200, 8) + DC(224, 200, 8)
    return s


def sun():
    s = ""
    s += rays(200, 176, 12, 92, 162, 12)
    s += C(200, 176, 90)
    s += DC(172, 160, 11) + DC(228, 160, 11)
    s += D("M170,200 q30,28 60,0")
    s += cloud(96, 318, 0.85) + cloud(300, 336, 0.7)
    return s


def rainbow():
    s = ""
    radii = [(186, 158), (158, 130), (130, 102), (102, 74), (74, 46)]
    for ro, ri in radii:
        s += ring_band(200, 300, ro, ri, 300)
    s += cloud(76, 302, 0.8) + cloud(324, 302, 0.8)
    return s


def moon():
    s = ""
    s += R("M244,54 A152,152 0 1 0 244,346 A118,118 0 1 1 244,54 Z")
    s += star(96, 84, 30) + star(320, 120, 26) + star(70, 250, 24)
    s += star(300, 268, 30) + star(180, 372, 22) + star(340, 350, 20)
    s += cloud(120, 330, 0.55)
    s += DC(174, 178, 12) + DC(232, 178, 12)
    s += D("M172,212 q30,26 60,4")
    return s


def robot():
    s = ""
    s += DC(200, 40, 16) + D("M200,56 L200,80")
    s += RC(128, 80, 144, 112, 18)
    s += RC(158, 112, 34, 34, 8) + RC(208, 112, 34, 34, 8)
    s += DC(175, 129, 9) + DC(225, 129, 9)
    s += RC(174, 158, 52, 14, 7)
    s += RC(70, 208, 42, 92, 14) + RC(288, 208, 42, 92, 14)
    s += RC(118, 200, 164, 122, 16)
    s += C(200, 236, 17) + C(200, 282, 17)
    s += RC(146, 326, 42, 52, 10) + RC(212, 326, 42, 52, 10)
    s += E(167, 380, 40, 18) + E(233, 380, 40, 18)
    return s


def dino():
    s = ""
    s += P([(296, 250), (382, 330), (306, 320)])
    s += E(196, 252, 112, 92)
    s += RC(158, 316, 42, 62, 12) + RC(228, 316, 42, 62, 12)
    s += E(178, 380, 36, 16) + E(250, 380, 36, 16)
    s += C(150, 126, 60)
    s += P([(202, 168), (228, 106), (242, 182)])
    s += P([(246, 186), (290, 138), (292, 208)])
    s += P([(294, 216), (332, 190), (324, 242)])
    s += DC(132, 112, 11)
    s += D("M118,150 q28,22 58,6")
    return s


PAGES = [
    ("kucing", "Kucing", "haiwan", cat),
    ("anjing", "Anjing", "haiwan", dog),
    ("arnab", "Arnab", "haiwan", rabbit),
    ("beruang", "Beruang", "haiwan", bear),
    ("panda", "Panda", "haiwan", panda),
    ("gajah", "Gajah", "haiwan", elephant),
    ("singa", "Singa", "haiwan", lion),
    ("ikan", "Ikan", "haiwan", fish),
    ("ramabrama", "Rama-rama", "haiwan", butterfly),
    ("kurakura", "Kura-kura", "haiwan", turtle),
    ("kereta", "Kereta", "kenderaan", car),
    ("bas", "Bas", "kenderaan", bus),
    ("lori", "Lori", "kenderaan", truck),
    ("roket", "Roket", "kenderaan", rocket),
    ("kapal", "Kapal", "kenderaan", boat),
    ("basikal", "Basikal", "kenderaan", bike),
    ("aiskrim", "Ais Krim", "makanan", icecream),
    ("donut", "Donut", "makanan", donut),
    ("kek", "Kek", "makanan", cake),
    ("epal", "Epal", "makanan", apple),
    ("strawberi", "Strawberi", "makanan", strawberry),
    ("coklat", "Coklat Panas", "makanan", hotchoc),
    ("rumah", "Rumah", "alam", house),
    ("pokok", "Pokok", "alam", tree),
    ("bunga", "Bunga", "alam", flower),
    ("matahari", "Matahari", "alam", sun),
    ("pelangi", "Pelangi", "alam", rainbow),
    ("bulan", "Bulan & Bintang", "alam", moon),
    ("robot", "Robot", "lain", robot),
    ("dino", "Dino", "lain", dino),
]

if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    out = os.path.join(here, "..", "site", "pages.js")
    data = []
    for pid, title, cat, fn in PAGES:
        svg = fn()
        data.append({"id": pid, "title": title, "cat": cat, "svg": svg})
    js = "window.PAGES = " + json.dumps(data, ensure_ascii=False) + ";\n"
    with open(out, "w", encoding="utf-8") as f:
        f.write(js)
    print(f"wrote {out}: {len(data)} pages, {len(js)} bytes")
