from PIL import Image, ImageDraw, ImageFont

# Create a 256x256 transparent PNG with a sleek high-tech camera icon for Sony Wiki
img = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# Draw glowing background pill/squircle with amber/gold gradient accent
# Camera body
draw.rounded_rectangle([32, 70, 224, 196], radius=24, fill=(30, 32, 38, 240), outline=(251, 191, 36, 220), width=6)
# Top dial / pentaprism bump
draw.rounded_rectangle([96, 42, 160, 74], radius=8, fill=(45, 48, 56, 240), outline=(251, 191, 36, 220), width=5)
# Red accent ring around lens
draw.ellipse([78, 88, 178, 188], fill=(20, 22, 26, 255), outline=(249, 115, 22, 240), width=6)
# Inner lens glass element
draw.ellipse([98, 108, 158, 168], fill=(14, 165, 233, 200), outline=(56, 189, 248, 255), width=4)
# Lens reflection dot
draw.ellipse([110, 118, 126, 134], fill=(255, 255, 255, 220))

img.save('/home/thaikpham/Desktop/ColorLab 2.0/public/sony-wiki-icon.png')
print("Successfully generated sony-wiki-icon.png")
