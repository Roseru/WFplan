# WFplan

Nieoficjalny plan wychowania fizycznego WAT, inspirowany sposobem korzystania z [WATplan](https://github.com/c00bie/WATplan). Osobna implementacja, bez kopiowania kodu oryginału.

Wybór semestru, kompanii, plutonu i podgrupy; tygodniowy kalendarz; pełne tematy, obiekty, prowadzący i źródła; zapamiętywanie wyboru; link do wybranego dnia; eksport ICS oraz pamięć offline po pierwszym uruchomieniu.

## Uruchomienie

Wymagany Node.js 22 lub nowszy. Brak zależności do instalowania.

```sh
node serve.js
node --test data.test.js
node validate.js
```

Adres lokalny: http://127.0.0.1:4173. Pliki aplikacji znajdują się w katalogu głównym. GitHub Pages publikuje gałąź `main`, katalog `/ (root)`. Można też użyć dowolnego hostingu statycznego.

## Dane i ograniczenia

- Rozkład WF z 29.09.2026, wytyczne zimowe z 30.09.2026, program WF 2024.
- Zima: 2026/2027. Zakładka letnia w przekazanym pliku zawiera **2025/2026**, co potwierdzają daty i dni tygodnia. Jest prezentowana jako archiwum. Nie generujemy letniego planu 2027.
- 7511 wpisów dla grup z numerem plutonu i kompanii. Grupy cywilne i kursy bez numeru kompanii nie są objęte selektorem.
- 165 opisów zajęć, pozyskanych z tabel programu (strony 12–52).
- Kody `18/9`, `18/10`, `4/710`, `4/45`, `3/39` występują w rozkładzie, ale nie mają odpowiednika w przekazanym programie. Aplikacja zachowuje kod i pokazuje brak opisu.
- Czas programowy jest sumą godzin dla punktu programu, a nie długością konkretnego spotkania. Źródło podaje numery bloków, ale nie godziny zegarowe. Eksport ICS używa wpisów całodniowych, które nie blokują dostępności.
- Oznaczenia obiektów i wskazówki pochodzą z wytycznych zimowych 2026/27. Miejsca zbiórek z ilustracji nie są geokodowane.
- Brak automatycznej synchronizacji z SWF. Nieobecność wpisu nie oznacza odwołania zajęć.

## Aktualizacja danych

`build_data.py` odczytuje źródła z katalogu Downloads i zapisuje `data.json` oraz lokalny raport importu. Wymaga Pythona z `openpyxl`, `pdfplumber` i `python-docx`. Oryginalne dokumenty nie są publikowane. Przy nowym roku akademickim trzeba jawnie zaktualizować zakresy semestrów w importerze i zweryfikować nagłówki oraz dni tygodnia. Po zmianie zasobów zwiększ wersję pamięci w `sw.js`.

## Prywatność

Wybór grupy jest zapisywany wyłącznie w lokalnej pamięci przeglądarki. Brak kont użytkowników, analityki i backendu. Czcionki są pobierane z Google Fonts; aplikacja działa również na czcionkach systemowych.

