"""Jedyny renderer etykiet: identyczne piksele w PNG i osadzonym PDF."""

from pathlib import Path

from PIL import Image, ImageChops, ImageColor, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps, ImageStat

from .config import Config, ConfigError, resolve_path

RENDERER_VERSION = 1


class LabelRenderer:
    def __init__(self, config: Config, base: Path):
        self.config = config.validate()
        self.size = round(config.diameter_mm / 25.4 * config.dpi)
        self.px_per_mm = self.size / config.diameter_mm
        self.image_path = resolve_path(base, config.image)
        self.font_path = self.resolve_font(config, base)
        try:
            with Image.open(self.image_path) as source:
                if source.format not in ("PNG", "JPEG", "WEBP"):
                    raise ConfigError("Obrazek musi być w formacie PNG, JPG lub WEBP.")
                self.source = ImageOps.exif_transpose(source).convert("RGBA")
        except (OSError, ValueError, Image.DecompressionBombError) as exc:
            raise ConfigError(f"Nie można otworzyć obrazka {self.image_path}: {exc}") from exc
        font_mm = config.font_size_mm if config.font_size_mm is not None else config.font_size_pt * 25.4 / 72
        try:
            self.font = ImageFont.truetype(str(self.font_path), max(1, round(font_mm * self.px_per_mm)))
        except OSError as exc:
            raise ConfigError(f"Nie można otworzyć czcionki {self.font_path}.") from exc
        self.circle = self.circle_mask()
        self.background = self.render_background()

    @staticmethod
    def resolve_font(config, base):
        if config.font_path:
            return resolve_path(base, config.font_path)
        suffix = "-Bold" if config.font_weight == "bold" else ""
        return Path(f"/usr/share/fonts/truetype/dejavu/{config.font_family}{suffix}.ttf")

    def circle_mask(self, inset=0.0):
        scale = 4
        size = self.size * scale
        mask = Image.new("L", (size, size))
        edge = inset * scale
        ImageDraw.Draw(mask).ellipse((edge, edge, size - 1 - edge, size - 1 - edge), fill=255)
        return mask.resize((self.size, self.size), Image.Resampling.LANCZOS)

    def render_background(self):
        c = self.config
        source = Image.new("RGBA", self.source.size, ImageColor.getrgb(c.background_color))
        source.alpha_composite(self.source)
        source = source.convert("RGB")
        ratio = (max if c.image_fit == "cover" else min)(self.size / source.width, self.size / source.height)
        ratio *= c.image_scale
        left = (self.size - source.width * ratio) / 2 + c.image_offset_x * self.px_per_mm
        top = (self.size - source.height * ratio) / 2 + c.image_offset_y * self.px_per_mm
        background = source.transform(
            (self.size, self.size), Image.Transform.AFFINE,
            (1 / ratio, 0, -left / ratio, 0, 1 / ratio, -top / ratio),
            resample=Image.Resampling.BICUBIC, fillcolor=ImageColor.getrgb(c.background_color),
        )
        if c.blur_mm:
            background = background.filter(ImageFilter.GaussianBlur(c.blur_mm * self.px_per_mm))
        background = ImageEnhance.Color(background).enhance(c.saturation)
        background = ImageEnhance.Contrast(background).enhance(c.contrast)
        background = ImageEnhance.Brightness(background).enhance(c.brightness)
        return Image.blend(background, Image.new("RGB", background.size, "white"), c.washout / 100)

    def text_mask(self, number: int, stroke_px=0):
        c = self.config
        text = str(number)
        bounds = self.font.getbbox(text, stroke_width=stroke_px)
        tile = Image.new("L", (bounds[2] - bounds[0] + 4, bounds[3] - bounds[1] + 4))
        origin = (2 - bounds[0], 2 - bounds[1])
        ImageDraw.Draw(tile).text(origin, text, font=self.font, fill=255)
        # Metryki fontu zawierają boczne odstępy. Centruj rzeczywiste piksele
        # bez obrysu; ten sam punkt odniesienia obowiązuje też obrys cyfry.
        ink = tile.getbbox()
        if ink is None:
            raise ConfigError(f"Czcionka nie zawiera widocznych znaków numeru {number}.")
        x = self.size / 2 - (ink[0] + ink[2]) / 2 + c.number_offset_x_mm * self.px_per_mm
        y = self.size / 2 - (ink[1] + ink[3]) / 2 + c.number_offset_y_mm * self.px_per_mm
        if stroke_px:
            ImageDraw.Draw(tile).text(origin, text, font=self.font, fill=255, stroke_width=stroke_px)
        mask = Image.new("L", (self.size, self.size))
        mask.paste(tile, (round(x), round(y)))
        return mask

    def number_color(self, mask):
        if self.config.number_color != "auto":
            return self.config.number_color
        # Kontrast WCAG na obszarze pod cyframi, po wszystkich efektach tła.
        channels = ImageStat.Stat(self.background, mask=mask).mean
        linear = [(v / 255 / 12.92 if v / 255 <= 0.04045 else ((v / 255 + 0.055) / 1.055) ** 2.4) for v in channels]
        luminance = sum(v * weight for v, weight in zip(linear, (0.2126, 0.7152, 0.0722)))
        return "black" if (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) else "white"

    def render(self, number: int) -> Image.Image:
        if type(number) is not int or number < 0:
            raise ConfigError("Numer etykiety musi być nieujemną liczbą całkowitą.")
        c = self.config
        label = self.background.convert("RGBA")
        mask = self.text_mask(number)
        if mask.getbbox() is None:
            raise ConfigError(f"Numer {number} leży całkowicie poza etykietą; popraw rozmiar/przesunięcie.")
        outline = self.text_mask(number, round(c.number_outline_mm * self.px_per_mm))
        if c.number_shadow:
            shadow = Image.new("L", mask.size)
            shadow.paste(outline, (round(c.shadow_offset_x_mm * self.px_per_mm), round(c.shadow_offset_y_mm * self.px_per_mm)))
            shadow = shadow.filter(ImageFilter.GaussianBlur(c.shadow_blur_mm * self.px_per_mm))
            shadow = shadow.point(lambda value: round(value * c.shadow_opacity))
            label.paste(ImageColor.getrgb(c.shadow_color), mask=shadow)
        if c.number_outline_mm:
            label.paste(ImageColor.getrgb(c.number_outline_color), mask=outline)
        label.paste(ImageColor.getrgb(self.number_color(mask)), mask=mask)
        if c.border_enabled and c.border_width_mm:
            inner = self.circle_mask(c.border_width_mm * self.px_per_mm)
            border = ImageChops.subtract(self.circle, inner)
            label.paste(ImageColor.getrgb(c.border_color), mask=border)
        # Przycięcie całej kompozycji, włącznie z cieniem, numerem i obrysem.
        label.putalpha(self.circle)
        return label
