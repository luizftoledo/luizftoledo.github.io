from PIL import Image
import os

def remove_background(input_path, output_path):
    if not os.path.exists(input_path):
        print(f"Error: Input file {input_path} not found.")
        return

    try:
        img = Image.open(input_path)
        img = img.convert("RGBA")
        datas = img.getdata()

        new_data = []
        # Expecting a generatively created image, likely with a consistent background or needed cropping.
        # This simple script assumes the top-left pixel is the background color.
        bg_color = img.getpixel((0, 0))
        tolerance = 40 # Increased tolerance

        for item in datas:
            if abs(item[0] - bg_color[0]) < tolerance and \
               abs(item[1] - bg_color[1]) < tolerance and \
               abs(item[2] - bg_color[2]) < tolerance:
                new_data.append((255, 255, 255, 0)) # Transparent
            else:
                new_data.append(item)

        img.putdata(new_data)
        img.save(output_path, "PNG")
        print(f"Background removed and saved to {output_path}")
    except Exception as e:
        print(f"An error occurred: {e}")

remove_background('images/persona/persona_avatar.png', 'images/persona/persona_avatar_transparent.png')
