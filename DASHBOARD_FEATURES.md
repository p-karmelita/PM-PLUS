# PM PLUS Dashboard - Funkcjonalności

## Przegląd

Dashboard PM PLUS to interfejs użytkownika do monitorowania i zarządzania systemem wieloagentowym AI dla zarządzania projektami.

## Dostępne Widoki

### 1. Today's Briefing (Główny widok)
**Ścieżka**: `/` (domyślny widok)

**Funkcje**:
- Karty statystyk (Pending Approvals, Messages Today, Tasks Flagged)
- Pasek uwagi z najważniejszymi zatwierdzeniami
- Siatka zdrowia zespołu (Team Health Grid)
- Graf agentów pokazujący komunikację między agentami
- Dolny rząd z dodatkowymi informacjami

**Komponenty**:
- `StatCards` - statystyki projektu
- `AttentionStrip` - pilne zatwierdzenia
- `TeamHealthGrid` - stan zespołu
- `AgentGraph` - wizualizacja agentów
- `BottomRow` - dodatkowe informacje

### 2. Risks (Zarządzanie ryzykiem)
**Ścieżka**: Sidebar → Overview → Risks

**Funkcje**:
- Lista wszystkich oczekujących zatwierdzeń (Approval Requests)
- Szczegóły każdego ryzyka (severity, opis, rekomendacje)
- Przyciski Approve/Reject dla każdego zatwierdzenia
- Informacje o agencie zgłaszającym
- Timestamp zgłoszenia

**API Endpoints**:
- `POST /human/approval-response` - zatwierdzenie/odrzucenie

### 3. Team Health (Zdrowie zespołu)
**Ścieżka**: Sidebar → Overview → Team Health

**Funkcje**:
- Karty statystyk projektu
- Rozszerzona siatka zdrowia zespołu
- Informacje o obciążeniu pracą członków zespołu
- Status zadań i blokad

**Komponenty**:
- `StatCards`
- `TeamHealthGrid`

### 4. Weekly Summary (Podsumowanie tygodniowe)
**Ścieżka**: Sidebar → Reports → Weekly Summary

**Funkcje**:
- Podsumowanie wydarzeń z ostatniego tygodnia
- Statystyki check-inów
- Flagi ryzyka
- Wydarzenia według pracowników

**API Endpoints**:
- `GET /weekly-snapshot` - dane tygodniowe

**Komponent**:
- `WeeklySummaryView`

### 5. All Events (Wszystkie wydarzenia)
**Ścieżka**: Sidebar → Reports → All Events

**Funkcje**:
- Chronologiczna lista wszystkich wiadomości między agentami
- Kolorowe oznaczenia agentów (Collector, Risk Analyzer, Resource Balancer, Reporter)
- Wskaźniki pętli (Loop badges) - collect, loop1, loop2, loop3, real
- Szczegóły każdej wiadomości
- Informacje o pracownikach związanych z wydarzeniem
- Sortowanie od najnowszych

**Komponenty**:
- `AllEventsView`

## Funkcje Globalne

### Backbone Console
Aktualny ekran główny dashboardu zawiera produkcyjny pion Data & Orchestrator:

- Seed zespołu i uruchamianie daily check-in
- Formularz update’u pracownika z walidacją workload/blockers/needsHelp
- Pełny Decision Lifecycle: draft → pending_pm → approved/rejected → applied/skipped → audited
- Bezpośredni PM Decision Chat z agentami Collector, Risk Analyzer, Resource Balancer, Reporter i Orchestrator
- Potwierdzanie draftów decyzji z czatu jako formalnych approval requestów
- Scheduler controls: enable/disable, manual daily check-in, manual weekly report
- Agent Collaboration Log pokazujący message passing i korelacje między agentami
- Weekly Report generowany przez Reporter Agent
- AI Agent Views dla Risk Analyzer, Reporter i Resource Balancer
- Filtry i wyszukiwanie w Agent Collaboration Log
- Eksport raportów CSV/PDF oraz eksport eventów CSV
- Powiadomienia przeglądarkowe dla nowych decyzji i wysokich ryzyk
- Webhook digest do Slack/Teams przez backend integrations API
- Wykresy workload i statusów decyzji oraz metryki wydajności agentów

### Topbar
- **Status połączenia** - pokazuje liczbę aktywnych agentów
- **Session ID** - identyfikator sesji
- **Refresh** - odświeżenie strony
- **Run Demo** - uruchomienie symulacji demo
- **Trigger Real Pipeline** - uruchomienie prawdziwego pipeline'u

### Sidebar
- **Logo PM PLUS**
- **Nawigacja** z sekcjami:
  - Overview (Briefing, Risks, Team Health)
  - AI Agents (Risk Analyzer, Reporter, Balancer)
  - Reports (Weekly Summary, All Events)
- **Badge ryzyka** - liczba oczekujących zatwierdzeń
- **Profil użytkownika** - Tamara N. (Project Manager)

## Real-time Updates (SSE)

Dashboard wykorzystuje Server-Sent Events (SSE) do otrzymywania aktualizacji w czasie rzeczywistym:

**Endpoint**: `GET /updates?sessionId={sessionId}`

**Typy wydarzeń**:
- `connected` - połączenie nawiązane
- `agent_message` - nowa wiadomość między agentami
- `approval_request` - nowe żądanie zatwierdzenia
- `metrics_update` - aktualizacja metryk projektu
- `team_health_update` - aktualizacja zdrowia zespołu

## API Integration

### Demo Endpoints
- `POST /demo/session` - utworzenie sesji
- `POST /demo/simulate` - uruchomienie symulacji
- `POST /demo/trigger-real` - uruchomienie prawdziwego pipeline'u

### Human-in-the-Loop
- `POST /human/approval-response` - odpowiedź na żądanie zatwierdzenia

### Backbone / Data & Orchestrator
- `POST /demo/seed-team` - seed projektu i zespołu
- `POST /demo/start-daily-checkin` - start check-in i `CHECKIN_REQUESTED`
- `POST /updates` - update pracownika i routing Collector → Risk/Balancer/Reporter
- `GET /decisions/:projectId` - pełny lifecycle decyzji
- `POST /decisions` - approve/reject
- `POST /decisions/:projectId/:decisionId/apply` - zastosowanie decyzji
- `POST /decisions/:projectId/:decisionId/skip` - pominięcie decyzji
- `POST /decisions/:projectId/:decisionId/audit` - audyt decyzji
- `POST /pm-chat/messages` - PM chat z agentem
- `POST /pm-chat/:projectId/:threadId/confirm` - potwierdzenie draftu z czatu
- `GET /scheduler/status` - status schedulera
- `POST /scheduler/run-daily` - manualny daily check-in
- `POST /scheduler/run-weekly` - manualny weekly report
- `GET /analytics/:projectId` - metryki agentów i projektu
- `GET /exports/weekly/:projectId.csv` - eksport raportu CSV
- `GET /exports/weekly/:projectId.pdf` - eksport raportu PDF
- `GET /integrations/status` - status Slack/Teams
- `POST /integrations/notify` - wysyłka webhook digestu

### State Management
- `GET /state` - pobranie stanu projektu
- `GET /weekly-snapshot` - podsumowanie tygodniowe

## Technologie

- **React** - framework UI
- **TypeScript** - typowanie
- **Tailwind CSS** - stylowanie
- **Vite** - build tool i dev server
- **Server-Sent Events** - real-time updates

## Uruchomienie

### Development
```bash
cd dashboard
npm install
npm run dev
```

Dashboard będzie dostępny na `http://localhost:5173`

### Production
```bash
cd dashboard
npm run build
```

Build zostanie utworzony w `dashboard/dist` i może być serwowany przez Express API.

## Konfiguracja Proxy

Vite proxy przekierowuje wszystkie żądania API do backendu:

```typescript
proxy: {
  '/demo': 'http://localhost:3000',
  '/updates': 'http://localhost:3000',
  '/human': 'http://localhost:3000',
  '/state': 'http://localhost:3000',
  '/weekly-snapshot': 'http://localhost:3000',
  // ... inne endpointy
}
```

## Zrealizowane Rozszerzenia

- **Risk Analyzer / Reporter / Balancer Views** - panel AI Agent Views pokazuje aktywność, decyzje i wpisy pamięci.
- **Filtrowanie eventów** - log można filtrować po agencie, typie wiadomości i treści.
- **Eksporty** - raport tygodniowy można pobrać jako CSV/PDF, a przefiltrowany log jako CSV.
- **Powiadomienia** - dashboard obsługuje browser notifications dla decyzji i wysokich ryzyk.
- **Slack/Teams** - backend wysyła digest przez webhooki, jeśli ustawiono `SLACK_WEBHOOK_URL` lub `MS_TEAMS_WEBHOOK_URL`.
- **Wykresy i metryki** - panel Project Charts pokazuje workload i statusy decyzji, a `/analytics/:projectId` zwraca metryki agentów.

## Troubleshooting

### Dashboard nie łączy się z API
1. Sprawdź czy API działa na porcie 3000: `curl http://localhost:3000/health`
2. Sprawdź konfigurację CORS w `api/index.ts`
3. Sprawdź proxy w `dashboard/vite.config.ts`

### SSE nie działa
1. Sprawdź czy endpoint `/updates` zwraca `text/event-stream`
2. Sprawdź czy CORS pozwala na SSE
3. Sprawdź logi przeglądarki (Network tab)

### TypeScript errors
Błędy TypeScript dotyczące brakujących typów React są normalne w development mode i nie wpływają na działanie aplikacji.
