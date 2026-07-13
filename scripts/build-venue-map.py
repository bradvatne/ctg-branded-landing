#!/usr/bin/env python3
"""Generate a stylized aerial beach-club map SVG + hotspot coordinate JSON.

Output: venue-map.svg (1536x1152) and hotspots.json (percent coords).
Visual language: soft flat-3D resort masterplan — sand, sea, pool deck,
daybeds, cabanas, sunbeds, palms. No text, no brand.
"""
import json, math, random

W, H = 1536, 1152
random.seed(7)

svg = []
defs = f'''
<defs>
  <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#7adde0"/><stop offset=".55" stop-color="#3fbfc9"/><stop offset="1" stop-color="#1d9fb0"/>
  </linearGradient>
  <linearGradient id="pool" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#8ef0ea"/><stop offset="1" stop-color="#2cc4cf"/>
  </linearGradient>
  <linearGradient id="sand" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#f7e5c2"/><stop offset="1" stop-color="#f0d9ae"/>
  </linearGradient>
  <linearGradient id="deck" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#fdfaf3"/><stop offset="1" stop-color="#f3ece0"/>
  </linearGradient>
  <radialGradient id="palm" cx=".5" cy=".45" r=".6">
    <stop offset="0" stop-color="#4fae62"/><stop offset="1" stop-color="#2e7d44"/>
  </radialGradient>
  <filter id="soft" x="-40%" y="-40%" width="180%" height="180%">
    <feDropShadow dx="0" dy="7" stdDeviation="9" flood-color="#3c2f1a" flood-opacity=".18"/>
  </filter>
  <filter id="softsm" x="-60%" y="-60%" width="220%" height="220%">
    <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#3c2f1a" flood-opacity=".22"/>
  </filter>
</defs>'''
svg.append(defs)

# ---- ground: garden band (top), deck, sand, sea (bottom) ----
svg.append(f'<rect width="{W}" height="{H}" fill="#8fbf74"/>')
svg.append(f'<rect x="0" y="150" width="{W}" height="{H}" fill="url(#deck)"/>')
svg.append(f'<rect x="0" y="{H-430}" width="{W}" height="430" fill="url(#sand)"/>')
# sea with foam edges
svg.append(f'<path d="M0 {H-210} Q {W*.2} {H-238} {W*.45} {H-212} T {W} {H-218} L {W} {H} L 0 {H} Z" fill="url(#sea)"/>')
for i, (dy, op, sw) in enumerate([(4,.85,7),(26,.5,5),(52,.3,4)]):
    svg.append(f'<path d="M0 {H-210+dy} Q {W*.2} {H-238+dy} {W*.45} {H-212+dy} T {W} {H-218+dy}" fill="none" stroke="#ffffff" stroke-opacity="{op}" stroke-width="{sw}" stroke-linecap="round"/>')

# subtle deck board lines
for x in range(120, W, 148):
    svg.append(f'<line x1="{x}" y1="160" x2="{x}" y2="{H-420}" stroke="#e2d7c2" stroke-width="2" opacity=".55"/>')

# ---- pool (freeform, center) ----
pool = f'M 560 380 C 500 330 560 250 680 258 C 800 264 940 240 1030 280 C 1130 324 1150 430 1080 490 C 1030 534 950 520 880 540 C 780 568 660 560 600 500 C 552 452 596 420 560 380 Z'
svg.append(f'<path d="{pool}" fill="#d9f6f4" transform="translate(6,10)" opacity=".8"/>')
svg.append(f'<path d="{pool}" fill="none" stroke="#e8dfc9" stroke-width="34" opacity=".8"/>')
svg.append(f'<path d="{pool}" fill="url(#pool)" stroke="#ffffff" stroke-width="11" filter="url(#soft)"/>')
# pool shimmer
svg.append('<path d="M640 360 q60 -26 150 -14 M700 430 q80 -20 180 -6 M660 480 q70 18 160 8" stroke="#ffffff" stroke-opacity=".5" stroke-width="6" fill="none" stroke-linecap="round"/>')

hotspots = []  # {id,name,zone,x%,y%,w%,h%,price,min,cap}

def pct(x, y, w, h):
    return round(x/W*100,2), round(y/H*100,2), round(w/W*100,2), round(h/H*100,2)

def daybed(x, y, rot=0, scale=1.0):
    """white canopy daybed ~70x54"""
    w, hh = 70*scale, 54*scale
    svg.append(f'<g transform="translate({x},{y}) rotate({rot})" filter="url(#softsm)">'
               f'<rect x="{-w/2}" y="{-hh/2}" width="{w}" height="{hh}" rx="10" fill="#ffffff"/>'
               f'<rect x="{-w/2+5}" y="{-hh/2+5}" width="{w-10}" height="{hh-10}" rx="7" fill="#efe6d1"/>'
               f'<rect x="{-w/2+5}" y="{-hh/2+5}" width="{w-10}" height="{(hh-10)*.36}" rx="6" fill="#d9c9a4"/>'
               f'<rect x="{-w/2+10}" y="{hh/2-14}" width="{w-20}" height="6" rx="3" fill="#ffffff" opacity=".8"/></g>')

def cabana(x, y):
    """thatch cabana ~120x96"""
    svg.append(f'<g transform="translate({x},{y})" filter="url(#soft)">'
               f'<rect x="-60" y="-48" width="120" height="96" rx="14" fill="#d9b077"/>'
               f'<rect x="-60" y="-48" width="120" height="96" rx="14" fill="none" stroke="#c39a5f" stroke-width="4"/>'
               + ''.join(f'<line x1="{-46+i*16}" y1="-44" x2="{-56+i*16}" y2="44" stroke="#c39a5f" stroke-width="3" opacity=".7"/>' for i in range(7))
               + '<rect x="-38" y="-26" width="76" height="52" rx="8" fill="#fdf8ec"/></g>')

def sunbed_pair(x, y):
    """two loungers + umbrella ~66 wide"""
    svg.append(f'<g transform="translate({x},{y})" filter="url(#softsm)">'
               f'<rect x="-30" y="-10" width="24" height="44" rx="6" fill="#fffdf6"/>'
               f'<rect x="4" y="-10" width="24" height="44" rx="6" fill="#fffdf6"/>'
               f'<circle cx="0" cy="-22" r="24" fill="#f6dfae" stroke="#eccb87" stroke-width="3"/>'
               f'<circle cx="0" cy="-22" r="3.6" fill="#caa25f"/></g>')

def palm(x, y, r=34):
    frond = (f'M0 0 C {r*.18} {-r*.35} {r*.3} {-r*.75} 0 {-r*1.05} '
             f'C {-r*.3} {-r*.75} {-r*.18} {-r*.35} 0 0 Z')
    fronds = ''.join(
        f'<path d="{frond}" fill="{c}" transform="rotate({a})"/>'
        for a, c in zip(range(0, 360, 40),
            ['#2f8047','#3c9455','#2a7440','#37884d','#2f8047','#3c9455','#2a7440','#37884d','#2f8047']))
    svg.append(f'<g transform="translate({x},{y})" filter="url(#softsm)">'
               f'<circle r="{r*.9}" fill="#245f36" opacity=".25"/>{fronds}'
               f'<circle r="{r*.14}" fill="#5f4426"/></g>')

# ---- VIP cabanas (left column) ----
cab_pos = [(150, 320), (150, 470), (150, 620)]
for i, (x, y) in enumerate(cab_pos):
    cabana(x, y)
    px, py, pw, ph = pct(x, y, 132, 108)
    hotspots.append(dict(id=f"cab{i+1}", name=f"VIP Cabana {i+1}", zone="vip",
                         x=px, y=py, w=pw, h=ph, price=0, min=400, cap=8))

# ---- pool daybeds (ring the pool) ----
bed_pos = [(590,250,-8),(700,212,0),(820,200,4),(940,208,8),(1060,232,14),
           (1150,330,90),(1160,450,90),
           (620,580,6),(740,606,0),(860,614,-4),(980,600,-8),(1090,560,-14),
           (500,430,90),(505,540,90)]
for i, (x, y, rot) in enumerate(bed_pos):
    daybed(x, y, rot)
    px, py, pw, ph = pct(x, y, 78, 62)
    hotspots.append(dict(id=f"db{i+1}", name=f"Pool Daybed {i+1}", zone="pool",
                         x=px, y=py, w=pw, h=ph, price=0, min=150, cap=4))

# ---- pool bar + DJ (right) ----
svg.append(f'<g transform="translate(1330,410)" filter="url(#soft)">'
           f'<circle r="64" fill="#f7f2e6" stroke="#e4d9c2" stroke-width="6"/>'
           f'<circle r="30" fill="#d9b077"/>'
           + ''.join(f'<circle cx="{48*math.cos(a/6*2*math.pi)}" cy="{48*math.sin(a/6*2*math.pi)}" r="8" fill="#ffffff" stroke="#e4d9c2" stroke-width="2"/>' for a in range(6))
           + '</g>')
svg.append(f'<g transform="translate(1330,610)" filter="url(#soft)">'
           f'<circle r="52" fill="#241f3d"/><circle r="34" fill="#39306b"/><circle r="13" fill="#8b7cf7"/></g>')

# ---- beachfront: sunbed rows + premium beach beds ----
for i in range(9):
    sunbed_pair(180 + i*150, H-330)
beach_beds = [(330, H-480), (620, H-470), (910, H-470), (1200, H-480)]
for i, (x, y) in enumerate(beach_beds):
    daybed(x, y, 0, 1.25)
    px, py, pw, ph = pct(x, y, 96, 76)
    hotspots.append(dict(id=f"bb{i+1}", name=f"Beachfront Bale {i+1}", zone="beach",
                         x=px, y=py, w=pw, h=ph, price=0, min=250, cap=6))

# ---- palms & greenery ----
for x, y, r in [(70,180,38),(240,168,30),(430,180,36),(640,166,28),(850,178,34),(1060,168,30),(1260,180,36),(1460,170,32),
                (70,760,34),(1480,760,34),(60,520,30),(1480,300,30),
                (450,700,26),(1000,700,26),(260,560,24),(1220,700,28)]:
    palm(x, y, r)

# sand speckle
for i in range(90):
    x = random.uniform(20, W-20); y = random.uniform(H-420, H-250)
    svg.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{random.uniform(1.5,3):.1f}" fill="#dcc491" opacity=".7"/>')
# garden hedge depth (top band)
svg.append(f'<rect x="0" y="120" width="{W}" height="34" rx="17" fill="#79ab60"/>')
# frame vignette
svg.append(f'<rect width="{W}" height="{H}" fill="none"/>')

body = ''.join(svg)
out = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" '
       f'preserveAspectRatio="xMidYMid slice">{body}</svg>')
open('venue-map.svg', 'w').write(out)
json.dump(hotspots, open('hotspots.json', 'w'), indent=1)
print(f"svg bytes: {len(out)}, hotspots: {len(hotspots)}")
