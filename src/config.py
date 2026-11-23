"""Konfiguracja: wszystkie odległości w mm, papier zawsze A4 pionowo."""

from dataclasses import asdict, dataclass, fields
import json
import math
import os
from pathlib import Path
import tempfile

from PIL import ImageColor


class ConfigError(ValueError):
    pass


@dataclass(frozen=True)
class Config:
    image: str = "input/example.png"
    dpi: int = 600
    diameter_mm: float = 30.0
    blur_mm: float = 0.0
    washout: float = 40.0
    brightness: float = 1.0
    contrast: float = 1.0
    saturation: float = 0.75
    image_scale: float = 1.0
    image_offset_x: float = 0.0
    image_offset_y: float = 0.0
    image_fit: str = "cover"
    background_color: str = "white"
    font_family: str = "DejaVuSans"
    font_weight: str = "bold"
    font_path: str | None = None
    font_size_mm: float | None = 15.0
    font_size_pt: float | None = None
    number_color: str = "black"
    number_outline_mm: float = 0.0
    number_outline_color: str = "white"
    number_shadow: bool = False
    shadow_color: str = "black"
    shadow_opacity: float = 0.25
    shadow_blur_mm: float = 0.25
    shadow_offset_x_mm: float = 0.2
    shadow_offset_y_mm: float = 0.3
    number_offset_x_mm: float = 0.0
    number_offset_y_mm: float = 0.0
    border_enabled: bool = True
    border_color: str = "black"
    border_width_mm: float = 0.2
    columns: int = 5
    rows: int = 7
    gap_x_mm: float = 4.0
    gap_y_mm: float = 4.0
    margin_left_mm: float = 10.0
    margin_right_mm: float = 10.0
    margin_top_mm: float = 10.0
    margin_bottom_mm: float = 10.0
    start_number: int = 1
    end_number: int = 33
    preview_number: int = 12
    preview_output: str = "output/preview.png"
    pdf_output: str = "output/labels.pdf"

    def to_dict(self):
        return asdict(self)

    def validate(self):
        for field in fields(self):
            value = getattr(self, field.name)
            kind = str(field.type)
            if value is None and "None" in kind:
                continue
            if field.type is bool:
                valid = type(value) is bool
            elif field.type is int:
                valid = type(value) is int
            elif field.type is float or "float" in kind:
                valid = type(value) in (int, float) and math.isfinite(value)
            else:
                valid = isinstance(value, str) and bool(value.strip())
            if not valid:
                raise ConfigError(f"Nieprawidłowa wartość {field.name}: {value!r}.")

        positive = ("diameter_mm", "image_scale")
        nonnegative = (
            "blur_mm", "brightness", "contrast", "saturation", "number_outline_mm",
            "shadow_blur_mm", "border_width_mm", "gap_x_mm", "gap_y_mm",
            "margin_left_mm", "margin_right_mm", "margin_top_mm", "margin_bottom_mm",
        )
        for name in positive + nonnegative:
            value = getattr(self, name)
            if value < 0 or (name in positive and value == 0):
                raise ConfigError(f"{name} musi być {'większe od' if name in positive else 'nie mniejsze niż'} 0.")
        if not 0 <= self.washout <= 100:
            raise ConfigError("washout musi być w zakresie 0–100 (%).")
        if not 0 <= self.shadow_opacity <= 1:
            raise ConfigError("shadow_opacity musi być w zakresie 0–1.")
        if not 72 <= self.dpi <= 2400:
            raise ConfigError("dpi musi być liczbą całkowitą z zakresu 72–2400.")
        if not 8 <= round(self.diameter_mm / 25.4 * self.dpi) <= 6000:
            raise ConfigError("Etykieta musi mieć od 8 do 6000 pikseli; zmień średnicę lub DPI.")
        if self.image_fit not in ("cover", "contain"):
            raise ConfigError("image_fit: wybierz cover lub contain.")
        if self.font_weight not in ("regular", "bold"):
            raise ConfigError("font_weight: wybierz regular lub bold.")
        if not self.font_path and self.font_family not in ("DejaVuSans", "DejaVuSerif", "DejaVuSansMono"):
            raise ConfigError("Nieznana font_family. Wybierz DejaVuSans/DejaVuSerif/DejaVuSansMono lub podaj font_path.")
        if (self.font_size_mm is None) == (self.font_size_pt is None):
            raise ConfigError("Ustaw dokładnie jedno z font_size_mm i font_size_pt (drugie: null).")
        font_size = self.font_size_mm if self.font_size_mm is not None else self.font_size_pt * 25.4 / 72
        if not 0 < font_size <= self.diameter_mm * 2:
            raise ConfigError("Rozmiar czcionki musi być dodatni i nie większy niż dwie średnice.")
        if self.border_width_mm >= self.diameter_mm / 2:
            raise ConfigError("border_width_mm musi być mniejsze niż połowa średnicy.")
        if self.columns < 1 or self.rows < 1:
            raise ConfigError("columns i rows muszą być dodatnie.")
        if self.start_number < 0 or self.end_number < self.start_number or self.preview_number < 0:
            raise ConfigError("Zakres numeracji musi być rosnący i nieujemny.")
        if self.end_number - self.start_number + 1 > self.columns * self.rows:
            raise ConfigError("Zakres numeracji przekracza pojemność siatki; zwiększ columns/rows.")
        for name in ("background_color", "number_color", "number_outline_color", "shadow_color", "border_color"):
            color = getattr(self, name)
            if name == "number_color" and color == "auto":
                continue
            try:
                if len(ImageColor.getrgb(color)) != 3:
                    raise ValueError("Kolory muszą być RGB, bez kanału alfa.")
            except ValueError as exc:
                raise ConfigError(f"Nieprawidłowy kolor {name}: {color!r}.") from exc
        if Path(self.preview_output).suffix.lower() != ".png":
            raise ConfigError("preview_output musi mieć rozszerzenie .png (przezroczystość).")
        if Path(self.pdf_output).suffix.lower() != ".pdf":
            raise ConfigError("pdf_output musi mieć rozszerzenie .pdf.")
        return self


def load_config(path: Path, overrides: dict | None = None) -> Config:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise ConfigError(f"Nie można odczytać konfiguracji {path}: {exc}") from exc
    if not isinstance(data, dict):
        raise ConfigError("Konfiguracja musi być obiektem JSON.")
    unknown = data.keys() - Config.__dataclass_fields__.keys()
    if unknown:
        raise ConfigError(f"Nieznane parametry: {', '.join(sorted(unknown))}.")
    data.update(overrides or {})
    return Config(**data).validate()


def resolve_path(base: Path, value: str) -> Path:
    path = Path(value)
    return path if path.is_absolute() else base / path


def atomic_json(path: Path, data: dict):
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(data, handle, indent=2, ensure_ascii=False, allow_nan=False)
            handle.write("\n")
        os.chmod(temporary, 0o644)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
