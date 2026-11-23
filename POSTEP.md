# Postęp projektu

Stan na 23 listopada 2026: implementacja zakończona, projekt działa w Dockerze
na WSL2. Ten etap nie wymaga dalszego oczekiwania na implementację.

## Wykonane

- Przygotowano Dockerfile, Docker Compose, przypięte zależności i konfigurację JSON.
- Zaimplementowano CLI z osobnymi poleceniami `preview` i `pdf`, pomocą
  oraz nadpisywaniem wszystkich ustawień konfiguracji.
- Zaimplementowano jeden wspólny renderer Pillow dla PNG i etykiet w PDF.
- Dodano kadrowanie cover/contain bez deformacji proporcji, przesunięcia,
  skalowanie, rozmycie, rozjaśnianie bielą, jasność, kontrast i nasycenie.
- Dodano duże cyfry, centrowanie według rzeczywistych pikseli znaków,
  wybór kroju/grubości/koloru, obrys, cień i automatyczny dobór czerni/bieli.
- Dodano przezroczystość poza kołem i wewnętrzny obrys do wycinania.
- Zaimplementowano jednostronicową siatkę A4: 33 etykiety po 30 mm,
  5 kolumn, maksymalnie 7 rzędów, odstępy 4 mm, wyśrodkowany ostatni rząd 31–33.
- Dodano walidację parametrów, wymiarów strony i ścieżek.
- Podglądy zapisują aktualną konfigurację i historię ustawień oraz PNG.
- Tryb PDF sprawdza zgodność ustawień, źródła grafiki i fontu z podglądem.
- Dodano instrukcję [readme.md](readme.md) i zasady dalszej współpracy w AGENTS.md.
- Zbudowano końcowy obraz `okregi-druk:local`.

## Sprawdzenie

Polecenie:

```bash
docker compose run --rm --entrypoint python generator -m pytest -q -p no:cacheprovider
```

Wynik: **92 testy zakończone sukcesem** (11,23 s).
Testy obejmują także tymczasowe PDF-y przy 150 i 600 DPI, jedną stronę A4,
fizyczną średnicę 30 mm oraz porównanie pikseli RGB i maski alfa z PNG.
Testowe PDF-y powstawały poza katalogiem wynikowym, w katalogach tymczasowych kontenera.

Wygenerowano i obejrzano podgląd numeru 12: 709 × 709 px, RGBA, 600 DPI,
przezroczyste narożniki. Pliki należą do użytkownika WSL (UID/GID 1000:1000).

## Gdzie są obrazki

- Aktualny podgląd: [output/preview.png](output/preview.png).
- Przykładowe tło: [input/example.png](input/example.png).
- Ustawienia aktualnego podglądu: [output/preview.json](output/preview.json).
- Poprzednie podglądy i ustawienia: `output/history/`.
- Miejsce na własne obrazki: `input/`.

Pełna ścieżka podglądu w WSL:
`/sciezka/do/projektu/output/preview.png`.

**Finalny PDF nie został wygenerowany.** W `output/` nie ma PDF-ów.
Przed jego utworzeniem wymagana jest wyraźna akceptacja użytkownika.

Aktualny wygląd: przykładowa grafika, numer 12 czarny i pogrubiony,
rozmiar czcionki 15 mm, rozmycie 0 mm, biała warstwa 40%, nasycenie 0,75,
obrys koła czarny 0,2 mm. Pełne ustawienia znajdują się w `config.json`.
