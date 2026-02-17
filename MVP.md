## **Homelab Architect – techniczny plan MVP**

### **Założenia MVP (Minimum Viable Product)**
Celem pierwszego działającego prototypu jest umożliwienie użytkownikowi:
1.  Zdefiniowania listy usług, które chce uruchomić (z szacunkowymi wymaganiami).
2.  Otrzymania rekomendacji sprzętowej (konkretne modele lub typy sprzętu).
3.  Wygenerowania listy zakupowej z linkami (docelowo afiliacyjnymi).
4.  Zobaczenia prostego schematu połączeń (Mermaid).
5.  Zapisania swojej konfiguracji na koncie (logowanie Google).

MVP **nie** zawiera:
- Zaawansowanego AI (to będzie dodatek w wersji Pro).
- Integracji z API cenowymi sklepów (na start linki są ręcznie przypisane do rekomendacji).
- Społecznościowych ocen i komentarzy.
- Zaawansowanego cache'owania (Redis – dodamy później, gdy wzrośnie ruch).

---

### **Architektura systemu (MVP)**

```
[Frontend: React + Vite] 
       ⇕ (REST API)
[Backend: Go (Gin/Echo)]
       ⇕
[PostgreSQL] (baza główna)
[Redis] (cache, sesje, limity API)
```

- **Hosting:** Prywatny VPS.
- **Domena:** własna.

---

### **Model danych (PostgreSQL)**

#### **1. Tabela: users**
- `id` (UUID, primary key)
- `email` (string, unique)
- `google_id` (string, unique – jeśli logowanie przez Google)
- `created_at` (timestamp)
- `preferences` (JSONB) – np. domyślna waluta, preferowane sklepy

#### **2. Tabela: services** (katalog usług, które użytkownik może wybrać)
- `id` (UUID)
- `name` (string) – np. "Jellyfin"
- `category` (enum) – media, gaming, storage, monitoring, smart home, etc.
- `icon` (string) – nazwa ikony z FontAwesome/Material Icons
- `description` (text)
- `default_ram_min` (int) – minimalne RAM w MB
- `default_ram_recommended` (int) – zalecane RAM
- `default_vcpu_min` (float)
- `default_vcpu_recommended` (float)
- `default_storage_min` (int) – miejsce na dysku w GB (np. na system i dane tymczasowe)
- `docker_support` (boolean) – czy typowo działa w Dockerze
- `official_website` (string) – link do docsów
- `created_at`

#### **3. Tabela: hardware_profiles** (profile sprzętowe)
To będą nasze "szablony" rekomendacji. Na początek ręcznie dodane przez Ciebie.
- `id` (UUID)
- `name` (string) – np. "Mini PC Beelink S12 Pro"
- `type` (enum) – "mini_pc", "raspberry_pi", "old_pc", "server", "nas"
- `cpu_model` (string) – np. "Intel N100"
- `cpu_cores` (int)
- `cpu_threads` (int)
- `cpu_passmark` (int) – przybliżona wydajność (możemy ściągać z CPUBenchmark.net)
- `ram_max` (int) – maksymalna obsługiwana RAM w GB
- `ram_type` (string) – "DDR3", "DDR4", "LPDDR4"
- `storage_bays` (int) – liczba wewnętrznych zatok na dyski
- `storage_interface` (string) – "SATA", "NVMe", "USB"
- `gpu` (string) – np. "Intel UHD Graphics" (ważne dla transkodowania)
- `power_idle` (int) – pobór prądu na jałowym w Watach
- `power_load` (int) – pobór pod obciążeniem
- `noise_level` (enum) – "silent", "low", "medium", "loud"
- `form_factor` (string) – "desktop", "rack", "tiny"
- `price_new` (int) – szacowana cena nowego w PLN
- `price_used` (int) – szacowana cena używanego
- `affiliate_links` (JSONB) – np. `{"xkom": "url", "amazon": "url"}`
- `created_at`

#### **4. Tabela: user_builds** (główna tabela – konfiguracje użytkowników)
- `id` (UUID)
- `user_id` (UUID, klucz obcy do users)
- `name` (string) – np. "Mój pierwszy homelab"
- `created_at`
- `updated_at`
- `budget` (int) – opcjonalnie
- `electricity_cost` (float) – cena za kWh (do kalkulacji)
- `priority` (JSONB) – np. `{"quiet": true, "low_power": false, "powerful": true}`

#### **5. Tabela: build_services** (wybrane usługi w danej konfiguracji)
- `id` (UUID)
- `build_id` (UUID)
- `service_id` (UUID)
- `custom_ram` (int) – jeśli użytkownik chce zmienić
- `custom_vcpu` (float)
- `custom_storage` (int)
- `notes` (text)

#### **6. Tabela: build_recommendations** (wygenerowane rekomendacje)
- `id` (UUID)
- `build_id` (UUID)
- `hardware_profile_id` (UUID)
- `score` (float) – jak dobrze pasuje (np. 0-100)
- `compatibility_notes` (text) – np. "Brak portów SATA, potrzebujesz adaptera"
- `estimated_power_cost_monthly` (float)
- `total_price_new` (int)
- `total_price_used` (int)

---

### **Backend (Go) – endpointy MVP**

#### **1. Autoryzacja**
- `POST /api/auth/google` – logowanie przez Google (otrzymujesz token, weryfikujesz, zakładasz konto)
- `GET /api/auth/me` – dane bieżącego użytkownika

#### **2. Katalog usług**
- `GET /api/services` – lista wszystkich usług (z kategoriami, ikonami, domyślnymi wymaganiami)

#### **3. Konfiguracje (builds)**
- `GET /api/builds` – listuj konfiguracje użytkownika
- `POST /api/builds` – utwórz nową (wysłij: nazwa, lista usług z ich ustawieniami, budżet, priorytety)
- `GET /api/builds/:id` – pobierz konkretną konfigurację
- `PUT /api/builds/:id` – aktualizuj
- `DELETE /api/builds/:id`

#### **4. Rekomendacje (kluczowy endpoint!)**
- `POST /api/builds/:id/recommend` – generuj rekomendacje na podstawie aktualnej konfiguracji
  - Algorytm:
    1. Sumujemy wymagane RAM, vCPU, storage ze wszystkich usług w buildzie.
    2. Pobieramy wszystkie `hardware_profiles`, które spełniają minimum (RAM >= suma, CPU cores >= suma, storage bays >= potrzeby).
    3. Dla każdego profilu obliczamy "score":
       - premia za bliskość do rekomendowanych wartości (nie tylko minimum)
       - premia za zgodność z priorytetami (cisza, niski pobór)
       - kara za przekroczenie budżetu
    4. Sortujemy i zwracamy top 3-5.

#### **5. Lista zakupowa**
- `GET /api/builds/:id/shopping-list` – generuj listę na podstawie wybranej rekomendacji (np. `?profile_id=...`)
  - Zwraca: nazwa sprzętu, linki afiliacyjne (z tabeli), linki do OLX/Allegro (możemy generować dynamicznie wyszukiwanie), tipy (np. "kup używaną, zaoszczędzisz 30%", "wymień pastę termoprzewodzącą").

#### **6. Check lista (generowana dynamicznie)**
- `GET /api/builds/:id/checklist` – zwraca listę kroków do wykonania po zakupie (np. "zainstaluj system", "zainstaluj Dockera", "skonfiguruj Jellyfin" – to może być generowane na podstawie wybranych usług).

---

### **Frontend (React) – struktura MVP**

#### **Strony:**
1.  **Strona główna (/)**
    - Krótkie wprowadzenie, CTA "Zbuduj swój homelab".
    - Lista ostatnich publicznych konfiguracji (opcjonalnie, jeśli dodamy publiczne).

2.  **Kreator konfiguracji (/build/new)**
    - **Krok 1: Wybór usług**
      - Siatka/lista usług z checkboxami, ikonami, suwakami do dostosowania RAM/CPU.
      - Pole wyszukiwania.
    - **Krok 2: Ustawienia ogólne**
      - Budżet (suwak lub pole liczbowe).
      - Priorytety (checkboxy: cisza, niski pobór prądu, moc obliczeniowa, mały rozmiar).
      - Cena prądu (domyślnie 1.15 PLN/kWh).
    - **Krok 3: Generowanie**
      - Przycisk "Pokaż rekomendacje" → wywołuje endpoint `/recommend`.
      - Wyświetlenie 3 najlepszych propozycji w formie kart.
      - Po kliknięciu w kartę – rozwinięcie ze szczegółami, wykresem Mermaid i przyciskiem "Lista zakupowa".

3.  **Lista zakupowa (/build/:id/shopping)**
    - Tabela z komponentami (może być kilka wariantów: nowe/używane).
    - Linki do sklepów (afiliacyjne) i OLX.
    - Check lista obok (np. w sidebarze).
    - Przycisk "Zapisz konfigurację" (jeśli użytkownik jest zalogowany).

4.  **Panel użytkownika (/dashboard)**
    - Lista zapisanych konfiguracji.
    - Możliwość edycji, usunięcia, wygenerowania nowej listy zakupowej.

5.  **Strona usługi (/services/:id)**
    - Szczegółowy opis usługi, wymagania, link do docsów, przykładowe konfiguracje innych.

---

### **Technologie w praktyce**

#### **Frontend:**
- **React + Vite** (szybki start, mniej konfiguracji niż CRA)
- **TailwindCSS** (szybkie stylowanie, nie tracisz czasu na pisanie CSS)
- **React Router** (do nawigacji)
- **React Hook Form** (do formularzy)
- **Zustand** (lub Context API) do stanu globalnego (np. dane użytkownika)
- **Mermaid.js** (do rysowania schematów – wystarczy wrzucić tekst, a on narysuje)
- **Axios** (do zapytań HTTP)

#### **Backend:**
- **Go 1.21+** (framework: Gin – prosty i wydajny, lub Echo – też dobry)
- **GORM** (ORM do PostgreSQL – przyspiesza rozwój)
- **Logowanie przez Google**: użyj `golang.org/x/oauth2` i zweryfikuj token po stronie backendu
- **Migracje bazy danych**: `golang-migrate/migrate` (wersjonowanie schematu)

#### **Baza danych:**
- **PostgreSQL 15+** (na start możesz użyć hosted np. Supabase, Neon.tech – mają darmowe plany, które wystarczą na MVP)

#### **DevOps:**
- **Docker** (opcjonalnie, ale fajnie opakować backend)
- **GitHub Actions** (CI/CD – automatyczny deploy frontendu na Vercel, backendu na VPS przez SSH)

---

### **Co musi być zrobione ręcznie na start (data seeding)**

Zanim użytkownik wejdzie, musisz wypełnić tabele `services` i `hardware_profiles` przykładowymi danymi. Proponuję na start:

#### **Usługi (services):**
- Jellyfin (RAM: min 512MB, zalecane 2GB, vCPU: 1, storage: 10GB + miejsce na media)
- Nextcloud (RAM: min 1GB, zalecane 4GB, vCPU: 1-2, storage: 20GB + dane)
- Minecraft Server (RAM: min 2GB, zalecane 4GB+, vCPU: 2-4, storage: 5GB + światy)
- Pi-hole (RAM: 256MB, vCPU: 0.5, storage: 2GB)
- Home Assistant (RAM: 512MB, zalecane 2GB, vCPU: 1, storage: 10GB)
- Nginx Proxy Manager (RAM: 256MB, vCPU: 0.5, storage: 1GB)
- *...i może 5-10 innych, żeby było ciekawie*

#### **Profile sprzętowe (hardware_profiles):**
- **Raspberry Pi 4 (4GB)** – idealne do lekkich usług
- **Raspberry Pi 5 (8GB)** – już mocniejsze
- **Mini PC N100 (16GB RAM)** – nowoczesny, energooszczędny
- **Mini PC NUC i5 (32GB RAM)** – mocniejszy
- **Stary PC (i5-4590, 16GB RAM)** – z odzysku, głośniejszy, ale tani
- **Serwer Dell R720 (128GB RAM)** – dla zapaleńców
- *...i tak dalej*

Dla każdego profilu potrzebujesz chociaż jednego linku afiliacyjnego (na start możesz dać link do wyszukiwarki na Ceneo/Allegro z Twoim ID, jeśli masz).

---

### **Kroki implementacji (dzień po dniu)**

#### **Dzień 1-2: Setup**
- Załóż repozytorium (monorepo: `/frontend`, `/backend`).
- Postaw backend w Go z jednym endpointem healthcheck.
- Postaw frontend w React z jednym komponentem.
- Skonfiguruj bazę danych (np. Neon.tech) i połącz backend.
- Stwórz migracje dla tabel.

#### **Dzień 3-4: Logowanie i baza usług**
- Zaimplementuj logowanie przez Google (backend + frontend).
- Stwórz panel admina (prosty) do dodawania usług przez Ciebie (lub ręczne inserty).
- Zrób stronę z listą usług (frontend).

#### **Dzień 5-6: Kreator konfiguracji**
- Formularz wyboru usług (z suwakami RAM/CPU).
- Zapisywanie konfiguracji do bazy.
- Podgląd zapisanej konfiguracji.

#### **Dzień 7-9: Silnik rekomendacji**
- Napisz algorytm w Go sumujący zasoby.
- Pobieranie pasujących profili.
- Obliczanie score.
- Zwracanie top 3.
- Wyświetlanie kart rekomendacji na froncie.

#### **Dzień 10-11: Lista zakupowa i check lista**
- Endpoint `/shopping-list` zwracający linki i tipy.
- Strona z listą zakupową.
- Generowanie prostej checklisty (statycznej na start, potem dynamicznej).

#### **Dzień 12: Wykres Mermaid**
- Na podstawie wybranych usług wygeneruj prosty schemat (np. "Internet -> Router -> Serwer -> Kontenery: Jellyfin, Minecraft...").
- Wykorzystaj bibliotekę Mermaid do rysowania.

#### **Dzień 13: Polerka i testy**
- Poprawki UI, walidacje, obsługa błędów.
- Test na znajomych z grupek homelabowych.

#### **Dzień 14: Deploy i promocja**
- Wrzuć na Vercel + VPS.
- Napisz post na Wykopie, grupie Homelab na FB, na Reddit (r/homelab, r/selfhosted).
- Zbieraj feedback.

---

### **Co z AI w przyszłości?**
Gdy zbierzesz wystarczająco dużo konfiguracji (powiedzmy 100+), możesz:
- Wytrenować prosty model (np. regresję) do przewidywania idealnego sprzętu na podstawie historii.
- Użyć OpenAI API do generowania opisów i tipów (ale to kosztuje, więc musi być w wersji Pro).

---

### **Twój plan zarobkowania w praktyce**
1. **Reflinki:** Zapisz się do programów partnerskich:
   - Amazon Associates
   - X-kom (jeśli mają program)
   - Morele.net
   - Ceneo (też mają program)
2. **Zestawy sponsorowane:** Gdy zbudujesz ruch, firmy typu "Mini PC PL" mogą zapłacić za wyróżnienie.
3. **Wersja Pro:**
   - AI-driven recommendations (np. "optymalizacja pod kątem rachunków")
   - Eksport do szczegółowego PDF (instrukcja krok po kroku)
   - Priorytetowe wsparcie (discord)

