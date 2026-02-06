from PIL import Image
import numpy as np

def clean_avatar(source_path, target_path):
    print(f"Processing {source_path}...")
    try:
        img = Image.open(source_path).convert("RGBA")
        data = np.array(img)
        
        height, width = data.shape[:2]
        
        # Flood fill from corners to remove background
        # Background is likely white or near-white
        
        visited = np.zeros((height, width), dtype=bool)
        
        # Corners
        corners = [(0,0), (0, width-1), (height-1, 0), (height-1, width-1)]
        
        for cy, cx in corners:
            if visited[cy, cx]: continue
            
            # Seed color
            r, g, b, a = data[cy, cx]
            
            # If already transparent, skip/mark
            if a == 0:
                continue
                
            stack = [(cy, cx)]
            visited[cy, cx] = True
            
            while stack:
                y, x = stack.pop()
                
                # Make transparent
                data[y, x, 3] = 0
                
                # Check neighbors
                for ny, nx in [(y+1, x), (y-1, x), (y, x+1), (y, x-1)]:
                    if 0 <= ny < height and 0 <= nx < width:
                        if not visited[ny, nx]:
                            nr, ng, nb, na = data[ny, nx]
                            
                            # Simple color diff
                            diff = abs(int(nr)-int(r)) + abs(int(ng)-int(g)) + abs(int(nb)-int(b))
                            
                            # Tolerance for compression artifacts
                            if diff < 15:
                                visited[ny, nx] = True
                                stack.append((ny, nx))
                                
        # Crop
        alpha = data[:,:,3]
        rows = np.any(alpha > 0, axis=1)
        cols = np.any(alpha > 0, axis=0)
        
        if np.any(rows) and np.any(cols):
            rmin, rmax = np.where(rows)[0][[0, -1]]
            cmin, cmax = np.where(cols)[0][[0, -1]]
            
            data = data[rmin:rmax+1, cmin:cmax+1]
            
        result = Image.fromarray(data)
        result.save(target_path)
        print(f"Saved to {target_path}")

    except Exception as e:
        print(f"Error: {e}")

source = "/Users/luizfernandotoledo/.gemini/antigravity/brain/76285f67-497f-48a2-9490-c9da13526935/stardew_avatar_custom_1767217598262.png"
target = "/Users/luizfernandotoledo/Desktop/Code_folder/cursor_testes/luizftoledo.github.io/images/stardew/stardew_avatar_custom.png"

clean_avatar(source, target)
