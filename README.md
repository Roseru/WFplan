# WFplan

Nieoficjalny plan wychowania fizycznego WAT, inspirowany sposobem korzystania z [WATplan](https://github.com/c00bie/WATplan). Osobna implementacja, bez kopiowania kodu oryginału.

Wybór semestru, kompanii, plutonu i podgrupy; tygodniowy kalendarz; pełne tematy, obiekty, prowadzący i źródła; zapamiętywanie wyboru; link do wybranego dnia; eksport ICS, pamięć offline oraz opcjonalne powiadomienia push z własnymi wyprzedzeniami dla WF i zajęć instruktorsko-metodycznych.

## Uruchomienie

Wymagany Node.js 22 lub nowszy. Frontend nie wymaga instalacji zależności. Zaplecze push ma osobną konfigurację w `push/README.md`.

```sh
node serve.js
node --test data.test.js map.test.js notification.test.js
node validate.js
```

Adres lokalny: http://127.0.0.1:4173. Pliki aplikacji znajdują się w katalogu głównym. GitHub Pages publikuje gałąź `main`, katalog `/ (root)`. Można też użyć dowolnego hostingu statycznego.

## Dane i ograniczenia

- Rozkład WF z 29.09.2026, wytyczne zimowe z 30.09.2026, program WF 2024.
- Zima: 2026/2027. Zakładka letnia w przekazanym pliku zawiera **2025/2026**, co potwierdzają daty i dni tygodnia. Jest prezentowana jako archiwum. Nie generujemy letniego planu 2027.
- 7511 wpisów dla grup z numerem plutonu i kompanii. Grupy cywilne i kursy bez numeru kompanii nie są objęte selektorem.
- 165 opisów zajęć, pozyskanych z tabel programu (strony 12–52).
- Kody `18/9`, `18/10`, `4/710`, `4/45`, `3/39` występują w rozkładzie, ale nie mają odpowiednika w przekazanym programie. Aplikacja zachowuje kod i pokazuje brak opisu.
- Czas programowy jest sumą godzin dla punktu programu, a nie długością konkretnego spotkania. Źródło podaje numery bloków. Godziny uzupełnione przez użytkownika: 1–2 o 8:00, 3–4 o 9:50, 5–6 o 11:40, 7–8 o 13:30 (Warszawa). Powiadomienia korzystają z tych godzin. Eksport ICS zachowuje wpisy całodniowe, które nie blokują dostępności.
- Oznaczenia obiektów i wskazówki pochodzą z wytycznych zimowych 2026/27. Po najechaniu, kliknięciu lub przejściu klawiaturą na nazwę miejsca otwiera się schemat z zielonym zaznaczeniem. Wspólne oznaczenia (np. K/F) zachowują wspólny punkt z przesłanego schematu; nie jest to mapa GPS.
- Brak automatycznej synchronizacji z SWF. Nieobecność wpisu nie oznacza odwołania zajęć.

## Aktualizacja danych

`build_data.py` odczytuje źródła z katalogu Downloads i zapisuje `data.json` oraz lokalny raport importu. Wymaga Pythona z `openpyxl`, `pdfplumber` i `python-docx`. Oryginalne dokumenty nie są publikowane. Przy nowym roku akademickim trzeba jawnie zaktualizować zakresy semestrów w importerze i zweryfikować nagłówki oraz dni tygodnia. Po zmianie zasobów zwiększ wersję pamięci w `sw.js`.

## Prywatność

Wybór grupy i ustawienia przypomnień są zapisywane w lokalnej pamięci przeglądarki. Powiadomienia są domyślnie wyłączone. Dopiero po udzieleniu zgody i zapisaniu włączonych powiadomień backend Cloudflare Workers/D1 przechowuje subskrypcję push urządzenia, losowy identyfikator i skrót tokenu zarządzającego, wybraną grupę oraz harmonogram. Wyłączenie powiadomień usuwa subskrypcję i jej zadania. Szczegóły: `push/README.md`. Brak kont użytkowników i analityki. Czcionki są pobierane z Google Fonts; aplikacja działa również na czcionkach systemowych.


