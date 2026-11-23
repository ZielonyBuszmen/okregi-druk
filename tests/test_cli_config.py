from dataclasses import replace
import json

import pytest

from src.config import ConfigError, atomic_json, load_config
from src.main import main


@pytest.mark.parametrize("changes", [
    {"washout": 101}, {"washout": -1}, {"blur_mm": -1}, {"image_scale": 0},
    {"dpi": 0}, {"dpi": True}, {"columns": 2.5}, {"diameter_mm": float("nan")},
    {"brightness": float("inf")}, {"number_color": "nonsense"}, {"image_fit": "stretch"},
    {"font_size_pt": 20}, {"font_size_mm": 0}, {"number_shadow": "false"},
    {"border_width_mm": 16}, {"shadow_opacity": 2}, {"preview_output": "x.jpg"},
    {"center_labels": []}, {"center_labels": "PREZES"}, {"center_labels": [42]},
    {"center_labels": [" "]}, {"center_labels": ["PREZES"], "preview_number": 2},
    {"center_line_spacing_mm": -1},
    {"center_decorations": ["coins"]}, {"center_decorations": []},
    {"center_labels": ["PREZES"], "preview_number": 1, "center_decorations": ["unknown"]},
    {"decoration_size_mm": 0}, {"decoration_accent_color": "invalid"},
])
def test_invalid_values(config, changes):
    with pytest.raises(ConfigError):
        replace(config, **changes).validate()


def test_bad_config_paths_json_and_unknown_fields(base):
    path = base / "config.json"
    for content in (None, "{", "[]", '{"typo": 1}'):
        if content is not None:
            path.write_text(content)
        with pytest.raises(ConfigError):
            load_config(path)


def test_preview_persists_overrides_history_and_no_pdf(config, base):
    path = base / "config.json"
    atomic_json(path, config.to_dict())
    command = ["preview", "--config", str(path)]
    assert main(command + ["--number", "12", "--washout", "40", "--font-size-pt", "38"]) == 0
    saved = load_config(path)
    assert saved.washout == 40 and saved.font_size_mm is None and saved.font_size_pt == 38
    assert (base / "output/preview.png").is_file()
    assert not list(base.rglob("*.pdf"))
    assert len(list((base / "output/history").glob("*.json"))) == 1
    assert main(command + ["--washout", "20"]) == 0
    histories = sorted((base / "output/history").glob("*.json"))
    assert len(histories) == 2
    assert json.loads(histories[0].read_text())["config"]["washout"] == 40
    assert main(command + ["--restore", str(histories[0])]) == 0
    assert load_config(path).washout == 40


def test_pdf_requires_current_preview_and_detects_changed_image(config, base):
    path = base / "config.json"
    atomic_json(path, config.to_dict())
    pdf = ["pdf", "--config", str(path)]
    preview = ["preview", "--config", str(path)]
    assert main(pdf) == 2
    assert not (base / "output/labels.pdf").exists()
    assert main(preview) == 0
    assert main(pdf + ["--washout", "60"]) == 2
    assert main(pdf) == 0
    assert (base / "output/labels.pdf").is_file()
    from PIL import Image
    Image.new("RGB", (400, 200), "green").save(base / "image.png")
    assert main(pdf) == 2


def test_failed_preview_keeps_config_and_reports_error(config, base, capsys):
    path = base / "config.json"
    atomic_json(path, config.to_dict())
    original = path.read_bytes()
    assert main(["preview", "--config", str(path), "--image", "absent.png"]) == 2
    assert "Nie można otworzyć obrazka" in capsys.readouterr().err
    assert path.read_bytes() == original


def test_badge_preview_without_image_persists_range_and_checks_caption(config, base):
    path = base / "config.json"
    atomic_json(path, config.to_dict())
    command = ["preview", "--config", str(path)]
    assert main(command + ["--background-mode", "badge", "--image", "absent.png", "--end-number", "15", "--rows", "3"]) == 0
    saved = load_config(path)
    assert saved.background_mode == "badge" and saved.end_number == 15 and saved.rows == 3
    assert not list(base.rglob("*.pdf"))
    from src.main import check_preview
    from src.renderer import LabelRenderer
    check_preview(saved, LabelRenderer(saved, base), base)
    changed = replace(saved, badge_top_text="LESZCZE 35")
    with pytest.raises(ConfigError, match="Brak zgodnego podglądu"):
        check_preview(changed, LabelRenderer(changed, base), base)


def test_preview_can_switch_font_size_from_points_back_to_mm(config, base):
    path = base / "config.json"
    atomic_json(path, replace(config, font_size_mm=None, font_size_pt=38).to_dict())
    assert main(["preview", "--config", str(path), "--font-size-mm", "13"]) == 0
    saved = load_config(path)
    assert saved.font_size_mm == 13 and saved.font_size_pt is None


def test_role_previews_preserve_both_captions_and_archive_settings(role_config, base):
    from src.main import check_preview
    from src.renderer import LabelRenderer

    path = base / "config.json"
    atomic_json(path, replace(role_config, center_labels=None).to_dict())
    command = ["preview", "--config", str(path)]
    decorations = ["fishing", "fishing", "coins", "coins"]
    assert main(command + ["--center-labels", json.dumps(role_config.center_labels), "--center-decorations", json.dumps(decorations), "--number", "1", "--output", "output/prezes.png"]) == 0
    assert main(command + ["--number", "3", "--output", "output/skarbnik.png"]) == 0
    saved = load_config(path)
    assert saved.center_labels == role_config.center_labels
    assert saved.center_decorations == decorations
    assert (base / "output/prezes.png").is_file() and (base / "output/skarbnik.png").is_file()
    assert len(list((base / "output/history").glob("*.png"))) == 2
    assert not list(base.rglob("*.pdf"))
    check_preview(saved, LabelRenderer(saved, base), base)
    changed = replace(saved, center_labels=["PREZES"] * 4)
    with pytest.raises(ConfigError, match="Brak zgodnego podglądu"):
        check_preview(changed, LabelRenderer(changed, base), base)
    assert main(command + ["--center-labels", "null", "--number", "1"]) == 0
    assert load_config(path).center_labels is None
    assert load_config(path).center_decorations is None
