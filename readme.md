# Okręgi do druku A4

Statyczna aplikacja w HTML, CSS i JavaScript, gotowa na GitHub Pages.
Generowanie odbywa się w przeglądarce, bez konta i wysyłania obrazów.

## Możliwości

- Napisy na górze i dole koła, średnica w mm.
- Zakres numerów albo wiele własnych tekstów z liczbą kopii.
- Monety, wędki z wieńcem, 10 wesołych ozdób wędkarskich lub własne obrazy
  PNG/JPG/WEBP do 2 MB.
- Kolory, rozmiary, rozstaw liter, przesunięcia i rozmieszczenie na A4.
- Podgląd koła i arkusza, eksport PNG oraz PDF bez dodatkowego zatwierdzania.
- Zapis i wczytywanie projektu JSON wraz z własnymi obrazami.

Interfejs używa dużych liter (18 px), wyraźnych obramowań i zwykłych przycisków.
Na telefonie jest jeden układ kolumnowy i stałe przejście pomiędzy ustawieniami
a podglądem. Dodatkowe ustawienia można rozwinąć, gdy są potrzebne.

Podgląd, PNG i PDF korzystają ze wspólnego renderera Canvas.
PNG ma przezroczyste narożniki i metadane 600 DPI. PDF zachowuje dokładną średnicę,
ma strony 210 × 297 mm i preferencję drukowania 100%.
Gdy kół jest za dużo, automatycznie dodaje kolejne strony A4, zachowując
średnicę, kolejność numerów i wszystkie kopie wzorów. Wybrana liczba kolumn
jest maksimum na stronę; zbyt szeroki rząd zostaje podzielony.
Przykładowo 30 kół o średnicy 40 mm przy czterech kolumnach daje 24 koła
na pierwszej stronie i 6 na drugiej. Podgląd „Strony A4” ma licznik oraz
przyciski poprzedniej i następnej strony. Zapamiętuje również wybraną stronę.
Wszystkie strony trafiają do jednego PDF, a PNG nadal zawiera wybrane koło.
Przycisk PDF jest dostępny bez checkboxa i zatwierdzania podglądu.
Po kliknięciu sprawdza najnowsze ustawienia, także od razu po ich wpisaniu.
Przy błędnym projekcie pokazuje komunikat zamiast eksportować poprzednią wersję.
Podczas przygotowywania pliku jest chwilowo wyłączony, aby nie powielać eksportu.

Nowy projekt zaczyna od kolejnych numerów 1–30 o średnicy 37 mm.
Po wybraniu „Własny tekst” dostępne są wzory PREZES i SKARBNIK KOŁA,
po dwie kopie. Edytowane wzory pozostają zachowane przy przełączaniu trybów.
Kliknięcie dowolnego pola lub ozdoby we wzorze przełącza podgląd na ten wzór.
W zwiniętej galerii są zawsze dwa kafelki: wybrana ozdoba i jedna losowa,
a gdy nie wybrano ozdoby — dwie różne losowe propozycje. Wybrany własny obraz
też pozostaje widoczny. Propozycje nie zmieniają ustawień nadruku i nie skaczą
przy odrysowaniu formularza. Po powrocie wybrana ozdoba wraca z localStorage,
a sąsiednia propozycja jest losowana ponownie. Reszta opcji, w tym „Brak”,
znajduje się pod „Więcej ozdób”.

Nowe rysunki znajdziesz pod „Więcej ozdób”: król karpi, ryba
w okularach, wesoły robak, kalosz, śpiący spławik, puchar, szczęśliwy haczyk,
żaba na urlopie, kapitan kaczka i wiaderko nadziei.

Przy błędzie dopasowania przycisk „Popraw automatycznie” pojawia się
wewnątrz ramki komunikatu, bezpośrednio pod jego treścią.
Najpierw wydłuża zbyt krótki łuk, zachowując czytelny rozmiar liter.
Gdy to nie wystarcza, zmniejsza litery. Może też zmniejszyć ozdobę,
skorygować jej położenie albo zmniejszyć margines, gdy nawet jedno koło
nie mieści się na kartce. Korekta sprawdza wszystkie wzory, zachowując treść,
liczbę kół i wybraną średnicę. Gdy dopasowanie bez zmiany tych danych jest niemożliwe,
pozostaje komunikat do ręcznej poprawy. Pustych pól program nie wypełnia sam.

## Uruchomienie

Wymagany Node.js 22.

```bash
npm run build
npm start
```

Otwórz http://localhost:4173. Budowa i lokalny serwer używają wyłącznie
standardowych modułów Node.js. Nie wymagają instalowania zależności.
Nie otwieraj `index.html` przez `file://` — moduły i konfiguracja wymagają HTTP.

`config.json` zawiera ustawienia początkowe w formacie projektu aplikacji
(`version: 1`), takim samym jak pobierany przyciskiem „Zapisz projekt”.
Budowa kopiuje go do `dist/config.json`. Ustawienia użytkownika zapisują się
w localStorage; można je przenieść między przeglądarkami przez JSON.

Zapis działa po każdej zmianie, także przy niekompletnym polu lub tekście,
który jeszcze nie mieści się w kole. Po powrocie wracają napisy, liczby,
obrazy, wybór podglądu i rozwinięte sekcje. Poprzednie zapisy aplikacji nadal
się otwierają. Akceptacja PDF jest zawsze wyłączona po ponownym otwarciu.
Brak miejsca lub dostępu do pamięci przeglądarki jest sygnalizowany na stronie.

## Czytelny kod

Kod własny jest sformatowany, a budowa kopiuje go bez minifikacji:

- `web/app.js` — obsługa formularza i podglądu.
- `web/model.js` — ustawienia, walidacja i układ kartki.
- `web/renderer.js` — wspólne rysowanie koła do podglądu i eksportu.
- `web/decorations.js` — galeria i rysunki ozdób wędkarskich.
- `web/autofit.js` — korekta dopasowania po kliknięciu przycisku.
- `web/storage.js` — zapis i odtwarzanie ustawień w przeglądarce.
- `web/export.js` — pobieranie plików PNG i PDF.

Po zainstalowaniu zależności formatowanie uruchomisz przez `npm run format`,
a jego sprawdzenie przez `npm run format:check`. Zewnętrzna biblioteka
w `web/vendor/` jest wyłączona z formatowania.

## Struktura projektu

- `web/` — HTML, CSS, moduły JS i wspólny renderer.
- `web/assets/` — lokalne czcionki DejaVu, ikona i licencja.
- `web/vendor/` — lokalna biblioteka jsPDF 4.2.1 i licencja.
- `tools/` — budowa, lokalny serwer i pakowanie ZIP w JavaScript.
- `deploy.sh` — pełna budowa i wysłanie aplikacji na gałąź `gh-pages`.
- `tests/web/` — testy modelu, Chromium i kontrola eksportów w JavaScript.
- `dist/` — gotowe pliki statyczne tworzone przez budowę.
- `input/` — zachowane obrazy użytkownika.
- `output/` — zachowane eksporty, podglądy, historia i paczka ZIP.

Opublikowana aplikacja nie wymaga Node.js. Czcionki i biblioteka PDF są lokalne;
strona nie pobiera ich z CDN.

## GitHub Pages

Repozytorium: [ZielonyBuszmen/okregi-druk](https://github.com/ZielonyBuszmen/okregi-druk).
Gałąź `master` zawiera źródła, a `gh-pages` wyłącznie gotową stronę.
W ustawieniach repozytorium wybierz `master` jako gałąź domyślną.
Jeśli jako pierwsza została wysłana `gh-pages`, GitHub mógł wybrać ją domyślnie.
Źródło publikacji Pages ustaw niezależnie na `gh-pages`, zgodnie z instrukcją niżej.

Do publikacji potrzebne są Bash, Git, Node.js 22 lub nowszy, npm oraz dostęp
do zapisu w repozytorium `origin` (np. działający klucz SSH do GitHuba).
Ustaw autora Git, najlepiej z publicznym adresem GitHub `noreply`.
Przy pierwszym pobraniu projektu:

```bash
git clone git@github.com:ZielonyBuszmen/okregi-druk.git
cd okregi-druk
```

Po zapisaniu zmian w commicie na `master`:

```bash
git push origin master
./deploy.sh
```

Skrypt wymaga czystego katalogu roboczego na `master`. Instaluje zależności
według pliku blokady, sprawdza formatowanie, uruchamia testy modelu i pamięci,
usuwa starą budowę i odtwarza `dist/`. W osobnym katalogu tymczasowym tworzy
commit zawartości `dist/` i wysyła go na `gh-pages`. Nie przełącza roboczej
gałęzi, nie publikuje obrazów ani eksportów użytkownika i nie wymusza push.
Zachowuje istniejący `CNAME`. Ponowne uruchomienie bez zmian w gotowej aplikacji
nie tworzy dodatkowego commita. Błędy budowy lub dostępu do repozytorium
przerywają publikację; przy odrzuconym push można uruchomić skrypt ponownie.
Testy przeglądarki opisane niżej uruchamia się osobno.

Jednorazowo na GitHubie ustaw:

1. **Settings → Pages → Build and deployment**.
2. **Source: Deploy from a branch**.
3. **Branch: gh-pages**, folder **/(root)**, następnie **Save**.

Jest to publikacja z gałęzi zgodna z
[instrukcją GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site#publishing-from-a-branch).
Po zakończeniu publikacji strona będzie dostępna pod adresem
[zielonybuszmen.github.io/okregi-druk/](https://zielonybuszmen.github.io/okregi-druk/).
Kolejne aktualizacje wysyłaj tymi samymi dwiema komendami.

## Podglądy i paczka

Testy przeglądarki zapisują lokalne podglądy w `output/web-preview.png`,
`output/web-preview-a4.png` i `output/web-preview-mobile.png`.
Podglądy i ustawienia są archiwizowane w `output/history/`.
Dodatkowy podgląd wszystkich nowych ozdób to `output/web-ozdoby.png`.
Podglądy wielu stron są w `output/web-multipage-1.png`,
`output/web-multipage-3.png` i `output/web-multipage-mobile.png`.

```bash
npm ci --ignore-scripts
npm run pack:web
```

Paczka powstaje w `output/okregi-aplikacja-web.zip`, zawiera zawartość `dist/`
i wymaga hostingu HTTP, np. GitHub Pages.
Pakowanie w JavaScript sprawdza zgodność zawartości archiwum z plikami budowy.

Obrazy użytkownika (`input/`), eksporty i historia (`output/`), zależności,
budowa oraz wyniki testów są ignorowane przez Git. Do repozytorium trafiają
źródła, publiczne ustawienia startowe i plik blokady zależności.
Lokalne pliki `.env`, konfiguracje poświadczeń i klucze również są ignorowane.

## Testy

```bash
npm ci --ignore-scripts
npm test
npm run build
```

Testy przeglądarki korzystają z gotowego obrazu Chromium. Nie ma własnej
konfiguracji Docker Compose ani obrazu serwera aplikacji:

```bash
mkdir -p /tmp/okregi-web-tests
docker run --rm --network none --user "$(id -u):$(id -g)" \
  -v "$PWD:/app" -v /tmp/okregi-web-tests:/artifacts -w /app \
  -e OKREGI_TEST_ARTIFACTS=/artifacts \
  mcr.microsoft.com/playwright:v1.56.1-noble npm run test:browser
```

`test:browser` uruchamia testy interfejsu i kontrolę PDF/PNG.
Do osobnego sprawdzenia już wygenerowanych eksportów służy `npm run test:exports`;
domyślny katalog plików to `/tmp/okregi-web-tests`, nadpisywany zmienną
`OKREGI_TEST_ARTIFACTS`.

Testy obejmują oba tryby edycji, zmianę średnicy, własne obrazy, obsługę klawiaturą,
dodawanie/usuwanie wzoru, zapis/wczytanie, eksport PDF bez zatwierdzania,
ekran telefonu i ścieżkę projektu GitHub Pages.
Sprawdzają również zamknięcie i ponowne otwarcie karty, przywracanie własnych
obrazów, pustych pól, widoku A4 i otwartych sekcji oraz brak przewijania
poziomego na ekranach 1366, 390 i 320 pikseli.
Kontrola eksportów sprawdza format A4, liczbę kół, średnice 37 i 40 mm,
identyczność kopii, piksele RGB i maskę alfa między PNG i PDF oraz DPI PNG.
Obejmuje też 65 numerów na trzech stronach i kopie wzorów na dwóch stronach,
bez pustych kartek, utraty kolejności i zmiany średnicy. Testy podglądu
sprawdzają przyciski stron, odtwarzanie wybranej strony i ekran telefonu.
PDF-y testowe powstają wyłącznie w katalogu tymczasowym, poza `output/`.
