# Dalszy plan

Implementacja, budowa obrazu, testy i przykładowy podgląd są ukończone.
Dalsze kroki dotyczą wyboru grafiki i zatwierdzenia wyglądu przez użytkownika.

1. Obejrzeć [aktualny podgląd numeru 12](output/preview.png).
2. Opcjonalnie wrzucić własną grafikę PNG/JPG/WEBP do `input/`
   i wskazać jej nazwę w rozmowie.
3. Przekazać poprawki wyglądu, np. „rozmycie 0,3 mm, rozjaśnienie bielą 40%,
   większa liczba”. Codex ma zapisać ustawienia i uruchomić wyłącznie PREVIEW:

   ```bash
   docker compose run --rm generator preview --config config.json --number 12
   ```

4. Obejrzeć nowy `output/preview.png`. Kolejne wersje i ustawienia pozostają
   w `output/history/`. W razie potrzeby powtórzyć poprawki.
5. Po wyraźnym poleceniu użytkownika, np. „Zatwierdzam, generuj PDF”,
   uruchomić:

   ```bash
   docker compose run --rm generator pdf --config config.json
   ```

6. Przekazać użytkownikowi `output/labels.pdf` i przypomnieć o drukowaniu
   w skali 100% / rzeczywisty rozmiar. Oczekiwany wynik: jedna kartka A4,
   numery 1–33, średnica 30 mm, ostatni rząd wyśrodkowany.

PDF nie jest automatycznym kolejnym krokiem po podglądzie. Do czasu wyraźnej
akceptacji użytkownika praca pozostaje na etapie podglądów.

Instrukcja poleceń i parametrów: [readme.md](readme.md).
Zapis wykonanej pracy: [POSTEP.md](POSTEP.md).
