"""CLI: preview zapisuje ustawienia; pdf wymaga zgodności z podglądem."""

import argparse
from dataclasses import fields
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import shutil
import sys

from .config import Config, ConfigError, atomic_json, load_config, resolve_path
from .pdf_generator import calculate_layout, generate_pdf
from .renderer import LabelRenderer, RENDERER_VERSION


HELP = {
    "center_labels": "lista JSON napisów zamiast numerów; null przywraca numerację; \\n rozdziela wiersze",
    "center_line_spacing_mm": "odstęp między wierszami napisu w środku, w mm",
    "center_decorations": "lista JSON ozdób dla center_labels: none, coins, fishing; null wyłącza",
    "background_mode": "image: obrazek w tle; badge: napisy na łuku i symbole bez ryby",
    "image": "PNG/JPG/WEBP; ścieżka względem pliku konfiguracji",
    "dpi": "rozdzielczość bitmapy (domyślnie 600 DPI)",
    "washout": "nałożenie bieli w procentach, 0–100",
    "brightness": "mnożnik jasności, 1 = bez zmiany",
    "contrast": "mnożnik kontrastu, 1 = bez zmiany",
    "saturation": "mnożnik nasycenia, 0 = szarość, 1 = bez zmiany",
    "image_scale": "mnożnik skali tła, 1 = bazowy cover/contain",
    "image_offset_x": "przesunięcie tła w mm; dodatnie w prawo",
    "image_offset_y": "przesunięcie tła w mm; dodatnie w dół",
    "number_color": "kolor CSS, np. black, white, #112233, lub auto",
    "font_path": "własny plik TTF/OTF; ma pierwszeństwo przed family/weight",
    "rows": "maksymalna liczba rzędów (bez dodawania stron)",
}


def parser():
    root = argparse.ArgumentParser(description="Okrągłe etykiety do druku A4. Najpierw preview, po akceptacji pdf.")
    commands = root.add_subparsers(dest="command", required=True)
    for command in ("preview", "pdf"):
        sub = commands.add_parser(command, help="podgląd PNG i zapis ustawień" if command == "preview" else "PDF zgodny z ostatnim podglądem")
        sub.add_argument("--config", type=Path, default=Path("config.json"), help="plik JSON (domyślnie config.json)")
        sub.add_argument("--output", help="ścieżka wyniku względem konfiguracji")
        if command == "preview":
            sub.add_argument("--restore", type=Path, help="przywróć ustawienia z JSON historii; ścieżka względem bieżącego katalogu")
        for field in fields(Config):
            name = "--" + field.name.replace("_", "-")
            args = [name]
            if field.name == "preview_number":
                args.append("--number")
            options = {"dest": field.name, "default": argparse.SUPPRESS}
            if field.name in ("center_labels", "center_decorations"):
                options["type"] = json.loads
            elif field.type is bool:
                options["action"] = argparse.BooleanOptionalAction
            elif field.type is int:
                options["type"] = int
            elif field.type is float or "float" in str(field.type):
                options["type"] = float
            else:
                options["type"] = str
            options["help"] = HELP.get(field.name, field.name.replace("_", " "))
            if field.name == "image_fit":
                options["choices"] = ("cover", "contain")
            if field.name == "background_mode":
                options["choices"] = ("image", "badge")
            if field.name == "font_weight":
                options["choices"] = ("regular", "bold")
            sub.add_argument(*args, **options)
    return root


def file_hash(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def signature(config, renderer):
    settings = config.to_dict()
    for key in ("preview_output", "pdf_output", "preview_number"):
        settings.pop(key)
    payload = {
        "renderer_version": RENDERER_VERSION,
        "settings": settings,
        "image_sha256": file_hash(renderer.image_path) if renderer.image_path is not None else None,
        "font_sha256": file_hash(renderer.font_path),
    }
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()


def create_preview(config, renderer, base, config_path):
    target = resolve_path(base, config.preview_output)
    target.parent.mkdir(parents=True, exist_ok=True)
    label = renderer.render(config.preview_number)
    # Jeden PNG etykiety; kopia w historii utrzymuje poprzednie wersje.
    label.save(target, format="PNG", dpi=(config.dpi, config.dpi))
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S_%fZ")
    history = target.parent / "history" / stamp
    history.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(target, history.with_suffix(".png"))
    manifest = {
        "created_at": stamp,
        "renderer_version": RENDERER_VERSION,
        "config": config.to_dict(),
        "number": config.preview_number,
        "signature": signature(config, renderer),
        "png_sha256": file_hash(target),
    }
    atomic_json(history.with_suffix(".json"), manifest)
    atomic_json(target.with_suffix(".json"), manifest)
    atomic_json(config_path, config.to_dict())
    print(f"Podgląd: {target}\nRozmiar: {label.width} × {label.height} px; {config.diameter_mm:g} mm; {config.dpi} DPI.")
    print(f"Historia ustawień: {history.with_suffix('.json')}\nNie wygenerowano PDF.")


def check_preview(config, renderer, base):
    target = resolve_path(base, config.preview_output)
    try:
        manifest = json.loads(target.with_suffix(".json").read_text(encoding="utf-8"))
        matches = isinstance(manifest, dict) and manifest.get("signature") == signature(config, renderer)
        matches = matches and manifest.get("png_sha256") == file_hash(target)
    except (OSError, ValueError):
        matches = False
    if not matches:
        raise ConfigError("Brak zgodnego podglądu PNG. Wygeneruj preview z aktualnymi ustawieniami, obejrzyj go i dopiero po akceptacji uruchom pdf.")


def main(argv=None):
    arg_parser = parser()
    args = arg_parser.parse_args(argv)
    config_path = args.config.resolve()
    base = config_path.parent
    overrides = {name: value for name, value in vars(args).items() if name in Config.__dataclass_fields__}
    if "font_size_mm" in overrides and "font_size_pt" in overrides:
        arg_parser.error("Użyj tylko jednego: --font-size-mm lub --font-size-pt.")
    if "font_size_mm" in overrides:
        overrides["font_size_pt"] = None
    elif "font_size_pt" in overrides:
        overrides["font_size_mm"] = None
    if "center_labels" in overrides and overrides["center_labels"] is None:
        overrides.setdefault("center_decorations", None)
    if args.output:
        overrides["preview_output" if args.command == "preview" else "pdf_output"] = args.output
    try:
        if getattr(args, "restore", None):
            try:
                restored = json.loads(args.restore.read_text(encoding="utf-8"))["config"]
            except (OSError, ValueError, KeyError, TypeError) as exc:
                raise ConfigError(f"Nie można przywrócić historii {args.restore}: {exc}") from exc
            if not isinstance(restored, dict) or restored.keys() - Config.__dataclass_fields__.keys():
                raise ConfigError("Nieprawidłowe ustawienia w pliku historii.")
            overrides = {**restored, **overrides}
        config = load_config(config_path, overrides)
        calculate_layout(config)  # Błędny układ zgłaszamy już w podglądzie.
        renderer = LabelRenderer(config, base)
        outputs = [
            resolve_path(base, config.preview_output),
            resolve_path(base, config.preview_output).with_suffix(".json"),
            resolve_path(base, config.pdf_output),
            resolve_path(base, config.pdf_output).with_suffix(".json"),
        ]
        protected = {config_path, resolve_path(base, config.image).resolve(), renderer.font_path.resolve()}
        if any(path.resolve() in protected for path in outputs) or len({p.resolve() for p in outputs}) != len(outputs):
            raise ConfigError("Ścieżki wynikowe muszą być różne i nie mogą nadpisywać konfiguracji, obrazka ani czcionki.")
        if args.command == "preview":
            create_preview(config, renderer, base, config_path)
        else:
            check_preview(config, renderer, base)
            path = resolve_path(base, config.pdf_output)
            generate_pdf(config, renderer, path)
            atomic_json(path.with_suffix(".json"), {"config": config.to_dict(), "signature": signature(config, renderer)})
            atomic_json(config_path, config.to_dict())
            print(f"PDF: {path}\nJedna strona A4; średnica {config.diameter_mm:g} mm. Drukuj w skali 100% / rzeczywisty rozmiar.")
        return 0
    except (ConfigError, OSError, ValueError) as exc:
        print(f"Błąd: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
