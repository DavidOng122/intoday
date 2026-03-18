import os
from PIL import Image, ImageDraw

def create_rounded_icon(img_path, output_512, output_192, radius=112):
    """
    Loads an image, adds transparent rounded corners, and saves at 512 and 192 sizes.
    """
    try:
        img = Image.open(img_path).convert("RGBA")
    except Exception as e:
        print(f"Error opening {img_path}: {e}")
        return

    W, H = img.size
    
    # Create mask for rounded corners
    # 512x512 size
    mask = Image.new('L', (W, H), 0)
    draw = ImageDraw.Draw(mask)
    # Draw rounded rectangle (0, 0, W, H)
    draw.rounded_rectangle((0, 0, W, H), radius=radius, fill=255)
    
    # Apply mask
    rounded = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    rounded.paste(img, (0, 0), mask=mask)
    
    # Save 512
    rounded.save(output_512, "PNG")
    print(f"Created rounded icon: {output_512}")
    
    # Save 192
    rounded_192 = rounded.resize((192, 192), Image.Resampling.LANCZOS)
    rounded_192.save(output_192, "PNG")
    print(f"Created rounded icon: {output_192}")

def main():
    base_dir = r"c:\Users\ojx21\OneDrive - University of Manitoba\文档\memotask\memotask_app"
    public_dir = os.path.join(base_dir, "public")

    src_512 = os.path.join(public_dir, "logo_512.png")
    out_512 = os.path.join(public_dir, "desktop_logo_512.png")
    out_192 = os.path.join(public_dir, "desktop_logo_192.png")

    if os.path.exists(src_512):
        create_rounded_icon(src_512, out_512, out_192)
    else:
        print(f"Source file not found: {src_512}")

if __name__ == "__main__":
    main()
