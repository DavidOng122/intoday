import os
from PIL import Image

def resize_content(img_path, scale_factor, bg_color=None, save_path=None):
    """
    Resizes the content of an image by scale_factor.
    If bg_color is provided, places the resized image on a background of that color.
    Otherwise, keeps transparency.
    """
    try:
        img = Image.open(img_path).convert("RGBA")
    except Exception as e:
        print(f"Error opening {img_path}: {e}")
        return

    W, H = img.size
    
    # Calculate new dimension
    # We scale the entire pixels content
    # For safety, we just scale the whole image and paste it centered
    # If scale_factor > 1, some edge pixels might get cropped if they exist
    # If scale_factor < 1, it adds padding
    
    new_w = int(W * scale_factor)
    new_h = int(H * scale_factor)
    
    # Resample
    resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    
    # Create canvas
    if bg_color:
        canvas = Image.new("RGBA", (W, H), bg_color)
    else:
        canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0)) # transparent
        
    # Calculate paste position (center)
    paste_x = (W - new_w) // 2
    paste_y = (H - new_h) // 2
    
    # Paste
    canvas.paste(resized, (paste_x, paste_y), mask=resized)
    
    # Convert back if needed (e.g., RGB for no transparency if requested, but PNG supports RGBA)
    # If bg_color is opaque, we can convert to RGB to ensure no transparency for PWA
    if bg_color and bg_color[3] == 255:
        canvas = canvas.convert("RGB")
        
    final_path = save_path if save_path else img_path
    canvas.save(final_path, "PNG")
    print(f"Updated {final_path} (Scaled {scale_factor})")

def main():
    base_dir = r"c:\Users\ojx21\OneDrive - University of Manitoba\文档\memotask\memotask_app"
    public_dir = os.path.join(base_dir, "public")
    res_dir = os.path.join(base_dir, "android", "app", "src", "main", "res")

    # 1. iOS PWA: logoreal.png
    # Decrease content by 13% (scale 0.87), White background (Opaque)
    logoreal_path = os.path.join(public_dir, "logoreal.png")
    if os.path.exists(logoreal_path):
        resize_content(logoreal_path, 0.87, bg_color=(255, 255, 255, 255))
    else:
        print(f"File not found: {logoreal_path}")

    # 2. Android PWA: logo_512.png
    # Increase content by 5% (scale 1.05), White background (Opaque)
    logo512_path = os.path.join(public_dir, "logo_512.png")
    if os.path.exists(logo512_path):
        resize_content(logo512_path, 1.05, bg_color=(255, 255, 255, 255))
        # Update logo_192.png from the updated 512px version
        img_512 = Image.open(logo512_path)
        img_192 = img_512.resize((192, 192), Image.Resampling.LANCZOS)
        logo192_path = os.path.join(public_dir, "logo_192.png")
        img_192.save(logo192_path, "PNG")
        print(f"Updated {logo192_path} from 512px version")
    else:
         print(f"File not found: {logo512_path}")

    # 3. Android Native: mipmap-*
    if os.path.exists(res_dir):
        for dirname in os.listdir(res_dir):
            if dirname.startswith("mipmap-"):
                mipmap_dir = os.path.join(res_dir, dirname)
                fg_path = os.path.join(mipmap_dir, "ic_launcher_foreground.png")
                if os.path.exists(fg_path):
                    # Native foreground needs to keep transparency
                    resize_content(fg_path, 1.05, bg_color=None)
                
                # Also check ic_launcher.png (non-adaptive fallback)
                lc_path = os.path.join(mipmap_dir, "ic_launcher.png")
                if os.path.exists(lc_path):
                     # places on white if it doesn't have adaptive support or just scale
                     resize_content(lc_path, 1.05, bg_color=(255, 255, 255, 255))

if __name__ == "__main__":
    main()
