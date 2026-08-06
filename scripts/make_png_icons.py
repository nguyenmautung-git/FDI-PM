import os
from PIL import Image, ImageDraw, ImageFont

sizes = [72, 96, 128, 144, 152, 192, 384, 512]
output_dir = os.path.join(os.path.dirname(__file__), '..', 'public', 'icons')
os.makedirs(output_dir, exist_ok=True)

def get_font(size_pt):
    # Try system fonts on Windows
    font_paths = [
        "C:\\Windows\\Fonts\\arialbd.ttf",   # Arial Bold
        "C:\\Windows\\Fonts\\segoeuib.ttf",  # Segoe UI Bold
        "C:\\Windows\\Fonts\\tahomabd.ttf",  # Tahoma Bold
        "C:\\Windows\\Fonts\\arial.ttf"
    ]
    for p in font_paths:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size_pt)
            except Exception:
                pass
    return ImageFont.load_default()

def draw_fdi_icon(size):
    # Create high-res canvas (4x supersampling for antialiasing)
    scale = 4
    W = size * scale
    H = size * scale
    
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Background rounded rectangle
    bg_color = (15, 23, 42, 255) # #0f172a
    corner_radius = int(W * 0.22)
    draw.rounded_rectangle([0, 0, W, H], radius=corner_radius, fill=bg_color)

    # 3 Slanted parallelograms
    # Total logo width ~ 65% of canvas, height ~ 50% of canvas
    block_w = int(W * 0.17)
    block_h = int(H * 0.44)
    gap = int(W * 0.04)
    slant = int(block_w * 0.35)

    total_w = 3 * block_w + 2 * gap + slant
    start_x = (W - total_w) // 2 + slant
    start_y = (H - block_h) // 2

    colors = [
        (2, 132, 199, 255),   # #0284c7 Blue
        (249, 115, 22, 255),   # #f97316 Orange
        (34, 197, 94, 255)     # #22c55e Green
    ]
    letters = ["F", "D", "I"]

    font_size = int(block_h * 0.7)
    font = get_font(font_size)

    for i in range(3):
        bx = start_x + i * (block_w + gap)
        by = start_y

        # Polygon points for slanted parallelogram
        # Top-left, Top-right, Bottom-right, Bottom-left
        poly = [
            (bx, by),
            (bx + block_w, by),
            (bx + block_w - slant, by + block_h),
            (bx - slant, by + block_h)
        ]
        
        # Draw slanted block
        draw.polygon(poly, fill=colors[i])

        # Center of the parallelogram for letter
        center_x = bx + (block_w - slant) / 2
        center_y = by + block_h / 2

        # Draw letter
        letter = letters[i]
        bbox = draw.textbbox((0, 0), letter, font=font)
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]

        tx = center_x - text_w / 2 - bbox[0]
        ty = center_y - text_h / 2 - bbox[1]

        draw.text((tx, ty), letter, fill=(255, 255, 255, 255), font=font)

    # Downsample using LANCZOS for super crisp quality
    final_img = img.resize((size, size), Image.Resampling.LANCZOS)
    return final_img

# Generate all icon sizes
for size in sizes:
    icon_img = draw_fdi_icon(size)
    png_path = os.path.join(output_dir, f"icon-{size}.png")
    icon_img.save(png_path, "PNG")
    print(f"Saved {png_path} ({size}x{size})")

# Also save favicon.png and apple-touch-icon.png in public root
public_dir = os.path.join(os.path.dirname(__file__), '..', 'public')

favicon = draw_fdi_icon(64)
favicon.save(os.path.join(public_dir, "favicon.png"), "PNG")

apple_icon = draw_fdi_icon(180)
apple_icon.save(os.path.join(public_dir, "apple-touch-icon.png"), "PNG")

print("All PNG icons generated successfully with FDI Logo!")
