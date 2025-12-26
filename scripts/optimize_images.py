import os
from PIL import Image
import glob

def convert_to_webp(directory):
    # Find all PNG and JPG images
    images = glob.glob(os.path.join(directory, "*.png")) + glob.glob(os.path.join(directory, "*.jpg")) + glob.glob(os.path.join(directory, "*.jpeg"))
    
    print(f"Found {len(images)} images to process.")
    
    for img_path in images:
        try:
            filename = os.path.basename(img_path)
            name, ext = os.path.splitext(filename)
            webp_path = os.path.join(directory, f"{name}.webp")
            
            # Skip if webp already exists and is newer
            # if os.path.exists(webp_path):
            #     continue
                
            with Image.open(img_path) as img:
                # Convert to RGB if RGBA (for JPG compatibility, though WebP handles RGBA)
                # But WebP handles transparency fine.
                
                print(f"Converting {filename} to WebP...")
                img.save(webp_path, "WEBP", quality=80, method=6)
                
                # Compare sizes
                original_size = os.path.getsize(img_path)
                new_size = os.path.getsize(webp_path)
                reduction = (1 - (new_size / original_size)) * 100
                print(f"Saved {name}.webp: {original_size/1024:.1f}KB -> {new_size/1024:.1f}KB ({reduction:.1f}% reduction)")
                
        except Exception as e:
            print(f"Error converting {img_path}: {e}")

if __name__ == "__main__":
    convert_to_webp(".")
