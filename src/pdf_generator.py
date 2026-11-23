"""Układ fizyczny w mm; żadnego skalowania siatki ani dodatkowych stron."""

from dataclasses import dataclass
import math
import os
from pathlib import Path
import tempfile

from reportlab.lib.utils import ImageReader
from reportlab.lib.units import mm
from reportlab.pdfgen.canvas import Canvas

from .config import Config, ConfigError
from .renderer import LabelRenderer

PAGE_WIDTH_MM, PAGE_HEIGHT_MM = 210.0, 297.0


@dataclass(frozen=True)
class Placement:
    number: int
    x_mm: float
    y_mm: float  # Od górnej krawędzi strony do górnej krawędzi etykiety.
    diameter_mm: float


def calculate_layout(config: Config) -> list[Placement]:
    c = config.validate()
    count = c.end_number - c.start_number + 1
    used_rows = math.ceil(count / c.columns)
    used_columns = min(count, c.columns)
    width = used_columns * c.diameter_mm + (used_columns - 1) * c.gap_x_mm
    height = used_rows * c.diameter_mm + (used_rows - 1) * c.gap_y_mm
    available_w = PAGE_WIDTH_MM - c.margin_left_mm - c.margin_right_mm
    available_h = PAGE_HEIGHT_MM - c.margin_top_mm - c.margin_bottom_mm
    if width > available_w + 1e-9 or height > available_h + 1e-9:
        raise ConfigError(
            f"Siatka {width:g} × {height:g} mm nie mieści się na A4 w obszarze "
            f"{available_w:g} × {available_h:g} mm. Zmień średnicę, odstępy, marginesy lub liczbę kolumn. "
            "Nie zmniejszono etykiet ani nie dodano stron."
        )
    top = c.margin_top_mm + (available_h - height) / 2
    result = []
    for row in range(used_rows):
        row_count = min(c.columns, count - row * c.columns)
        row_width = row_count * c.diameter_mm + (row_count - 1) * c.gap_x_mm
        left = c.margin_left_mm + (available_w - row_width) / 2
        for column in range(row_count):
            result.append(Placement(
                c.start_number + row * c.columns + column,
                left + column * (c.diameter_mm + c.gap_x_mm),
                top + row * (c.diameter_mm + c.gap_y_mm), c.diameter_mm,
            ))
    return result


def generate_pdf(config: Config, renderer: LabelRenderer, path: Path):
    placements = calculate_layout(config)
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=f".{path.stem}.", suffix=".pdf", dir=path.parent)
    os.close(descriptor)
    try:
        canvas = Canvas(temporary, pagesize=(PAGE_WIDTH_MM * mm, PAGE_HEIGHT_MM * mm), pageCompression=1)
        canvas.setTitle("Numerowane okręgi — A4, druk 100%")
        canvas.setViewerPreference("PrintScaling", "None")
        for item in placements:
            label = renderer.render(item.number)
            canvas.drawImage(
                ImageReader(label), item.x_mm * mm,
                (PAGE_HEIGHT_MM - item.y_mm - item.diameter_mm) * mm,
                width=item.diameter_mm * mm, height=item.diameter_mm * mm, mask="auto",
            )
        canvas.showPage()
        canvas.save()
        os.chmod(temporary, 0o644)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
