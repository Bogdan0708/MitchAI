#!/usr/bin/env python3
"""
Instagram Reel Generator for Mitch from Transylvania
Creates a cinematic food reel template with dark gothic Transylvania aesthetic
Fast rendering version
"""

from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

REEL_WIDTH = 1080
REEL_HEIGHT = 1920

def create_gradient_background(color_start, color_end, width, height):
    base = Image.new('RGB', (width, height), color_start)
    draw = ImageDraw.Draw(base)

    for i in range(0, height, 4):
        ratio = i / height
        r = int(color_start[0] * (1 - ratio) + color_end[0] * ratio)
        g = int(color_start[1] * (1 - ratio) + color_end[1] * ratio)
        b = int(color_start[2] * (1 - ratio) + color_end[2] * ratio)
        draw.rectangle([(0, i), (width, i + 4)], fill=(r, g, b))

    return base

def add_fire_glow(image, intensity=0.3):
    overlay = Image.new('RGB', image.size, (255, 100, 0))
    overlay = overlay.filter(ImageFilter.GaussianBlur(radius=40))
    return Image.blend(image, overlay, intensity)

def add_smoke_effect(image, intensity=0.1):
    overlay = Image.new('RGB', image.size, (40, 40, 40))
    overlay = overlay.filter(ImageFilter.GaussianBlur(radius=25))
    return Image.blend(image, overlay, intensity)

def draw_text_with_stroke(draw, text, position, font, fill_color, stroke_color, stroke_width):
    x, y = position
    for adj_x in range(-stroke_width, stroke_width + 1):
        for adj_y in range(-stroke_width, stroke_width + 1):
            if adj_x != 0 or adj_y != 0:
                draw.text((x + adj_x, y + adj_y), text, font=font, fill=stroke_color)
    draw.text(position, text, font=font, fill=fill_color)

def create_frame_with_text(bg_color, texts, glow_intensity=0.3):
    img = create_gradient_background(bg_color, (bg_color[0] + 20, bg_color[1] + 10, bg_color[2] + 5), REEL_WIDTH, REEL_HEIGHT)

    img = add_fire_glow(img, glow_intensity)
    img = add_smoke_effect(img, 0.08)

    draw = ImageDraw.Draw(img)

    try:
        font_large = ImageFont.truetype("arial.ttf", 100)
        font_medium = ImageFont.truetype("arial.ttf", 60)
        font_small = ImageFont.truetype("arial.ttf", 50)
    except:
        try:
            font_large = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 100)
            font_medium = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 60)
            font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 50)
        except:
            try:
                font_large = ImageFont.truetype("C:\\Windows\\Fonts\\arialbd.ttf", 100)
                font_medium = ImageFont.truetype("C:\\Windows\\Fonts\\arialbd.ttf", 60)
                font_small = ImageFont.truetype("C:\\Windows\\Fonts\\arialbd.ttf", 50)
            except:
                font_large = ImageFont.load_default()
                font_medium = ImageFont.load_default()
                font_small = ImageFont.load_default()

    for text_info in texts:
        text = text_info['text']
        y_pos = text_info['y']
        color = text_info['color']
        size = text_info.get('size', 'medium')

        if size == 'large':
            font = font_large
        elif size == 'small':
            font = font_small
        else:
            font = font_medium

        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        x_pos = (REEL_WIDTH - text_width) // 2

        draw_text_with_stroke(draw, text, (x_pos, y_pos), font, color, (0, 0, 0), 3)

    return img

def generate_reel_frames():
    print("🎬 Generating Mitch from Transylvania Instagram Reel Frames...")
    print("=" * 60)

    os.makedirs("marketing/frames", exist_ok=True)

    frames = []

    print("\n📽️  Frame 1: Title Card")
    frame1 = create_frame_with_text(
        bg_color=(20, 10, 10),
        texts=[
            {'text': 'MITCH', 'y': 600, 'color': (139, 0, 0), 'size': 'large'},
            {'text': 'from Transylvania', 'y': 900, 'color': (255, 255, 255), 'size': 'medium'}
        ],
        glow_intensity=0.4
    )
    frame1.save("marketing/frames/frame1_title.jpg", quality=95)
    frames.append("frame1_title.jpg")

    print("📽️  Frame 2: Romanian Mici")
    frame2 = create_frame_with_text(
        bg_color=(30, 15, 5),
        texts=[
            {'text': '🔥 Authentic Romanian Mici 🔥', 'y': 300, 'color': (255, 215, 0), 'size': 'medium'},
            {'text': 'Grilled over Open Flames', 'y': 900, 'color': (255, 255, 255), 'size': 'small'}
        ],
        glow_intensity=0.5
    )
    frame2.save("marketing/frames/frame2_mici.jpg", quality=95)
    frames.append("frame2_mici.jpg")

    print("📽️  Frame 3: Sizzling Action")
    frame3 = create_frame_with_text(
        bg_color=(25, 12, 8),
        texts=[
            {'text': 'Sizzling', 'y': 400, 'color': (255, 69, 0), 'size': 'large'},
            {'text': 'Smoky', 'y': 700, 'color': (255, 99, 71), 'size': 'large'},
            {'text': 'Delicious', 'y': 1000, 'color': (255, 215, 0), 'size': 'large'}
        ],
        glow_intensity=0.6
    )
    frame3.save("marketing/frames/frame3_sizzling.jpg", quality=95)
    frames.append("frame3_sizzling.jpg")

    print("📽️  Frame 4: Perfect Pairing")
    frame4 = create_frame_with_text(
        bg_color=(35, 20, 10),
        texts=[
            {'text': 'Fresh Bread', 'y': 500, 'color': (245, 222, 179), 'size': 'medium'},
            {'text': 'Spicy Mustard', 'y': 800, 'color': (255, 215, 0), 'size': 'medium'},
            {'text': 'Perfect Pairing', 'y': 1100, 'color': (255, 255, 255), 'size': 'medium'}
        ],
        glow_intensity=0.4
    )
    frame4.save("marketing/frames/frame4_pairing.jpg", quality=95)
    frames.append("frame4_pairing.jpg")

    print("📽️  Frame 5: Customer Love")
    frame5 = create_frame_with_text(
        bg_color=(28, 14, 7),
        texts=[
            {'text': '😋 Customer Approved 😋', 'y': 600, 'color': (255, 215, 0), 'size': 'medium'},
            {'text': "London's Best Kept Secret", 'y': 950, 'color': (255, 255, 255), 'size': 'small'}
        ],
        glow_intensity=0.35
    )
    frame5.save("marketing/frames/frame5_customers.jpg", quality=95)
    frames.append("frame5_customers.jpg")

    print("📽️  Frame 6: Call to Action")
    frame6 = create_frame_with_text(
        bg_color=(20, 10, 10),
        texts=[
            {'text': 'TASTE TRANSYLVANIA', 'y': 550, 'color': (139, 0, 0), 'size': 'large'},
            {'text': 'IN LONDON', 'y': 850, 'color': (255, 215, 0), 'size': 'large'},
            {'text': "📍 Find Us at Mitch's Grill", 'y': 1400, 'color': (255, 255, 255), 'size': 'small'}
        ],
        glow_intensity=0.45
    )
    frame6.save("marketing/frames/frame6_cta.jpg", quality=95)
    frames.append("frame6_cta.jpg")

    print("\n" + "=" * 60)
    print("✅ Reel frames generated successfully!")
    print("=" * 60)
    print(f"\n📁 Output folder: marketing/frames/")
    print(f"📐 Resolution: {REEL_WIDTH}x{REEL_HEIGHT} (Instagram Reel 9:16)")
    print(f"📸 Total frames: {len(frames)}")

    print("\n🎨 Generated Frames:")
    for i, frame in enumerate(frames, 1):
        print(f"  {i}. {frame}")

    print("\n🎨 Features Included:")
    print("  ✓ Dark gothic Transylvania aesthetic")
    print("  ✓ Dynamic fire glow effects")
    print("  ✓ Smoke overlay animations")
    print("  ✓ Bold text with black stroke outlines")
    print("  ✓ Gradient backgrounds")
    print("  ✓ Cinematic color grading")

    print("\n💡 Next Steps:")
    print("  1. Import frames into video editing software (CapCut, Adobe Premiere, etc.)")
    print("  2. Add real footage of mici being grilled between frames")
    print("  3. Set each frame duration to 3-5 seconds")
    print("  4. Add transitions (fade, zoom, etc.)")
    print("  5. Sync to upbeat street food music")
    print("  6. Add sound effects (sizzling, crowd ambience)")
    print("  7. Export as 1080x1920 video at 30fps")
    print("  8. Upload to Instagram as a Reel")
    print("\n📱 Recommended Hashtags:")
    print("  #StreetFood #LondonFood #RomanianFood #Mici #FoodStall")
    print("  #Transylvania #GrillFood #FoodPorn #LondonEats #StreetFoodLondon")

    return frames

if __name__ == "__main__":
    generate_reel_frames()