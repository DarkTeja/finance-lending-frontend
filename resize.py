import sys
import subprocess

try:
    from PIL import Image
except ImportError:
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'Pillow'])
    from PIL import Image

def process_icon():
    img_path = 'assets/icon.png'
    img = Image.open(img_path).convert('RGBA')
    bg_color = img.getpixel((0, 0))
    new_img = Image.new('RGBA', (1024, 1024), bg_color)
    resized_img = img.resize((700, 700), Image.Resampling.LANCZOS) # Slightly bigger than 614 to look good
    offset = ((1024 - 700) // 2, (1024 - 700) // 2)
    new_img.paste(resized_img, offset, resized_img)
    new_img.save('assets/icon.png')
    print('Icon resized successfully')

if __name__ == '__main__':
    process_icon()
