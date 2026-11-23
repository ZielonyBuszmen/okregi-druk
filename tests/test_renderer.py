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


def test_badge_without_image_has_empty_center_and_visible_ring(config, base):
    c = replace(config, background_mode="badge", image="absent.png", font_size_mm=13)
    renderer = LabelRenderer(c, base)
    assert renderer.image_path is None
    center = renderer.size // 2
    radius = round(7 * renderer.px_per_mm)
    middle = renderer.background.crop((center - radius, center - radius, center + radius, center + radius))
    assert middle.getextrema() == ((255, 255),) * 3
    assert ImageChops.difference(renderer.background, Image.new("RGB", renderer.background.size, "white")).getbbox()
    assert renderer.render(1).tobytes() != renderer.render(15).tobytes()


def test_badge_rejects_text_that_would_overlap(config, base):
    with pytest.raises(ConfigError, match="nie mieści się na łuku"):
        LabelRenderer(replace(config, background_mode="badge", badge_bottom_text="ZA DŁUGI NAPIS " * 10), base)


def test_role_labels_are_centered_and_duplicate_identically(role_config, base):
    renderer = LabelRenderer(role_config, base)
    assert renderer.render(1).tobytes() == renderer.render(2).tobytes()
    assert renderer.render(3).tobytes() == renderer.render(4).tobytes()
    assert renderer.render(1).tobytes() != renderer.render(3).tobytes()
    for index in (1, 3):
        x0, y0, x1, y1 = renderer.text_mask(index).getbbox()
        assert abs((x0 + x1) / 2 - renderer.size / 2) <= 1
        assert abs((y0 + y1) / 2 - renderer.size / 2) <= 1
    with pytest.raises(ConfigError, match="Pozycja napisu"):
        renderer.render(5)


def test_role_label_rejects_clipping_without_resizing(role_config, base):
    renderer = LabelRenderer(replace(role_config, font_size_mm=12), base)
    with pytest.raises(ConfigError, match="nie mieści się wewnątrz koła"):
        renderer.render(3)


def test_role_decorations_fit_preserve_text_and_repeat(role_config, base):
    decorated = replace(role_config, center_decorations=["fishing", "fishing", "coins", "coins"], number_offset_y_mm=2)
    renderer = LabelRenderer(decorated, base)
    plain = LabelRenderer(replace(decorated, center_decorations=None), base)
    assert renderer.render(1).tobytes() == renderer.render(2).tobytes()
    assert renderer.render(3).tobytes() == renderer.render(4).tobytes()
    for index in (1, 3):
        assert renderer.render(index).tobytes() != plain.render(index).tobytes()
        assert renderer.text_mask(index).tobytes() == plain.text_mask(index).tobytes()
        alpha = renderer.render_decoration(index).getchannel("A")
        assert ImageChops.multiply(alpha, renderer.text_mask(index)).getbbox() is None
    with pytest.raises(ConfigError, match="Ozdoba nie mieści się"):
        LabelRenderer(replace(decorated, decoration_size_mm=40), base).render(1)
