"""Deterministyczny obrazek testowy: gradient, koła i liście; bez sieci."""

from pathlib import Path

from PIL import Image, ImageDraw


def create_example(path):
    width, height = 1200, 900
    image = Image.new("RGB", (width, height))
    draw = ImageDraw.Draw(image)
    for y in range(height):
        t = y / (height - 1)
        draw.line((0, y, width, y), fill=(round(85 + 110 * t), round(174 + 40 * t), round(190 - 25 * t)))
    draw.ellipse((660, 40, 1040, 420), fill="#f6d67d")
    draw.ellipse((-220, 470, 650, 1300), fill="#3d8890")
    draw.ellipse((540, 560, 1430, 1370), fill="#366d78")
    draw.line((160, 900, 470, 170), fill="#285961", width=18)
    for x, y, right in ((230, 730, True), (280, 610, False), (330, 490, True), (380, 370, False), (425, 265, True)):
        end_x = x + (210 if right else -185)
        draw.ellipse((min(x, end_x), y - 130, max(x, end_x), y + 5), fill="#78b49d")
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, dpi=(300, 300))


if __name__ == "__main__":
    target = Path("input/example.png")
    if target.exists():
        raise SystemExit(f"Plik {target} już istnieje; nie nadpisano go.")
    create_example(target)
    print(target)
