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
- Dodano tryb `badge`: odtworzenie okrągłego wzoru ze zdjęcia bez ryby,
  z napisami „LESZCZE 34” / „KOŁO OM PZW KOMOROWO”, koszyczkiem i spławikiem.
- Ustawiono średnicę 37 mm, zakres numerów 1–15 i układ 4 × 4
  (ostatni rząd z trzema etykietami wyśrodkowany).
  Wszystkie ustawienia wzoru znajdują się w `config.json`.
- Naprawiono nadpisanie `--font-size-mm`, w tym zmianę z jednostek punktowych.
- Przygotowano nowy podgląd: u góry „KOMOROWO”, numeracja 1–30, średnica 37 mm.
  Układ 5 × 6 mieści się na A4 dzięki odstępowi 1 mm między kolumnami;
  odstęp między rzędami pozostaje 4 mm. Sprawdzono konfigurację i obejrzano PNG.
  Podgląd i ustawienia zarchiwizowano w `output/history/`.
- Dolny napis zmieniono na „Koło PZW Nr-34”, z zachowaniem wielkości liter
  i łącznika. Po uwagach użytkownika nieco zwiększono odstępy w obu napisach:
  górny łuk zajmuje 120°, a dolny 132°. Rozmiar liter pozostał bez zmian.
  Aktualny podgląd wygenerowano w Dockerze i obejrzano.
- Dodano napisy środkowe zamiast numerów (`center_labels`) oraz obsługę
  wielu wierszy i ustawienia odstępu między nimi.
  Przygotowano dwa podglądy: PREZES i SKARBNIK / KOŁA, po 37 mm.
  Konfiguracja zawiera po dwie identyczne kopie każdego wzoru (układ 2 × 2).
  Napisy większe niż środek koła są odrzucane bez automatycznego skalowania.
- Dodano ozdoby środkowe (`center_decorations`): monety dla skarbnika,
  skrzyżowane wędki i złoty wieniec dla prezesa. Ozdoby są rysowane
  w tym samym rendererze PNG/PDF i zapisane w konfiguracji dla każdej kopii.
  Tekst przesunięto o 2 mm w dół, robiąc miejsce na ozdoby powyżej.
  Kontrola dopasowania tekstu uwzględnia widoczne znaki, także w wielu wierszach.
- Powiększono same wędki prezesa o 80% względem pierwotnych (`fishing_rods_scale: 1.8`),
  zachowując rozmiar wieńca i monet skarbnika. Średnica etykiety nadal wynosi 37 mm.
  To o 44% więcej niż w poprzednim podglądzie ze skalą 1,25.
  Nowy podgląd wygenerowano w Dockerze i obejrzano; finalnego PDF nie generowano.

## Sprawdzenie

Polecenie:

```bash
docker compose run --rm --entrypoint python generator -m pytest -q -p no:cacheprovider
```

Aktualny wynik: **115 testów zakończonych sukcesem** (9,99 s).
Dodane testy sprawdzają centrowanie tekstu, identyczność kopii, odrzucenie
przycinania, zapis obu podglądów i konfiguracji oraz testowy PDF z czterema
etykietami 37 mm. PDF testowy powstał wyłącznie w katalogu tymczasowym.
Testy ozdób sprawdzają położenie wewnątrz koła, brak kolizji z tekstem,
identyczność kopii i pikseli dekorowanych etykiet w testowym PDF oraz
obsługę ozdób przez CLI i powrót do numeracji.
Testy obejmują także tymczasowe PDF-y przy 150 i 600 DPI, jedną stronę A4,
fizyczną średnicę 30 mm oraz porównanie pikseli RGB i maski alfa z PNG.
Testowe PDF-y powstawały poza katalogiem wynikowym, w katalogach tymczasowych kontenera.
Dodatkowe testy obejmują pusty środek wzoru bez pliku obrazka, odrzucenie
zbyt długiego napisu, zapis zakresu 1–15, sprawdzanie zgodności napisów
z podglądem i zmianę jednostek rozmiaru czcionki w CLI.
Porównanie pikseli PNG/PDF obejmuje oba tryby: `image` i `badge`.

Wygenerowano i obejrzano podglądy PREZES i SKARBNIK KOŁA: 874 × 874 px, 37 mm, RGBA, 600 DPI,
przezroczyste narożniki. Pliki należą do użytkownika WSL (UID/GID 1000:1000).

## Gdzie są obrazki

- Aktualny podgląd: [output/preview.png](output/preview.png).
- PREZES: [output/preview-prezes.png](output/preview-prezes.png).
- SKARBNIK KOŁA: [output/preview-skarbnik.png](output/preview-skarbnik.png).
- Przykładowe tło: [input/example.png](input/example.png).
- Ustawienia aktualnego podglądu: [output/preview.json](output/preview.json).
- Poprzednie podglądy i ustawienia: `output/history/`.
- Miejsce na własne obrazki: `input/`.

Pełna ścieżka podglądu w WSL:
`/sciezka/do/projektu/output/preview.png`.

**Poprzedni PDF 1–15 wygenerowano po wyraźnej akceptacji użytkownika:**
[output/labels.pdf](output/labels.pdf), ustawienia: [output/labels.json](output/labels.json).
Sprawdzono gotowy plik: jedna strona A4, 15 etykiet o średnicy 37 mm.
Drukować w skali 100% / rzeczywisty rozmiar.
**Nowy PDF 1–30 wygenerowano po akceptacji użytkownika:**
[output/labels-1-30-komorowo.pdf](output/labels-1-30-komorowo.pdf), ustawienia:
[output/labels-1-30-komorowo.json](output/labels-1-30-komorowo.json).
Napisy: „KOMOROWO” / „Koło PZW Nr-34”. Sprawdzono jedną stronę A4,
30 etykiet po 37 mm, zgodność z zatwierdzonymi ustawieniami i PrintScaling=None.

Aktualny wygląd: biały środek, granatowe napisy na łukach oraz środkowy napis
PREZES lub SKARBNIK / KOŁA, czcionka pogrubiona 4,2 mm,
obwódka granatowa około 0,80 mm. Po zatwierdzeniu PNG wygenerowano
[finalny PDF z funkcjami](output/prezes-skarbnik-37mm.pdf) oraz
[manifest ustawień](output/prezes-skarbnik-37mm.json).
Sprawdzono: jedna strona A4, PREZES × 2 i SKARBNIK KOŁA × 2,
średnica 37 mm, wędki w skali 1,8, identyczne kopie każdego wzoru
i zgodność z zatwierdzonymi ustawieniami. PDF ma PrintScaling=None.
Proporcje wzoru zachowano po zmianie średnicy z 30 na 37 mm.
Wzór jest rysowany przez wspólny renderer PNG/PDF, bez przetwarzania zdjęcia.
Oryginalny `input/example.png` nie został zmieniony.
Pełne ustawienia znajdują się w `config.json`.
