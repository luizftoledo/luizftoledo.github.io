from PIL import Image
import os

def remove_background(input_path, output_path, tolerance=30):
    try:
        img = Image.open(input_path).convert("RGBA")
        datas = img.getdata()
        
        # Get the corner color to assume as background (top-left)
        bg_color = datas[0]
        
        new_data = []
        for item in datas:
            # Simple color distance check
            if abs(item[0] - bg_color[0]) < tolerance and \
               abs(item[1] - bg_color[1]) < tolerance and \
               abs(item[2] - bg_color[2]) < tolerance:
                new_data.append((255, 255, 255, 0)) # Transparent
            else:
                new_data.append(item)
                
        img.putdata(new_data)
        img.save(output_path, "PNG")
        print(f"Processed {input_path} -> {output_path}")
    except Exception as e:
        print(f"Error processing {input_path}: {e}")

# Process specific files
base_dir = "images/pokemon"
files = ["trainer_back.png", "monster_record.png", "walking_sprite.png", "trainer_back_v2.png"]

# Increase tolerance
remove_background(f"{base_dir}/trainer_back.png", f"{base_dir}/trainer_back.png", tolerance=60)
remove_background(f"{base_dir}/monster_record.png", f"{base_dir}/monster_record.png", tolerance=60)
remove_background(f"{base_dir}/walking_sprite.png", f"{base_dir}/walking_sprite.png", tolerance=60)
remove_background(f"{base_dir}/trainer_back_v2.png", f"{base_dir}/trainer_back_v2.png", tolerance=60)
remove_background(f"{base_dir}/monster_record_v2.png", f"{base_dir}/monster_record_v2.png", tolerance=60)
