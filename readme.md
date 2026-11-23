# Numerowane okręgi do druku A4

Python 3.12, Pillow, ReportLab i Docker Compose. Bez interfejsu graficznego i serwera.
Jeden renderer tworzy przezroczysty PNG etykiety; PDF osadza dokładnie tę samą bitmapę.

## Gdzie są pliki

- [Aktualny podgląd numeru 12](output/preview.png) — gotowy PNG do obejrzenia.
- [Przykładowa grafika tła](input/example.png) — obraz użyty w podglądzie.
- `input/` — tutaj wrzucaj własne obrazki PNG, JPG lub WEBP.
- `output/history/` — wcześniejsze podglądy i zapisane ustawienia.
- [config.json](config.json) — aktualne parametry wyglądu i układu strony.
- [POSTEP.md](POSTEP.md) — zapis wykonanej pracy i wyników testów.
- [PLAN.md](PLAN.md) — dalsze kroki do zatwierdzenia i wydruku.

Katalog projektu w WSL: `/sciezka/do/projektu`.
Finalny PDF powstaje dopiero po zatwierdzeniu wyglądu.

## Start w WSL2 Ubuntu

Wymagany Docker z działającą integracją WSL2 oraz `docker compose`.
Wszystkie polecenia wykonuj w katalogu projektu.

```bash
# Właściciel wyników ma być taki sam jak użytkownik WSL.
export LOCAL_UID=$(id -u)
export LOCAL_GID=$(id -g)

docker compose build generator
docker compose run --rm generator --help
docker compose run --rm generator preview --help
docker compose run --rm generator preview --config config.json --number 12
```

Obrazek demonstracyjny jest już w `input/example.png`. Można go odtworzyć
(jeśli plik nie istnieje) poleceniem:

```bash
docker compose run --rm --entrypoint python generator tools/create_example.py
```

Wynik to `output/preview.png` — pojedynczy okrąg, z przezroczystością poza kołem.
Otwórz go z WSL lub z Eksploratora Windows (`explorer.exe output`). Przy 30 mm
i 600 DPI obraz ma 709 × 709 px. Zaokrąglenie do całych pikseli nie zmienia
fizycznej średnicy 30 mm w PDF. Na ekranie rozmiar zależy od powiększenia przeglądarki.

`input/` i `output/` są na dysku WSL i są bezpośrednio dostępne poza kontenerem.
Cały projekt jest montowany w `/app`; zmiany kodu i konfiguracji nie wymagają
przebudowy kontenera. Przebuduj obraz po zmianie zależności lub Dockerfile.
Domyślne UID/GID to 1000:1000; dla innych użytkowników ustaw powyższe zmienne.

## Współpraca i zatwierdzenie

1. Wrzuć własne PNG/JPG/WEBP do `input/`.
2. Poproś Codex np. „Zrób podgląd numeru 12, rozmycie 0,4 mm, rozjaśnienie bielą 40%, numer czarny”.
3. Obejrzyj `output/preview.png`, następnie zgłaszaj poprawki.
4. Napisz „Zatwierdzam, generuj PDF”, gdy wygląd będzie odpowiedni.

Codex ma uruchamiać `pdf` **dopiero po wyraźnym zatwierdzeniu**.
Samo uruchomienie polecenia `pdf` przez użytkownika oznacza zatwierdzenie ostatniego
podglądu. Program nie uruchamia PDF po podglądzie. Dodatkowo sprawdza, czy aktualna
konfiguracja, zawartość obrazka i czcionki odpowiadają zapisanemu podglądowi oraz
czy PNG nie został zmieniony. Po zmianach trzeba ponownie utworzyć i obejrzeć podgląd.

Po akceptacji:

```bash
docker compose run --rm generator pdf --config config.json
```

Powstanie `output/labels.pdf` i kopia użytej konfiguracji `output/labels.json`.
PDF ma jedną stronę 210 × 297 mm i etykiety o średnicy dokładnie 30 mm.
W drukarce wybierz **100% / rzeczywisty rozmiar**, wyłącz „dopasuj do strony”.
PDF zawiera również preferencję `PrintScaling=None`. Rzeczywista dokładność wydruku
zależy od sterownika i drukarki — pierwszy arkusz warto zmierzyć linijką.

## Konfiguracja i CLI

`config.json` zawiera komplet ustawień. Każde pole JSON ma odpowiednik CLI:
podkreślenia zamień na myślniki, np. `image_offset_x` → `--image-offset-x`.
Ścieżki w konfiguracji i opcjach CLI są względem katalogu pliku `--config`,
a nie katalogu obrazka. Ścieżka samego `--config` jest względem bieżącego katalogu.
Własny font umieść np. w `input/moj-font.ttf`.

```bash
docker compose run --rm generator preview --config config.json \
  --image input/moj-obrazek.webp --number 12 \
  --blur-mm 0.4 --washout 40 --saturation 0.6 --number-color black

docker compose run --rm generator preview --config config.json \
  --blur-mm 0.2 --font-size-mm 16 --number-outline-mm 0.15 \
  --number-outline-color white --number-shadow

docker compose run --rm generator preview --config config.json \
  --image-fit contain --image-scale 1.15 --image-offset-y -1 \
  --number-color auto --no-border-enabled --no-number-shadow
```

Udany podgląd zapisuje efektywne ustawienia do `config.json`. Kolejne wywołanie
zaczyna od nich; podane opcje nadpisują tylko wskazane wartości. Błąd walidacji
lub brak obrazka nie zmienia konfiguracji. `--output output/inny.png` zmienia
`preview_output`; w poleceniu `pdf` zmienia `pdf_output`.

| Pola konfiguracji | Znaczenie i jednostki |
| --- | --- |
| `image`, `dpi`, `diameter_mm` | Plik PNG/JPG/WEBP, DPI (600), średnica w mm (30) |
| `blur_mm` | Promień Gaussa w mm, domyślnie 0 |
| `washout` | Nałożenie bieli, 0–100%; przykład startowy: 40 |
| `brightness`, `contrast`, `saturation` | Mnożniki ≥ 0; 1 = bez zmiany, saturation 0 = szarość |
| `image_fit` | `cover` wypełnia i kadruje, `contain` mieści cały obraz |
| `image_scale` | Dodatni mnożnik skali względem cover/contain; 1 = bazowy kadr |
| `image_offset_x`, `image_offset_y` | Przesunięcia w mm; dodatnie w prawo / w dół |
| `background_color` | Kolor pustych miejsc przy contain, oddaleniu lub przezroczystym obrazie |
| `font_family` | DejaVuSans, DejaVuSerif lub DejaVuSansMono |
| `font_weight` | `regular` lub `bold`; domyślnie pogrubiona bezszeryfowa |
| `font_path` | Opcjonalny TTF/OTF; zawiera wybrany krój/grubość i zastępuje family/weight |
| `font_size_mm`, `font_size_pt` | Rozmiar em czcionki, nie wysokość widocznego znaku; dokładnie jedno pole liczbowe, drugie `null` |
| `number_color` | Kolor CSS/hex lub `auto` (czerń/biel na podstawie tła pod cyframi) |
| `number_outline_mm`, `number_outline_color` | Grubość i kolor obrysu cyfr; 0 wyłącza |
| `number_shadow` | Cień włączany `--number-shadow`, wyłączany `--no-number-shadow` |
| `shadow_color`, `shadow_opacity` | Kolor i krycie cienia 0–1 |
| `shadow_blur_mm`, `shadow_offset_x_mm`, `shadow_offset_y_mm` | Rozmycie i przesunięcia cienia w mm |
| `number_offset_x_mm`, `number_offset_y_mm` | Ręczna korekta optycznego położenia cyfr w mm |
| `border_enabled`, `border_color`, `border_width_mm` | Obrys do cięcia, domyślnie czarny 0,2 mm; w całości wewnątrz średnicy |
| `columns`, `rows` | Liczba kolumn i maksymalna liczba rzędów; domyślnie 5 × 7 |
| `gap_x_mm`, `gap_y_mm` | Odstępy między krawędziami etykiet w mm, domyślnie 4 |
| `margin_left_mm`, `margin_right_mm`, `margin_top_mm`, `margin_bottom_mm` | Minimalne marginesy w mm, domyślnie 10 |
| `start_number`, `end_number` | Domknięty zakres numerów, domyślnie 1–33 |
| `preview_number` | Numer podglądu, domyślnie 12; alias CLI `--number` |
| `preview_output`, `pdf_output` | Ścieżki wynikowego PNG i PDF |

`--font-size-mm` zeruje ustawienie punktowe, a `--font-size-pt` zeruje ustawienie
w mm. Nie podawaj obu opcji naraz. W JSON ustaw drugą jednostkę na `null`.
Kolory mogą mieć nazwy CSS lub format `#RRGGBB` (w powłoce otocz hex cudzysłowem).

Kolejność efektów: kadr bez zmiany proporcji → rozmycie → nasycenie → kontrast →
jasność → biała warstwa → cień / obrys cyfry / cyfra → obrys koła → przycięcie
całej kompozycji maską kołową. Maska ma antyaliasing. Pozycja cyfr uwzględnia
faktyczny obrys znaków i metryki czcionki, a nie jedynie szerokość tekstu
czy pozycję linii bazowej. Ręczne przesunięcia pozwalają dopracować optykę własnego fontu.
Zmniejszenie image_scale poniżej 1 lub przesunięcie obrazka może odsłonić kolor tła.

Siatka jest wyśrodkowana w obszarze ograniczonym marginesami. Przy równych
marginesach jej środek pokrywa się ze środkiem kartki. Domyślnie zajmuje
166 × 234 mm, zaczyna się w (22; 31,5) mm. Ostatni rząd 31–33 ma środki
w x = 71, 105 i 139 mm. Każdy niepełny ostatni rząd jest centrowany.
Wykorzystywane są tylko potrzebne rzędy; `rows` jest ograniczeniem pojemności.
Układ jest sprawdzany również przed podglądem. Program zgłasza błąd zamiast
zmniejszać etykiety lub dodawać strony.

## Historia ustawień

Każdy udany podgląd zapisuje `output/preview.png`, manifest `output/preview.json`
oraz parę `output/history/<czas UTC>.png` / `.json`. Manifest zawiera pełną
konfigurację i sumy kontrolne, więc poprzednie wersje można obejrzeć i odtworzyć.
Pliki JSON historii nie są samodzielnymi plikami konfiguracji; użyj `--restore`:

```bash
docker compose run --rm generator preview --config config.json \
  --restore output/history/20261123T120000_000000Z.json
```

Zastąp nazwę pliku rzeczywistą nazwą z katalogu historii. Ścieżka `--restore`
jest względem bieżącego katalogu. Możesz dodać kolejne opcje nadpisujące
przywrócone ustawienia. Przechowuj też oryginalne obrazy i fonty — historia
nie archiwizuje ich zawartości. Aby zachować wariant w osobnym pliku konfiguracji,
skopiuj `config.json` w to samo miejsce pod inną nazwą.

## Testy

```bash
docker compose run --rm --entrypoint python generator -m pytest -q -p no:cacheprovider
```

Testy sprawdzają geometrię i centrowanie siatki 1–33, metryki cyfr 1–33,
proporcje cover/contain, przezroczystość poza kołem, łączenie efektów i nadpisania
CLI, historię, błędne ścieżki/parametry oraz blokadę PDF po zmianie ustawień.
Testy PDF weryfikują jedną stronę A4, macierze osadzania 30 mm i identyczność
RGB oraz maski alfa etykiety 12 z rendererem podglądu. PDF-y testowe powstają
wyłącznie w katalogach tymczasowych pytest (wewnątrz kontenera), poza `output/`.

Dokumentacja bibliotek: [Pillow — ImageDraw](https://pillow.readthedocs.io/en/stable/reference/ImageDraw.html),
[Pillow — GaussianBlur](https://pillow.readthedocs.io/en/stable/reference/ImageFilter.html),
[ReportLab — pdfgen](https://docs.reportlab.com/reportlab/userguide/ch2_graphics/).
