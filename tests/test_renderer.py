from dataclasses import replace
import math

import pytest
from PIL import Image, ImageChops, ImageDraw, ImageStat

from src.config import ConfigError
from src.renderer import LabelRenderer


def test_transparency_clipping_all_effects(config, base):
    c = replace(config, number_shadow=True, shadow_blur_mm=2, number_offset_x_mm=8, number_outline_mm=0.3)
    label = LabelRenderer(c, base).render(12)
    assert label.mode == "RGBA"
    alpha = label.getchannel("A")
    assert alpha.getpixel((0, 0)) == alpha.getpixel((label.width - 1, 0)) == 0
    assert alpha.getpixel((label.width // 2, label.height // 2)) == 255
    center = (label.width - 1) / 2
    for y in range(label.height):
        for x in range(label.width):
            if math.hypot(x - center, y - center) > label.width / 2 + 3:
                assert alpha.getpixel((x, y)) == 0


@pytest.mark.parametrize("fit", ["cover", "contain"])
def test_aspect_ratio_with_circular_landmark(config, base, fit):
    source = Image.new("RGB", (400, 200), "white")
    ImageDraw.Draw(source).ellipse((150, 50, 250, 150), fill="black")
    source.save(base / "image.png")
    renderer = LabelRenderer(replace(config, image_fit=fit), base)
    mask = renderer.background.convert("L").point(lambda v: 255 if v < 80 else 0)
    x0, y0, x1, y1 = mask.getbbox()
    assert abs((x1 - x0) - (y1 - y0)) <= 1
    assert x1 - x0 == pytest.approx(renderer.size * (0.5 if fit == "cover" else 0.25), abs=2)


@pytest.mark.parametrize("number", list(range(1, 34)))
def test_numbers_centered_by_actual_glyph_bounds(config, base, number):
    renderer = LabelRenderer(config, base)
    x0, y0, x1, y1 = renderer.text_mask(number).getbbox()
    assert abs((x0 + x1) / 2 - renderer.size / 2) <= 2
    assert abs((y0 + y1) / 2 - renderer.size / 2) <= 1.5


def test_combined_effects_and_washout_endpoints(config, base):
    plain = LabelRenderer(config, base).background
    changed = LabelRenderer(replace(config, blur_mm=0.7, washout=40, saturation=0, brightness=1.1, contrast=0.8), base).background
    assert plain.tobytes() != changed.tobytes()
    assert all(r == g == b for r, g, b in changed.getdata())
    white = LabelRenderer(replace(config, washout=100), base).background
    assert white.getextrema() == ((255, 255),) * 3
    blurred = LabelRenderer(replace(config, blur_mm=1), base).background
    assert ImageStat.Stat(blurred).stddev[0] < ImageStat.Stat(plain).stddev[0]


@pytest.mark.parametrize("changes", [
    {"brightness": 0.5}, {"contrast": 0.5}, {"saturation": 0}, {"image_scale": 1.4},
    {"image_offset_x": 2}, {"image_offset_y": -2}, {"image_fit": "contain"},
    {"number_color": "white"}, {"number_outline_mm": 0.3}, {"number_shadow": True},
    {"number_offset_x_mm": 1}, {"number_offset_y_mm": 1}, {"font_weight": "regular"},
    {"border_enabled": False}, {"border_width_mm": 0.5}, {"font_size_mm": 12},
])
def test_parameters_affect_render(config, base, changes):
    assert LabelRenderer(config, base).render(12).tobytes() != LabelRenderer(replace(config, **changes), base).render(12).tobytes()


def test_font_points_and_auto_color(config, base):
    a = LabelRenderer(config, base).render(12)
    b = LabelRenderer(replace(config, font_size_mm=None, font_size_pt=15 * 72 / 25.4), base).render(12)
    assert a.tobytes() == b.tobytes()
    for background, expected in (("white", "black"), ("black", "white")):
        Image.new("RGB", (200, 200), background).save(base / "image.png")
        r = LabelRenderer(replace(config, number_color="auto"), base)
        assert r.number_color(r.text_mask(12)) == expected


@pytest.mark.parametrize("extension", ["png", "jpg", "webp"])
def test_input_formats(config, base, extension):
    path = base / f"test.{extension}"
    Image.new("RGB", (60, 120), "blue").save(path)
    assert LabelRenderer(replace(config, image=path.name), base).render(12).mode == "RGBA"


def test_bad_image_and_font(config, base):
    for changes in ({"image": "missing.png"}, {"font_path": "missing.ttf"}):
        with pytest.raises(ConfigError):
            LabelRenderer(replace(config, **changes), base)
    (base / "broken.png").write_text("not an image")
    with pytest.raises(ConfigError):
        LabelRenderer(replace(config, image="broken.png"), base)
