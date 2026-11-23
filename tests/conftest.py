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


@pytest.fixture
def role_config(config):
    return replace(
        config, background_mode="badge", diameter_mm=37, font_size_mm=4.2,
        badge_inner_radius_mm=13.381666666666666, badge_text_radius_mm=15.355,
        badge_font_size_mm=3.021666666666667, badge_top_text="KOMOROWO",
        badge_bottom_text="Koło PZW Nr-34", badge_top_span_deg=120, badge_bottom_span_deg=132,
        center_labels=["PREZES", "PREZES", "SKARBNIK\nKOŁA", "SKARBNIK\nKOŁA"],
        preview_number=1, columns=2, rows=2, start_number=1, end_number=4,
    )
