# Współpraca nad generatorem

- Odpowiadaj użytkownikowi po polsku. Projekt to statyczna aplikacja HTML/CSS/JS
  w `web/`, przeznaczona na GitHub Pages. Narzędzia i testy są w JavaScript.
- Wszystkie ustawienia początkowe utrzymuj w `config.json`, w natywnym formacie
  projektu aplikacji (`version: 1`). Budowa kopiuje go do `dist/config.json`.
  Ustawienia użytkownika zapisują się w przeglądarce i można je pobrać jako JSON.
- Kod własny ma być czytelny: opisowe nazwy, zwykłe funkcje, formatowanie
  przez `npm run format`. Bibliotek w `web/vendor/` nie formatuj ani nie modyfikuj.
- Interfejs ma być praktyczny i czytelny dla osób 50+: tekst co najmniej 18 px,
  kontrastowe napisy, wyraźne obramowania, duże przyciski i poprawny układ telefonu.
  Zachowuj prosty wygląd bez ozdobnych efektów.
- Każdą zmianę ustawień zapisuj w localStorage przed walidacją podglądu.
  Przywracaj także własne obrazy, niedokończone pola i widok interfejsu.
  Nie zapamiętuj akceptacji PDF. Zgłaszaj rzeczywiste błędy zapisu.
- Po zmianach wizualnych generuj wyłącznie podglądy w Dockerze przez Playwright
  i obejrzyj PNG. Podaj klikalną ścieżkę do `output/web-preview.png`.
- Finalny PDF generuj wyłącznie po wyraźnej akceptacji użytkownika.
  W aplikacji wymagana jest akceptacja aktualnego podglądu przed pobraniem PDF.
  Udany podgląd nie jest akceptacją.
- Testy mogą tworzyć tymczasowe PDF-y poza `output/`; nie są to finalne arkusze.
- Podglądy i ustawienia archiwizuj w `output/history/`.
- Nie nadpisuj obrazków użytkownika w `input/` ani wcześniejszych eksportów.
- `input/`, `output/`, wyniki testów, zależności i lokalne poświadczenia
  pozostają poza Git. Nie dodawaj ich wymuszeniem ignorowanych reguł.
- Dokumentacja publiczna nie może zawierać prywatnych ścieżek, danych
  użytkownika ani sekretów. Zachowuj wymagane informacje o licencjach bibliotek.
- W planach zapisuj tylko zadania pozostałe do wykonania. Usuwaj zakończone
  checklisty i dzienniki postępu, zamiast powielać opis aplikacji.
- Zachowaj jeden renderer Canvas dla podglądu, PNG i PDF. Nie zmniejszaj
  automatycznie średnicy etykiet. Nadmiar kół przenoś na kolejne strony A4,
  w tej samej kolejności. Podgląd musi pozwalać przejrzeć każdą stronę.
- Przycisk „Popraw automatycznie” może dopasować tekst, ozdoby i układ,
  zachowując średnicę, treść oraz liczbę kół. Korektę sprawdzaj dla wszystkich
  wzorów wspólnym rendererem i zapisuj dopiero po pełnym powodzeniu.
- Komendy:
  - zależności testów i pakowania: `npm ci --ignore-scripts`
  - budowa: `npm run build`
  - lokalny serwer: `npm start`
  - testy modelu: `npm test`
  - testy przeglądarki i eksportów: `npm run test:browser`
  - sama weryfikacja eksportów: `npm run test:exports`
  - paczka ZIP: `npm run pack:web`
  - formatowanie: `npm run format`
  - kontrola formatowania: `npm run format:check`
- Testy przeglądarki uruchamiaj w obrazie
  `mcr.microsoft.com/playwright:v1.56.1-noble`. Docker służy wyłącznie do testów
  przeglądarki; aplikacja i narzędzia Node.js nie wymagają kontenera.
  Przykładowa komenda i montowanie katalogu tymczasowego są w `readme.md`.
- Źródła są na `master`. Publikacja GitHub Pages odbywa się przez `./deploy.sh`,
  który odtwarza `dist/` i wysyła wyłącznie gotową aplikację na `gh-pages`.
  Nie przełączaj roboczej gałęzi ani nie wymuszaj push. Publikuj wyłącznie
  na polecenie użytkownika. Instrukcja konfiguracji Pages jest w `readme.md`.
