# Bociaust

Pokazowy prototyp gry inspirowanej Joust: bocian, bezwładny lot i sześć platform nad rozlewiskiem. Bez przeciwników i punktacji.

## Uruchomienie

Otwórz `index.html` w przeglądarce. Nie wymaga instalacji ani budowania projektu. Fonty Google są opcjonalne; bez internetu aplikacja używa fontów systemowych.

## Sterowanie

- **A / D lub ← / →** — lot w lewo i w prawo.
- **Spacja** — machnięcie skrzydłami; przytrzymanie powtarza machnięcia.
- **P / Escape** — pauza i wznowienie.
- **Od nowa** — powrót do gniazda.
- Na telefonie dostępne są przyciski dotykowe.
- **Dźwięk wł./wył.** — wycisza efekty. Każde machnięcie odtwarza krótki szum, a odbicie od platformy dodatkowy wznoszący ton. Dźwięk uruchamia się po rozpoczęciu gry; pauza go przerywa.

Platformy przepuszczają bociana od dołu i zatrzymują przy opadaniu. Bocian przelatuje przez boczne krawędzie ekranu. Spadek poniżej sceny przenosi go do gniazda. Utrata fokusu okna automatycznie wstrzymuje grę.

## Technologia

Native JavaScript + Canvas 2D + CSS. Na ten zakres framework i silnik gry dodawałyby zbędne zależności. Grafika jest rysowana proceduralnie, bez zewnętrznych obrazów. Fizyka ma stały krok 1/120 s, niezależny od częstotliwości odświeżania ekranu. `game.js` zawiera scenę, fizykę, rysowanie i wejście; `style.css` odpowiada za stronę i układ mobilny.

Efekty dźwiękowe są syntezowane przez Web Audio API, bez plików audio i dodatkowych zależności. Brak obsługi audio nie blokuje gry. Dźwięk oderwania jest wyzwalany przez machnięcie na platformie, nie przez samo zsunięcie się z krawędzi.

## Weryfikacja

`node game.test.cjs` sprawdza lot, lądowanie na wszystkich platformach, przechodzenie od dołu, pauzę, zawijanie i powrót do gniazda. Test używa atrapy Canvas; nie zastępuje sprawdzenia wyglądu i sterowania dotykowego w przeglądarce.
