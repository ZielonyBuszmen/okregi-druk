"""Jedyny renderer etykiet: identyczne piksele w PNG i osadzonym PDF."""

import math
from pathlib import Path

from PIL import Image, ImageChops, ImageColor, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps, ImageStat

from .config import Config, ConfigError, resolve_path

RENDERER_VERSION = 5


class LabelRenderer:
    def __init__(self, config: Config, base: Path):
        self.config = config.validate()
        self.size = round(config.diameter_mm / 25.4 * config.dpi)
        self.px_per_mm = self.size / config.diameter_mm
        self.image_path = resolve_path(base, config.image) if config.background_mode == "image" else None
        self.font_path = self.resolve_font(config, base)
        if self.image_path is not None:
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
        if c.background_mode == "badge":
            return self.render_badge()
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

    def render_badge(self):
        """Odtworzone linie i napisy; środek pozostaje pusty na numer."""
        c = self.config
        scale = 3
        size = self.size * scale
        ppm = self.px_per_mm * scale
        center = (size - 1) / 2
        label = Image.new("RGBA", (size, size), c.background_color)
        font = ImageFont.truetype(str(self.font_path), max(1, round(c.badge_font_size_mm * ppm)))

        def curved_text(text, span, bottom=False):
            widths = [font.getlength(char) for char in text]
            radius = c.badge_text_radius_mm * ppm
            arc_length = math.radians(span) * radius
            tracking = (arc_length - sum(widths)) / max(1, len(text) - 1)
            if tracking < 0:
                raise ConfigError(f"Napis {text!r} nie mieści się na łuku; zmniejsz badge_font_size_mm lub zwiększ kąt.")
            cursor = -arc_length / 2
            for char, width in zip(text, widths):
                delta = math.degrees((cursor + width / 2) / radius)
                angle = 90 - delta if bottom else -90 + delta
                if not char.isspace():
                    bounds = font.getbbox(char)
                    tile = Image.new("RGBA", (bounds[2] - bounds[0] + 12, bounds[3] - bounds[1] + 12))
                    ImageDraw.Draw(tile).text((6 - bounds[0], 6 - bounds[1]), char, font=font, fill=c.badge_color)
                    rotated = tile.rotate(90 - angle if bottom else -90 - angle, resample=Image.Resampling.BICUBIC, expand=True)
                    radians = math.radians(angle)
                    x = center + radius * math.cos(radians)
                    y = center + radius * math.sin(radians)
                    label.alpha_composite(rotated, (round(x - rotated.width / 2), round(y - rotated.height / 2)))
                cursor += width + tracking

        curved_text(c.badge_top_text, c.badge_top_span_deg)
        curved_text(c.badge_bottom_text, c.badge_bottom_span_deg, bottom=True)
        draw = ImageDraw.Draw(label)
        radius = c.badge_inner_radius_mm * ppm
        bounds = (center - radius, center - radius, center + radius, center + radius)
        if c.badge_inner_width_mm:
            width = max(1, round(c.badge_inner_width_mm * ppm))
            draw.arc(bounds, 213, 327, fill=c.badge_color, width=width)
            draw.arc(bounds, 0, 180, fill=c.badge_color, width=width)
        if c.badge_symbols:
            # Koszyczek zanętowy i spławik w przerwach pomiędzy napisami.
            unit = size / 30

            def box(x0, y0, x1, y1):
                return tuple(value * unit for value in (x0, y0, x1, y1))

            thin = max(1, round(0.10 * unit))
            color = c.badge_color
            draw.ellipse(box(2.55, 9.0, 3.8, 12.0), outline=color, width=thin)
            draw.rectangle(box(2.55, 9.85, 3.8, 11.55), outline=color, width=thin)
            for x in (2.85, 3.18, 3.5):
                draw.line(box(x, 9.85, x, 11.55), fill=color, width=thin)
            for y in (10.25, 10.7, 11.15):
                draw.line(box(2.55, y, 3.8, y), fill=color, width=thin)
            draw.ellipse(box(2.82, 11.7, 3.53, 13.0), fill=color)
            draw.line(box(26.82, 9.0, 26.82, 12.9), fill=color, width=thin)
            draw.ellipse(box(26.16, 10.0, 27.48, 12.0), fill=color)
        return label.convert("RGB").resize((self.size, self.size), Image.Resampling.LANCZOS)

    def render_decoration(self, number: int):
        c = self.config
        if c.center_decorations is None:
            return None
        if type(number) is not int or not 1 <= number <= len(c.center_decorations):
            raise ConfigError("Pozycja ozdoby musi wskazywać element center_decorations (od 1).")
        kind = c.center_decorations[number - 1]
        if kind == "none":
            return None
        scale = 3
        layer = Image.new("RGBA", (self.size * scale, self.size * scale))
        draw = ImageDraw.Draw(layer)
        unit = c.decoration_size_mm / 12 * self.px_per_mm * scale
        cx = self.size * scale / 2
        cy = cx + c.decoration_offset_y_mm * self.px_per_mm * scale
        navy = c.badge_color
        gold = c.decoration_accent_color
        rgb = ImageColor.getrgb(gold)
        light = tuple(round(channel * 0.5 + 255 * 0.5) for channel in rgb)
        thin = max(1, round(0.13 * unit))

        def point(x, y):
            return (cx + x * unit, cy + y * unit)

        def box(x0, y0, x1, y1):
            return (*point(x0, y0), *point(x1, y1))

        if kind == "coins":
            for x, count in ((-3.2, 3), (3.1, 4)):
                for level in range(count):
                    y = 1.3 - level * 0.8
                    draw.rectangle(box(x - 2, y, x + 2, y + 0.7), fill=gold, outline=navy, width=thin)
                    draw.ellipse(box(x - 2, y + 0.1, x + 2, y + 1.1), fill=gold, outline=navy, width=thin)
                    draw.ellipse(box(x - 2, y - 0.5, x + 2, y + 0.5), fill=light, outline=navy, width=thin)
            draw.ellipse(box(-2.4, -2.4, 2.4, 2.4), fill=gold, outline=navy, width=thin)
            draw.ellipse(box(-1.95, -1.95, 1.95, 1.95), outline=navy, width=thin)
            font = ImageFont.truetype(str(self.font_path), max(1, round(1.65 * unit)))
            draw.text(point(0, 0), "zł", font=font, fill=navy, anchor="mm")
        else:
            for side in (-1, 1):
                branch = [(side * x, y) for x, y in ((0.4, 2.6), (2.6, 2.2), (4.3, 1.1), (5.1, -0.5), (5, -2))]
                draw.line([point(x, y) for x, y in branch], fill=gold, width=thin, joint="curve")
                for x, y, angle in ((1.7, 2.45, 25), (3.2, 1.9, 5), (4.4, 0.8, -25), (5, -0.6, -65), (5, -1.8, -95)):
                    radians = math.radians(angle)
                    dx, dy = math.cos(radians), math.sin(radians)
                    for flip in (-1, 1):
                        leaf = [
                            (x, y),
                            (x + 0.6 * dx - flip * 0.35 * dy, y + 0.6 * dy + flip * 0.35 * dx),
                            (x + 1.25 * dx, y + 1.25 * dy),
                        ]
                        draw.polygon([point(side * px, py) for px, py in leaf], fill=gold)
            rod_scale = c.fishing_rods_scale

            def rod_point(x, y):
                return point(x * rod_scale, y * rod_scale)

            def rod_box(x0, y0, x1, y1):
                return (*rod_point(x0, y0), *rod_point(x1, y1))

            rod_thin = max(1, round(0.13 * unit * rod_scale))
            for side in (-1, 1):
                handle = [rod_point(side * -2.5, 2), rod_point(side * -1.3, 0.8)]
                draw.line(handle, fill=navy, width=max(1, round(0.38 * unit * rod_scale)))
                draw.line([rod_point(side * -2.5, 2), rod_point(side * 2.8, -2.5)], fill=navy, width=rod_thin)
                x = side * -1.45
                draw.ellipse(rod_box(x - 0.45, 0.6, x + 0.45, 1.5), fill=light, outline=navy, width=rod_thin)
                tip = side * 2.8
                draw.line([rod_point(tip, -2.5), rod_point(tip, -0.2)], fill=navy, width=max(1, round(0.07 * unit * rod_scale)))
                draw.arc(rod_box(tip - 0.3, -0.5, tip + 0.3, 0.2), 0, 180, fill=navy, width=rod_thin)
        result = layer.resize((self.size, self.size), Image.Resampling.LANCZOS)
        bounds = result.getbbox()
        radius_mm = c.badge_inner_radius_mm if c.background_mode == "badge" else c.diameter_mm / 2 - c.border_width_mm
        if bounds and any(math.hypot(x - self.size / 2, y - self.size / 2) > radius_mm * self.px_per_mm
                          for x in (bounds[0], bounds[2]) for y in (bounds[1], bounds[3])):
            raise ConfigError("Ozdoba nie mieści się wewnątrz koła; zmniejsz decoration_size_mm lub zmień jej położenie.")
        return result

    def text_mask(self, number: int, stroke_px=0):
        c = self.config
        if c.center_labels is None:
            text = str(number)
        else:
            if type(number) is not int or not 1 <= number <= len(c.center_labels):
                raise ConfigError("Pozycja napisu musi wskazywać element center_labels (od 1).")
            text = c.center_labels[number - 1]
        spacing = round(c.center_line_spacing_mm * self.px_per_mm)
        if "\n" in text:
            bounds = ImageDraw.Draw(Image.new("L", (1, 1))).multiline_textbbox(
                (0, 0), text, font=self.font, spacing=spacing, align="center", stroke_width=stroke_px,
            )
            bounds = (math.floor(bounds[0]), math.floor(bounds[1]), math.ceil(bounds[2]), math.ceil(bounds[3]))
        else:
            bounds = self.font.getbbox(text, stroke_width=stroke_px)
        tile = Image.new("L", (bounds[2] - bounds[0] + 4, bounds[3] - bounds[1] + 4))
        origin = (2 - bounds[0], 2 - bounds[1])
        options = {"spacing": spacing, "align": "center"} if "\n" in text else {}
        ImageDraw.Draw(tile).text(origin, text, font=self.font, fill=255, **options)
        # Metryki fontu zawierają boczne odstępy. Centruj rzeczywiste piksele
        # bez obrysu; ten sam punkt odniesienia obowiązuje też obrys cyfry.
        ink = tile.getbbox()
        if ink is None:
            raise ConfigError(f"Czcionka nie zawiera widocznych znaków numeru {number}.")
        x = self.size / 2 - (ink[0] + ink[2]) / 2 + c.number_offset_x_mm * self.px_per_mm
        y = self.size / 2 - (ink[1] + ink[3]) / 2 + c.number_offset_y_mm * self.px_per_mm
        if stroke_px:
            ImageDraw.Draw(tile).text(origin, text, font=self.font, fill=255, stroke_width=stroke_px, **options)
        if c.center_labels is not None:
            radius_mm = c.badge_inner_radius_mm if c.background_mode == "badge" else c.diameter_mm / 2 - c.border_width_mm
            radius = radius_mm * self.px_per_mm
            allowed = Image.new("L", tile.size)
            cx, cy = self.size / 2 - round(x), self.size / 2 - round(y)
            ImageDraw.Draw(allowed).ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=255)
            if ImageChops.subtract(tile, allowed).getbbox():
                raise ConfigError(f"Napis {text!r} nie mieści się wewnątrz koła; zmniejsz font_size_mm lub podziel tekst na wiersze.")
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
        decoration = self.render_decoration(number)
        if decoration is not None:
            label.alpha_composite(decoration)
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
