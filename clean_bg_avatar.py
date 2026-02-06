from PIL import Image
import os

def remove_white_bg(image_path, threshold=240):
    try:
        img = Image.open(image_path)
        img = img.convert("RGBA")
        datas = img.getdata()

        new_data = []
        for item in datas:
            # Check if pixel is close to white
            if item[0] > threshold and item[1] > threshold and item[2] > threshold:
                new_data.append((255, 255, 255, 0)) # Transparent
            else:
                new_data.append(item)

        img.putdata(new_data)
        img.save(image_path, "PNG")
        print(f"Cleaned {image_path}")
    except Exception as e:
        print(f"Error cleaning {image_path}: {e}")

images_to_clean = [
    "images/pokemon/pokemon_avatar_trainer_gen2.png"
]

base_path = "/Users/luizfernandotoledo/Desktop/Code_folder/cursor_testes/luizftoledo.github.io/"

for img_rel in images_to_clean:
    full_path = os.path.join(base_path, img_rel)
    if os.path.exists(full_path):
        remove_white_bg(full_path)
    else:
        print(f"File not found: {full_path}")
