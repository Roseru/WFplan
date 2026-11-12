# Powiadomienia WFplanu

Frontend pozostaje na GitHub Pages. Ten Worker obsługuje prawdziwy Web Push (RFC 8291 / VAPID), bazę D1 oraz harmonogram `* * * * *`. Nie wymaga uruchomionej aplikacji ani lokalnego komputera. Na darmowym planie nie jest potrzebna karta płatnicza.

## Rozwój i wdrożenie

Node 22+ oraz pnpm 11+. Z katalogu `push`: `pnpm install`, `pnpm test`, `pnpm exec wrangler deploy --dry-run`, następnie `pnpm run deploy`. Testy logiki planu uruchamia się dodatkowo przez `node --test data.test.js map.test.js notification.test.js` w katalogu głównym.

Konfiguracja publiczna jest w `wrangler.jsonc`. Sekrety `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `DISPATCH_SECRET` zapisuje się przez `wrangler secret bulk` na standardowym wejściu. Nie wpisywać kluczy do repozytorium ani argumentów poleceń. Nie zmieniać pary VAPID po uruchomieniu: istniejące subskrypcje są z nią związane. `SERVICE_URL` wskazuje publiczny URL tego Workera i służy do wywołań szyfrujących pojedyncze powiadomienia. Frontend odczytuje adres API z `../push-config.json`.

Zmiana rozkładu (`data.json`) lub reguł powiadomień (`notification-logic.js` / `logic.js`) wymaga także ponownego wdrożenia Workera i zwiększenia `REVISION` w `worker.js` do późniejszej wartości z datą. Cron przelicza oczekujące zadania po pięć subskrypcji na minutę. Wysłane zadania nie są wysyłane ponownie. Sam push na GitHub Pages nie wdraża Workera.

## Zachowanie i ograniczenia

Domyślnie wyłączone. Użytkownik udziela zgody w przeglądarce i zapisuje ustawienia na danym urządzeniu. Jedno urządzenie śledzi jedną aktualnie wybraną grupę; zmiana filtrów synchronizuje subskrypcję. Dzień to 24 godziny wyprzedzenia; godziny zajęć przeliczane są z czasu Warszawy z uwzględnieniem DST. METODYKA zastępuje WF dla tego samego wpisu.

Cron odpytuje do 35 należnych zadań na minutę. Pozostałe czekają na kolejną minutę. W razie przejściowych błędów wysyłka jest ponawiana do pięciu razy. Przypomnienia starsze niż 15 minut lub dotyczące rozpoczętych zajęć są pomijane. Powiadomienia używają stabilnych tagów, aby zastępować powtórzenia przy niejednoznacznym wyniku sieci. Dostarczenie i pokazanie zależą od internetu, przeglądarki i ustawień systemowych; nie ma gwarancji co do sekundy. Wygasłe endpointy 404/410 są usuwane. Harmonogram jest czyszczony raz dziennie, historia wysyłek po 45 dniach.

Przechowywane są: subskrypcja push urządzenia (endpoint i klucze klienta), identyfikator losowy, skrót losowego tokenu zarządzającego, wybrana grupa, wyprzedzenia i kolejka. Nie zbieramy adresów e-mail ani kont użytkowników. Dostęp do zmiany/usunięcia wymaga tokenu urządzenia. CORS dopuszcza wyłącznie domenę aplikacji; endpointy push są walidowane listą usług przeglądarek. Test jest ograniczony do raz na minutę na subskrypcję. Wyłączenie usuwa subskrypcję oraz zadania po stronie serwera i wyrejestrowuje ją w przeglądarce. Wyczyszczenie pamięci aplikacji bez wcześniejszego wyłączenia może pozostawić subskrypcję do wygaśnięcia endpointu; najlepiej wyłączać ją w ustawieniach aplikacji.
