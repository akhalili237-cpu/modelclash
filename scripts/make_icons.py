#!/usr/bin/env python3
"""Generates ModelClash PWA PNG icons (192, 512) matching the SVG favicon style."""
from PIL import Image, ImageDraw
import math
import os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'icons')
os.makedirs(OUT, exist_ok=True)

INK = (10, 10, 15, 255)
LINE = (38, 38, 55, 255)
SILVER = (226, 232, 240, 255)
SILVER2 = (148, 163, 184, 255)
ORANGE = (249, 115, 22, 255)
PINK = (236, 72, 153, 255)
GOLD = (250, 204, 21, 255)


def lerp(c1, c2, t):
    return tuple(int(a + (b - a) * t) for a, b in zip(c1, c2))


def draw_sword(d, p0, p1, color_start, color_end, w, hilt_color):
    # blade with 3 gradient segments
    for i, (a, b) in enumerate(((0.0, 0.4), (0.4, 0.75), (0.75, 1.0))):
        pa = (p0[0] + (p1[0] - p0[0]) * a, p0[1] + (p1[1] - p0[1]) * a)
        pb = (p0[0] + (p1[0] - p0[0]) * b, p0[1] + (p1[1] - p0[1]) * b)
        c = lerp(color_start, color_end, (a + b) / 2)
        d.line([pa, pb], fill=c, width=w)
    # hilt perpendicular to the blade near the tip
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    length = math.hypot(dx, dy)
    ux, uy = dx / length, dy / length
    px, py = -uy, ux
    tip = (p0[0] + dx * 0.82, p0[1] + dy * 0.82)
    hl = 0.11
    a = (tip[0] - px * hl * length, tip[1] - py * hl * length)
    b = (tip[0] + px * hl * length, tip[1] + py * hl * length)
    d.line([a, b], fill=hilt_color, width=max(2, int(w * 0.66)))
    # pommel
    d.line([p1, (p0[0] + dx * 1.06, p0[1] + dy * 1.06)], fill=color_end, width=max(2, int(w * 0.55)))


def make(size):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = int(size * 0.22)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=INK)
    # border
    d.rounded_rectangle([1, 1, size - 2, size - 2], radius=r, outline=LINE, width=max(1, size // 64))

    pad = size * 0.20
    w = max(3, int(size * 0.075))
    # silver sword: top-left -> bottom-right
    draw_sword(d, (pad, pad), (size - pad, size - pad), SILVER, SILVER2, w, (203, 213, 225, 255))
    # ember sword: top-right -> bottom-left
    draw_sword(d, (size - pad, pad), (pad, size - pad), ORANGE, PINK, w, (251, 146, 60, 255))

    # clash spark
    cx = cy = size / 2
    rr = size * 0.072
    d.ellipse([cx - rr, cy - rr * 1.1, cx + rr, cy + rr * 0.9], fill=GOLD)
    # small sparks
    for ang in (-90, -35, -145):
        a = math.radians(ang)
        x1 = cx + math.cos(a) * rr * 1.9
        y1 = cy + math.sin(a) * rr * 1.9
        x2 = cx + math.cos(a) * rr * 3.1
        y2 = cy + math.sin(a) * rr * 3.1
        d.line([x1, y1, x2, y2], fill=(253, 224, 71, 230), width=max(2, size // 64))

    return img


for s in (192, 512, 180):
    img = make(s)
    name = f'icon-{s}.png' if s != 180 else 'apple-touch-icon.png'
    img.save(os.path.join(OUT, name))
    print('wrote', name)

print('done')
