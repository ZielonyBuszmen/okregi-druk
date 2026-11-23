from dataclasses import replace

import pytest
from PIL import Image
from pypdf import PdfReader
from pypdf.generic import ContentStream
from reportlab.lib.units import mm

from src.config import ConfigError
from src.pdf_generator import calculate_layout, generate_pdf
from src.renderer import LabelRenderer


def test_grid_33_numbers_centers_margins_and_gaps(config):
    positions = calculate_layout(config)
    assert [item.number for item in positions] == list(range(1, 34))
    assert len(positions) == 33
    assert positions[0].x_mm == 22
    assert positions[0].y_mm == 31.5
    assert positions[1].x_mm - positions[0].x_mm == 34
    assert positions[5].y_mm - positions[0].y_mm == 34
    assert [item.x_mm for item in positions[-3:]] == [56, 90, 124]
    assert positions[-2].x_mm + 15 == 105
    assert positions[-1].y_mm + 30 == 265.5
    for i, a in enumerate(positions):
        assert 10 <= a.x_mm <= 170
        assert 10 <= a.y_mm <= 257 + 10
        for b in positions[i + 1:]:
            assert ((a.x_mm - b.x_mm) ** 2 + (a.y_mm - b.y_mm) ** 2) ** 0.5 >= 34 - 1e-9


def test_asymmetric_margins_and_custom_range(config):
    c = replace(config, start_number=8, end_number=15, margin_left_mm=20, margin_right_mm=10)
    items = calculate_layout(c)
    assert [x.number for x in items] == list(range(8, 16))
    assert (items[0].x_mm + items[4].x_mm + c.diameter_mm) / 2 == 110
    assert (items[5].x_mm + items[7].x_mm + c.diameter_mm) / 2 == 110


@pytest.mark.parametrize("changes", [
    {"diameter_mm": 45}, {"gap_y_mm": 30}, {"margin_left_mm": 60},
    {"rows": 6}, {"columns": 0}, {"start_number": 34}, {"gap_x_mm": -1},
])
def test_reject_layout_without_scaling(config, changes):
    with pytest.raises(ConfigError):
        calculate_layout(replace(config, **changes))


@pytest.mark.parametrize("dpi", [150, 600])
@pytest.mark.parametrize("mode", ["image", "badge"])
def test_pdf_physical_diameter_single_page_and_pixel_identity(config, base, dpi, mode):
    config = replace(config, dpi=dpi, background_mode=mode)
    renderer = LabelRenderer(config, base)
    expected = renderer.render(12)
    png = base / "preview.png"
    expected.save(png)
    with Image.open(png) as saved:
        expected = saved.copy()
    target = base / "temporary-test-sheet.pdf"
    generate_pdf(config, renderer, target)
    reader = PdfReader(target)
    assert len(reader.pages) == 1
    page = reader.pages[0]
    assert float(page.mediabox.width) / mm == pytest.approx(210, abs=1e-5)
    assert float(page.mediabox.height) / mm == pytest.approx(297, abs=5e-5)
    assert reader.trailer["/Root"]["/ViewerPreferences"]["/PrintScaling"] == "/None"
    transforms = []
    draws = []
    for operands, operator in ContentStream(page.get_contents(), reader).operations:
        if operator == b"cm" and abs(float(operands[0]) - 30 * mm) < 0.001:
            transforms.append([float(v) for v in operands])
        if operator == b"Do":
            draws.append(operands[0])
    assert len(transforms) == len(draws) == 33
    for transform, placement in zip(transforms, calculate_layout(config)):
        assert transform[0] / mm == pytest.approx(30, abs=1e-5)
        assert transform[3] / mm == pytest.approx(30, abs=1e-5)
        assert transform[4] / mm == pytest.approx(placement.x_mm, abs=5e-5)
        assert transform[5] / mm == pytest.approx(297 - placement.y_mm - 30, abs=5e-5)
    embedded = page["/Resources"]["/XObject"][draws[11]]
    assert embedded.get_data() == expected.convert("RGB").tobytes()
    assert embedded["/SMask"].get_data() == expected.getchannel("A").tobytes()


def test_pdf_size_does_not_depend_on_dpi(config, base):
    low = replace(config, dpi=72, start_number=12, end_number=12)
    target = base / "low-dpi-test.pdf"
    generate_pdf(low, LabelRenderer(low, base), target)
    page = PdfReader(target).pages[0]
    transforms = [ops for ops, op in ContentStream(page.get_contents(), page.pdf).operations if op == b"cm"]
    assert float(transforms[-1][0]) / mm == pytest.approx(30, abs=1e-5)


def test_failed_pdf_does_not_replace_previous_file(config, base):
    class BrokenRenderer:
        def render(self, number):
            raise ConfigError("Testowy błąd renderowania.")

    target = base / "existing.pdf"
    target.write_bytes(b"previous document")
    with pytest.raises(ConfigError):
        generate_pdf(config, BrokenRenderer(), target)
    assert target.read_bytes() == b"previous document"
    assert list(base.glob(".existing.*.pdf")) == []


@pytest.mark.parametrize("decorated", [False, True])
def test_role_pdf_has_two_copies_each_at_37_mm(role_config, base, decorated):
    if decorated:
        role_config = replace(role_config, center_decorations=["fishing", "fishing", "coins", "coins"], number_offset_y_mm=2)
    renderer = LabelRenderer(role_config, base)
    placements = calculate_layout(role_config)
    assert [item.number for item in placements] == [1, 2, 3, 4]
    target = base / "temporary-role-test.pdf"
    generate_pdf(role_config, renderer, target)
    reader = PdfReader(target)
    assert len(reader.pages) == 1
    page = reader.pages[0]
    assert float(page.mediabox.width) / mm == pytest.approx(210, abs=1e-5)
    assert float(page.mediabox.height) / mm == pytest.approx(297, abs=5e-5)
    ops = ContentStream(page.get_contents(), reader).operations
    draws = [args[0] for args, op in ops if op == b"Do"]
    sizes = [args for args, op in ops if op == b"cm" and abs(float(args[0]) / mm - 37) < 1e-5]
    assert len(draws) == len(sizes) == 4
    assert draws[0] == draws[1] and draws[2] == draws[3] and draws[0] != draws[2]
    for name, index in ((draws[0], 1), (draws[2], 3)):
        expected = renderer.render(index)
        embedded = page["/Resources"]["/XObject"][name]
        assert embedded.get_data() == expected.convert("RGB").tobytes()
        assert embedded["/SMask"].get_data() == expected.getchannel("A").tobytes()
