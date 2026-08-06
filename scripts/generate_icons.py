"""
Script tạo icon PNG cho PWA từ ảnh có sẵn.
Chạy: python generate_icons.py
"""
import os
import sys
import base64

# Thử dùng Pillow (nếu có), nếu không thì dùng SVG trực tiếp
ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512]
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'icons')
os.makedirs(OUTPUT_DIR, exist_ok=True)

def create_svg_icon(size):
    """Tạo SVG icon đơn giản cho app QLDA FDI"""
    s = size
    svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg width="{s}" height="{s}" viewBox="0 0 {s} {s}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1e293b;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#0f172a;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />
    </linearGradient>
    <clipPath id="rounded">
      <rect width="{s}" height="{s}" rx="{round(s*0.2225)}" ry="{round(s*0.2225)}"/>
    </clipPath>
  </defs>
  
  <!-- Background -->
  <rect width="{s}" height="{s}" fill="url(#bg)" clip-path="url(#rounded)"/>
  
  <!-- Accent glow -->
  <ellipse cx="{s*0.5}" cy="{s*0.42}" rx="{s*0.32}" ry="{s*0.22}" fill="#3b82f6" opacity="0.12"/>
  
  <!-- Building icon centered -->
  <g transform="translate({s*0.5}, {s*0.46}) scale({s/192})">
    <!-- Main building body -->
    <rect x="-28" y="-30" width="56" height="60" rx="3" fill="none" stroke="url(#accent)" stroke-width="4"/>
    <!-- Windows row 1 -->
    <rect x="-20" y="-22" width="10" height="8" rx="1.5" fill="url(#accent)" opacity="0.8"/>
    <rect x="-4" y="-22" width="10" height="8" rx="1.5" fill="url(#accent)" opacity="0.8"/>
    <rect x="12" y="-22" width="10" height="8" rx="1.5" fill="url(#accent)" opacity="0.5"/>
    <!-- Windows row 2 -->
    <rect x="-20" y="-8" width="10" height="8" rx="1.5" fill="url(#accent)" opacity="0.6"/>
    <rect x="-4" y="-8" width="10" height="8" rx="1.5" fill="url(#accent)" opacity="0.9"/>
    <rect x="12" y="-8" width="10" height="8" rx="1.5" fill="url(#accent)" opacity="0.7"/>
    <!-- Door -->
    <rect x="-8" y="10" width="16" height="20" rx="2" fill="url(#accent)" opacity="0.6"/>
    <!-- Rooftop elements -->
    <rect x="-10" y="-36" width="4" height="8" rx="1" fill="url(#accent)" opacity="0.7"/>
    <rect x="6" y="-40" width="4" height="12" rx="1" fill="url(#accent)"/>
  </g>
  
  <!-- FDI text at bottom -->
  <text x="{s*0.5}" y="{s*0.88}" 
    font-family="SF Pro Display, Helvetica Neue, Arial, sans-serif" 
    font-size="{max(8, round(s*0.09))}" 
    font-weight="700" 
    fill="#94a3b8" 
    text-anchor="middle" 
    letter-spacing="{max(1, round(s*0.025))}">FDI</text>
</svg>'''
    return svg

try:
    from PIL import Image
    import cairosvg
    HAS_CAIRO = True
except ImportError:
    HAS_CAIRO = False

if not HAS_CAIRO:
    # Fallback: lưu SVG với từng kích thước (trình duyệt hỗ trợ SVG icon)
    print("⚠️  Pillow/CairoSVG chưa cài. Tạo SVG icon thay thế...")
    for size in ICON_SIZES:
        svg_content = create_svg_icon(size)
        # Lưu SVG với tên PNG (một số browser chấp nhận)
        out_path = os.path.join(OUTPUT_DIR, f'icon-{size}.svg')
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(svg_content)
        print(f"  ✅ Tạo: icon-{size}.svg ({size}x{size})")
    
    # Cũng tạo một file PNG placeholder đơn giản (1x1 pixel PNG trong base64)
    # PNG 1x1 transparent
    png_1x1_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    for size in ICON_SIZES:
        out_path = os.path.join(OUTPUT_DIR, f'icon-{size}.png')
        with open(out_path, 'wb') as f:
            f.write(base64.b64decode(png_1x1_b64))
    
    print("\n📌 Lưu ý: Icon PNG là placeholder. Để có icon đẹp, hãy:")
    print("   pip install cairosvg pillow")
    print("   python generate_icons.py")
else:
    import cairosvg
    from PIL import Image
    import io
    
    print("🎨 Đang tạo PNG icons từ SVG...")
    for size in ICON_SIZES:
        svg_content = create_svg_icon(size)
        png_bytes = cairosvg.svg2png(bytestring=svg_content.encode(), 
                                      output_width=size, output_height=size)
        out_path = os.path.join(OUTPUT_DIR, f'icon-{size}.png')
        with open(out_path, 'wb') as f:
            f.write(png_bytes)
        print(f"  ✅ icon-{size}.png ({size}x{size}px)")
    
    print(f"\n✨ Tạo xong {len(ICON_SIZES)} icon tại: {OUTPUT_DIR}")

print("\n✅ Hoàn thành!")
