# Współpraca nad generatorem

- Odpowiadaj użytkownikowi po polsku. Projekt jest narzędziem CLI, bez aplikacji WWW.
- Po zmianach wizualnych generuj wyłącznie PREVIEW w Dockerze i obejrzyj PNG.
- Finalny PDF generuj wyłącznie po wyraźnej akceptacji użytkownika, np.
  „Zatwierdzam, generuj PDF”. Udany podgląd nie jest akceptacją.
- Testy mogą tworzyć tymczasowe PDF-y poza `output/`; nie są to finalne arkusze.
- Wszystkie ustawienia utrzymuj w `config.json`; CLI zapisuje nadpisania po
  udanym podglądzie i archiwizuje PNG oraz ustawienia w `output/history/`.
- Nie nadpisuj obrazków użytkownika. Przykładowy obraz to `input/example.png`.
- Zachowaj jeden renderer etykiety dla podglądu i PDF. Nie skaluj automatycznie
  etykiet i nie dodawaj stron, gdy układ nie mieści się na A4.
- Komendy:
  - budowa: `docker compose build generator`
  - testy: `docker compose run --rm --entrypoint python generator -m pytest -q -p no:cacheprovider`
  - podgląd: `docker compose run --rm generator preview --config config.json --number 12`
- Po wygenerowaniu podglądu podaj klikalną ścieżkę do `output/preview.png`.
