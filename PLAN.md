# Dalszy plan

Zakończono: po akceptacji użytkownika wygenerowano [PDF](output/labels.pdf)
z numerami 1–15, średnica 37 mm, jedna strona A4. Sprawdzono format strony,
liczbę etykiet i ich fizyczną średnicę. Drukować w skali 100% / rzeczywisty rozmiar.
Aktualnie przygotowano nowy podgląd: „KOMOROWO” u góry, „Koło PZW Nr-34” na dole, numery 1–30,
średnica 37 mm, układ 5 × 6 na A4. Odstępy: 1 mm poziomo, 4 mm pionowo.
Po akceptacji wygenerowano [nowy PDF 1–30](output/labels-1-30-komorowo.pdf).
Sprawdzono jedną stronę A4, 30 etykiet o średnicy 37 mm i zgodność ustawień
z zatwierdzonym podglądem. Poprzedni plik 1–15 pozostaje zachowany.

Aktualny etap: zamiast numerów PREZES oraz SKARBNIK / KOŁA, średnica 37 mm.
PREZES: skrzyżowane wędki i złoty wieniec. SKARBNIK KOŁA: złote monety.
Przygotowano i obejrzano oba PNG. PDF ma zawierać po dwie kopie każdego wzoru,
łącznie cztery koła na A4. Po wyraźnej akceptacji wygenerowano
[gotowy PDF](output/prezes-skarbnik-37mm.pdf), z wędkami w skali 1,8.
Sprawdzono format A4, średnicę 37 mm, identyczność obu par i zgodność ustawień.
Poniższa procedura dotyczy przyszłych zmian.

1. Obejrzeć [PREZES](output/preview.png) i [SKARBNIK KOŁA](output/preview-skarbnik.png).
2. Sprawdzić napisy „KOMOROWO” / „Koło PZW Nr-34” oraz wielkość środkowych napisów.
3. Przekazać ewentualne poprawki wyglądu.
   Codex ma zapisać ustawienia i uruchomić wyłącznie PREVIEW:

   ```bash
   docker compose run --rm generator preview --config config.json --number 1
   ```

4. Obejrzeć nowy `output/preview.png`. Kolejne wersje i ustawienia pozostają
   w `output/history/`. W razie potrzeby powtórzyć poprawki.
5. Po wyraźnym poleceniu użytkownika, np. „Zatwierdzam, generuj PDF”,
   uruchomić:

   ```bash
   docker compose run --rm generator pdf --config config.json
   ```

6. Przekazać użytkownikowi `output/prezes-skarbnik-37mm.pdf` i przypomnieć o drukowaniu
   w skali 100% / rzeczywisty rozmiar. Oczekiwany wynik: jedna kartka A4,
   PREZES × 2 i SKARBNIK KOŁA × 2, średnica 37 mm, 2 kolumny i 2 rzędy.

PDF nie jest automatycznym kolejnym krokiem po podglądzie. Do czasu wyraźnej
akceptacji użytkownika praca pozostaje na etapie podglądów.

Instrukcja poleceń i parametrów: [readme.md](readme.md).
Zapis wykonanej pracy: [POSTEP.md](POSTEP.md).
