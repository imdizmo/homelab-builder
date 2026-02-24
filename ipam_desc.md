Świetna decyzja! Własny, lekki IPAM napisany w Go, działający jako mikroserwis bezstanowy, to idealne rozwiązanie dla społeczności homelabowej. Skupimy się na tym, co naprawdę potrzebne: **inteligentnym, przewidywalnym przydziale IP z uwzględnieniem topologii i typów urządzeń, bez zbędnych bajerów**. Poniżej przedstawiam kompletny plan MVP dla **hlbIPAM**.

---

## 🎯 Cele MVP hlbIPAM

1. **Dostarczenie prostego, szybkiego i przewidywalnego przydziału IP** dla topologii homelabowej (do ~100 urządzeń).
2. **Wsparcie dla wielu routerów / sieci** – użytkownik może mieć kilka podsieci, routery z DHCP, itp.
3. **Uwzględnienie typów urządzeń** (router, switch, server, NAS, PC, SBC, VM) z predefiniowanymi zakresami (np. router .1, serwery .150-.159).
4. **Obsługa maszyn wirtualnych** – automatyczne przydzielanie adresów z bloku hosta.
5. **Walidacja w czasie rzeczywistym** – serwis może przyjąć częściową adresację (np. ręcznie ustawione IP) i zwrócić informację o konfliktach, błędach, wolnych miejscach.
6. **Całkowicie bezstanowy** – operacje na podstawie danych wejściowych (JSON), brak własnej bazy danych. Dzięki temu łatwo skalowalny i niezawodny.

---

## 🏗️ Architektura

- **Język:** Go (1.21+) – lekki, szybki, doskonały do mikroserwisów.
- **Framework:** Możemy użyć standardowego `net/http` lub lekkiego routera (np. `chi`). Na początek wystarczy prosty HTTP server.
- **Komunikacja:** REST API (JSON) – łatwo integruje się z backendem w Go i frontendem React.
- **Model danych:** Cała konfiguracja topologii przesyłana jest w żądaniu. Serwis nie przechowuje niczego – każda odpowiedź jest obliczana na bieżąco.
- **Wydajność:** Algorytm musi działać w czasie < 100ms dla typowego zestawu (nawet przy 100 węzłach). Go świetnie sobie poradzi.
- **Brak zewnętrznych zależności** – tylko standardowa biblioteka i ewentualnie kilka pomocniczych pakietów (np. do walidacji IP).

---

## 📦 API – wersja 1.0

Endpoints:

### `POST /api/v1/allocate`

Przyjmuje pełną topologię (węzły, połączenia, ewentualnie istniejące adresy) i zwraca uzupełnioną adresację.

**Request body (JSON):**
```json
{
  "routers": [
    {
      "id": "router1",
      "gateway_ip": "192.168.1.1",  // opcjonalnie, jeśli puste to algorytm nada domyślne
      "subnet": "192.168.1.0/24",   // obowiązkowe? można wyciągnąć z gateway IP
      "dhcp_enabled": true          // czy router obsługuje DHCP (wpływa na zakresy)
    }
  ],
  "nodes": [
    {
      "id": "switch1",
      "type": "switch",
      "connections": ["router1", "server1"],  // ID urządzeń, z którymi jest połączone
      "existing_ip": null                      // jeśli użytkownik już ustawił ręcznie
    },
    {
      "id": "server1",
      "type": "server",
      "connections": ["switch1"],
      "vms": [
        { "id": "vm1", "existing_ip": null },
        { "id": "vm2" }
      ]
    },
    {
      "id": "pc1",
      "type": "pc",
      "connections": ["switch1"]
    }
  ]
}
```

**Response body:**
```json
{
  "routers": [
    {
      "id": "router1",
      "gateway_ip": "192.168.1.1",
      "subnet": "192.168.1.0/24"
    }
  ],
  "nodes": [
    {
      "id": "switch1",
      "assigned_ip": "192.168.1.10",
      "type": "switch"
    },
    {
      "id": "server1",
      "assigned_ip": "192.168.1.150",
      "vms": [
        { "id": "vm1", "assigned_ip": "192.168.1.151" },
        { "id": "vm2", "assigned_ip": "192.168.1.152" }
      ]
    },
    {
      "id": "pc1",
      "assigned_ip": "192.168.1.160"
    }
  ],
  "conflicts": [], // lista ewentualnych konfliktów, jeśli wykryto
  "warnings": []   // ostrzeżenia (np. brak miejsca w podsieci)
}
```

### `POST /api/v1/validate`

Przyjmuje tę samą strukturę, ale z wypełnionymi polami `assigned_ip` (częściowo lub w całości). Serwis sprawdza poprawność, konflikty, zgodność z typami, dostępność miejsca w podsieci, itp. Zwraca listę błędów i ostrzeżeń.

**Response:**
```json
{
  "valid": false,
  "errors": [
    {
      "node_id": "server1",
      "message": "IP 192.168.1.200 is outside the reserved range for servers (expected .150-.159)"
    },
    {
      "node_id": "vm1",
      "message": "IP 192.168.1.151 already used by server1"
    }
  ],
  "warnings": []
}
```

---

## 🧠 Algorytm przydziału IP (ulepszona wersja ++)

Oparty na istniejącym, ale rozszerzony o:

### 1. Wiele routerów i podsieci
- Każdy router definiuje swoją podsieć (np. `192.168.1.0/24`, `10.0.0.0/24`).
- Dla każdej podsieci przechowujemy osobny rejestr zajętych adresów (`map[string]bool`).
- Urządzenia są przypisywane do podsieci na podstawie połączeń: BFS od routera w danej podsieci.
- Jeśli urządzenie jest połączone z dwoma routerami (np. przełącznik łączący dwie sieci), musi mieć adres w każdej z nich? W homelabach rzadkość, ale można dodać obsługę wielu interfejsów (na przyszłość). Na MVP zakładamy, że każde urządzenie (oprócz routerów) należy tylko do jednej podsieci.

### 2. Zaawansowane strefy (role) z elastycznością
- Dla każdego typu urządzenia definiujemy:
  - `base_offset` – początek bloku (np. serwer zaczyna od .150)
  - `step` – wielkość bloku (np. 10)
  - `can_host_vms` – czy może mieć maszyny wirtualne (wtedy blok musi być większy niż 1)
- Dodajemy możliwość konfiguracji przez użytkownika (np. w żądaniu można przesłać własne mapowanie typów na zakresy).

### 3. Inteligentne omijanie zajętych adresów
- Nawet jeśli użytkownik ręcznie ustawił IP w `existing_ip`, algorytm musi to uszanować i nie przydzielać go innym.
- Podczas przydziału szukamy pierwszego wolnego adresu w bloku, zaczynając od `base_offset`. Jeśli blok jest pełny, próbujemy kolejny wolny poza blokiem? Raczej zgłaszamy błąd – w homelabie użytkownik może zmienić zakres lub dodać nową podsieć.

### 4. Obsługa DHCP
- Jeśli router ma włączone DHCP, to zakres adresów dla DHCP powinien być wykluczony z ręcznego przydziału. Definiujemy domyślny zakres DHCP (np. .100-.149) i rezerwujemy go. Urządzenia, które mają być obsługiwane przez DHCP, dostają adres z tego zakresu (ale to już logika aplikacji, nie IPAM). IPAM może po prostu oznaczyć, że dany adres jest w puli DHCP i nie może być użyty statycznie.

### 5. Walidacja w czasie rzeczywistym
- Serwis `validate` porównuje istniejące IP z regułami:
  - Czy IP należy do podsieci?
  - Czy mieści się w bloku dla swojego typu?
  - Czy nie koliduje z innym urządzeniem?
  - Czy nie jest w zakresie DHCP (jeśli urządzenie ma być statyczne)?
- Zwraca czytelne błędy.

---

## 🔧 Implementacja w Go – struktura projektu

```
hlbipam/
├── cmd/
│   └── server/
│       └── main.go          # uruchomienie serwera HTTP
├── internal/
│   ├── api/
│   │   ├── handlers.go      # obsługa endpointów
│   │   └── models.go        # struktury żądań/odpowiedzi
│   ├── core/
│   │   ├── allocator.go     # główny algorytm przydziału
│   │   ├── validator.go     # walidacja istniejącej adresacji
│   │   ├── subnet.go        # zarządzanie podsieciami i rejestrami
│   │   └── types.go         # definicje typów urządzeń i stałe
│   └── utils/
│       └── ip_helpers.go    # funkcje do manipulacji IP (parse, porównania, itp.)
├── go.mod
└── config.yaml              # ewentualna konfiguracja (port, domyślne zakresy)
```

### Kluczowe elementy

- **Allocator** – przyjmuje `NetworkTopology` (lista routerów, węzłów) i zwraca `AllocationResult`. Wewnątrz:
  - Dla każdego routera tworzy nowy `SubnetAllocator` z mapą zajętości.
  - Wykonuje BFS, aby zebrać wszystkie węzły w tej podsieci (kolejność nie ma znaczenia, ważne żeby każdy dostał adres).
  - Dla każdego węzła, jeśli nie ma `existing_ip`, przydziela nowy z odpowiedniego bloku, uwzględniając już zajęte.
  - Po przydzieleniu hosta, przydziela adresy dla jego VM (jeśli są).
  - Na koniec zwraca listę węzłów z adresami oraz ewentualne błędy/ostrzeżenia.

- **Validator** – podobna logika, ale zamiast przydzielać, sprawdza zgodność istniejących adresów z regułami. Może korzystać z tego samego `SubnetAllocator` do wykrywania konfliktów.

- **SubnetAllocator** – struktura przechowująca maskę podsieci, mapę zajętych adresów (`map[int]bool`), oraz zakresy dla typów. Metody: `IsAvailable(offset)`, `Reserve(offset)`, `FindFirstAvailableInRange(startOffset, endOffset)`.

- **Typy urządzeń** – wczytujemy z konfiguracji lub na sztywno:

```go
var DeviceTypeRanges = map[string]struct {
    BaseOffset  int
    Step        int
    CanHostVMs  bool
}{
    "router":     {BaseOffset: 1, Step: 1, CanHostVMs: false},
    "switch":     {BaseOffset: 10, Step: 1, CanHostVMs: false},
    "ap":         {BaseOffset: 20, Step: 1, CanHostVMs: false},
    "nas":        {BaseOffset: 100, Step: 10, CanHostVMs: true},
    "server":     {BaseOffset: 150, Step: 10, CanHostVMs: true},
    "pc":         {BaseOffset: 160, Step: 10, CanHostVMs: true},
    "mini-pc":    {BaseOffset: 170, Step: 10, CanHostVMs: true},
    "sbc":        {BaseOffset: 180, Step: 10, CanHostVMs: true},
    "other":      {BaseOffset: 200, Step: 1, CanHostVMs: false},
}
```

---

## 📦 Przykład użycia (krok po kroku)

1. Frontend (React) zbiera od użytkownika topologię (narysowaną w ReactFlow) i wysyła do backendu Homelab Buildera.
2. Backend Homelab Buildera (Go) konstruuje żądanie do hlbIPAM: listę routerów, węzłów, połączeń.
3. hlbIPAM odpowiada z przydzielonymi IP.
4. Backend zapisuje te IP w swojej bazie (PostgreSQL) i zwraca do frontendu.
5. Użytkownik może ręcznie edytować IP w widoku; wtedy frontend wysyła żądanie `validate` do hlbIPAM, aby sprawdzić poprawność.

---

## ⚙️ Uwagi dotyczące skalowalności i wydajności

- **Stateless** pozwala na łatwe horyzontalne skalowanie – możemy uruchomić wiele instancji za load balancerem.
- Każde żądanie jest niezależne, więc nie ma problemu z synchronizacją.
- Algorytm BFS jest liniowy względem liczby węzłów (O(V+E)). Dla 100 węzłów to ułamki milisekund.
- W razie potrzeby można dodać prosty cache (np. Redis) dla często powtarzających się topologii, ale na MVP nie jest potrzebny.

---

## 🚀 Możliwe rozszerzenia po MVP

- **Wsparcie dla VLAN** – możliwość przypisania urządzeń do różnych VLANów, różne podsieci w ramach jednego fizycznego interfejsu.
- **Customowe zakresy** – użytkownik może definiować własne typy urządzeń i przypisywać im bloki.
- **Eksport do konfiguracji** – generowanie plików konfiguracyjnych dla popularnych routerów (OPNsense, pfSense, OpenWrt).
- **Historia zmian** – jeśli jednak okaże się potrzebna, można dodać opcjonalne logowanie do bazy (ale to już wykracza poza założenia bezstanowości).
- **Integracja z Terraform/Ansible** – API może być używane do automatyzacji.

---

## 📋 Podsumowanie – co zyskujesz?

- **Pełna kontrola** – piszesz dokładnie to, czego potrzebujesz.
- **Lekkość** – serwis w Go, bez zewnętrznych zależności, działa błyskawicznie.
- **Dopasowanie do homelab** – zakresy IP według typów urządzeń, obsługa VM, wiele routerów.
- **Gotowy do integracji** – proste REST API, które łatwo podłączyć do istniejącego backendu.
- **Bezpieczeństwo** – bezstanowość eliminuje ryzyko związane z przechowywaniem danych.

Jeśli chcesz, mogę teraz pomóc rozwinąć konkretne fragmenty – np. kod algorytmu BFS z uwzględnieniem wielu podsieci, strukturę danych dla rejestru adresów, czy przykładowy handler HTTP. Daj znać!