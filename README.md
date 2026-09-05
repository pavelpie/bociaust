# Bociaust

Spokojna gra przeglądarkowa inspirowana Joust. Bocian zbiera po jednym jajku, kwiatku lub żabie z każdej z sześciu platform. Wyprawa obejmuje 100 poziomów i 600 przedmiotów. Bez przeciwników, limitu czasu i utraty żyć.

## Uruchomienie i publikacja

Otwórz `index.html` w przeglądarce. Bez instalacji i budowania. Google Fonts są opcjonalne; offline działają fonty systemowe.

Na GitHub Pages umieść razem: `index.html`, `style.css`, **`levels.js`** i `game.js`. Plik `levels.js` jest nowym, wymaganym elementem gry. W repozytorium ustaw Settings → Pages → Deploy from a branch → main → / (root).

Odwołania do CSS i JavaScript w `index.html` mają wspólny numer wersji `?v=1`. Przy kolejnych zmianach któregokolwiek z tych plików zwiększ wszystkie trzy numery o 1 (raz na zestaw zmian) i opublikuj także `index.html`. Nowy adres zasobu pozwala ominąć jego poprzednią kopię w pamięci przeglądarki po pobraniu aktualnego HTML; nie przeładowuje już otwartej gry.

## Zasady i sterowanie

- **A/D lub ←/→** — kierunek lotu z bezwładnością.
- **Spacja** — machnięcie skrzydłami; przytrzymanie powtarza ruch.
- Dotknij bocianem przedmiotu na wyspie, aby go zebrać. Możesz wylądować lub zebrać go w locie.
- Po komplecie 6/6 pojawia się czas poziomu i suma czasów ukończonych poziomów. Następny poziom zaczyna się automatycznie po 3,5 s; przycisk pozwala przejść od razu.
- **P/Escape** — pauza; zatrzymuje również odliczanie do kolejnego poziomu. Utrata fokusu okna także pauzuje grę.
- **Powtórz poziom** — reset przedmiotów i czasu bieżącego poziomu, z zachowaniem jego układu i poprzednich wyników. Nie działa podczas podsumowania.
- Upadek przenosi do gniazda i zachowuje zebrane przedmioty oraz czas. Boczne krawędzie zawijają lot.
- **Dźwięk wł./wył.** — efekty skrzydeł, oderwania i zbierania. Każdy rodzaj przedmiotu ma inną wysokość dźwięku, ostatni przedmiot daje dłuższą melodię.
- Na telefonie działają przyciski dotykowe.

Po poziomie 100 gra pokazuje łączny i średni czas. Przycisk „Nowa wyprawa” losuje nową kampanię od poziomu 1. Wynik oznacza czas aktywnej symulacji — bez pauz i podsumowań. Postęp jest przechowywany w pamięci: odświeżenie strony rozpoczyna nową wyprawę.

## Losowanie

`levels.js` generuje plansze z ziarna wyprawy i numeru poziomu, dzięki czemu powtórzenie poziomu zachowuje układ. Poziom 1 ma bazową geometrię. Kolejne poziomy lekko przesuwają wyspy (do ±40 px poziomo i ±15 px pionowo), zmieniają szerokość do ±10 px i czasem odbijają układ poziomo.

Każdy kandydat przechodzi kontrolę granic, minimalnej szerokości 130 px i odstępu: co najmniej 35 px w poziomie lub 110 px w pionie. Po maksymalnie 40 próbach generator korzysta ze sprawdzonego układu bazowego. Platformy są nieruchome i przepuszczają bociana od dołu; ciągłe machanie pozwala dotrzeć na każdą wysokość.

Osiem biomów losuje się w tasowanych pulach: każda paleta występuje raz w puli, bez sąsiednich powtórzeń także na granicy pul. Biomy zmieniają niebo, wzgórza, słońce, trawę i akcenty przedmiotów. Co dziesiąty poziom ma złoty komplet jednego rodzaju przedmiotów. Nie zmienia to sterowania ani wymagań.

## Technologia i testy

Czysty JavaScript, Canvas 2D i Web Audio API. Brak bibliotek wykonawczych, zewnętrznych obrazów i plików audio. Fizyka ma stały krok 1/120 s. Audio uruchamia się po interakcji użytkownika, a brak jego obsługi nie blokuje rozgrywki.

- `node game.test.cjs` — fizyka, kolizje, audio, jednorazowe zbieranie, reset, pauza, pełny przebieg poziomów 1–100 i finał.
- `node levels.test.cjs` — 20 000 układów: granice, odstępy, miejsce startu, przedmioty, powtarzalność i różnorodność biomów.

Testy symulacji używają atrap Canvas i Web Audio. Nie zastępują odsłuchu i wizualnego sprawdzenia w przeglądarce ani testu dotyku na telefonie.
