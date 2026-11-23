from dataclasses import replace

import pytest
from PIL import Image, ImageDraw

from src.config import Config


@pytest.fixture
def base(tmp_path):
    image = Image.new("RGB", (400, 200), "#267594")
    draw = ImageDraw.Draw(image)
    draw.ellipse((150, 50, 250, 150), fill="#ef9d41")
    draw.rectangle((0, 0, 30, 200), fill="red")
    image.save(tmp_path / "image.png")
    return tmp_path


@pytest.fixture
def config():
    return replace(Config(), image="image.png", dpi=150, washout=0, saturation=1)
