# Dash0 — observability manual

Hur Mälarkrets-appens telemetri samlas in, skeppas till Dash0, och hur
man läser ut den via queries och dashboards. Levande dokument — uppdatera
när uppsättningen ändras.

## Översikt av uppsättningen

Tre signaltyper strömmar till Dash0: **traces**, **metrics**, **logs**.
Alla tre passerar en OpenTelemetry Collector som kör på VPS:n (samma
Docker-stack som appen) innan de skickas vidare via OTLP/HTTP till
Dash0 ingress i `eu-west-1`.

```
┌────────────────────────┐
│  Mälarkrets-app        │
│  (Next.js container)   │
│                        │
│  • @vercel/otel        │──── OTLP traces ─┐
│  • src/lib/logger.ts   │──── OTLP logs ───┤
│  • src/instrumentation │                  │
└────────────────────────┘                  │
                                            ▼
                               ┌────────────────────────┐
┌────────────────────────┐     │  OTel Collector        │
│  Docker daemon         │────▶│  (distroless container)│──▶ Dash0 (EU)
│  /var/run/docker.sock  │     │                        │
│  → docker_stats        │     │  Receivers:            │
└────────────────────────┘     │  • otlp (app)          │
                               │  • docker_stats        │
┌────────────────────────┐     │  • hostmetrics         │
│  VPS host              │────▶│                        │
│  /proc, /sys (/hostfs) │     │  Pipelines:            │
└────────────────────────┘     │  • traces              │
                               │  • metrics             │
                               │  • logs                │
                               └────────────────────────┘
```

## Datakällor

### 1. App traces (requests + spans)
**Källa:** `@vercel/otel` auto-instrumentation.
**Konfig:** `src/instrumentation.ts` (serviceName = `malarkrets-app`).
**Vad som fångas:** HTTP requests, fetch-calls, automatiska spans för
server components och route handlers.

### 2. App logs (strukturerade)
**Källa:** `src/lib/logger.ts` → OTLP Logs SDK.
**Konfig:** `src/instrumentation.ts` sätter upp `LoggerProvider` med
`BatchLogRecordProcessor` som exporterar till collectorns `/v1/logs`.
**Vad som fångas:** Allt som anropar `log.info/warn/error/debug` — auth
events, API-fel, health-check failures.
**Dev-mode:** när `OTEL_EXPORTER_OTLP_ENDPOINT` är unset (vanligt vid
`bun dev`) no-op:ar OTel-sidan — loggar syns bara i stdout.

### 3. Per-container-stats
**Källa:** `docker_stats`-receiver läser `/var/run/docker.sock`.
**Samplingsintervall:** 30s.
**Vad som fångas:** CPU, RAM, nätverk, disk-I/O per container (app,
postgres, caddy, otel-collector).

### 4. VPS host metrics
**Källa:** `hostmetrics`-receiver läser host's `/proc`, `/sys`, `/var`
via bindmount `/:/hostfs:ro`.
**Samplingsintervall:** 30s.
**Vad som fångas:** Total RAM/swap, CPU (inkl. `.utilization`), load
average, disk, filesystem, network.
**Medvetet utelämnat:** per-process-metrics — skulle kräva `CAP_SYS_PTRACE`
eller root, onödigt på distroless-imagen.

## Konfigurationsfiler

| Fil | Vad den styr |
|---|---|
| `src/instrumentation.ts` | App-sidans OTel-setup (traces + logs) |
| `src/lib/logger.ts` | Logger-API:t appen använder (`log.*`, `errMsg`, `errAttrs`) |
| `otel-collector-config.yaml` | Collector: receivers, processors, exporters, pipelines |
| `docker-compose.yml` | Collector-service + bindmounts för docker.sock och `/hostfs` |
| `.env` (på VPS) | `DASH0_AUTH_TOKEN`, `DEPLOYMENT_ENV`, `DOCKER_GID` |

## Miljövariabler

| Variabel | Var sätts | Vad den gör |
|---|---|---|
| `DASH0_AUTH_TOKEN` | `.env` på VPS | Bearer-token, ingest-scope, mot `ingress.eu-west-1.aws.dash0.com` |
| `DEPLOYMENT_ENV` | `.env` på VPS | Taggar alla signaler med `deployment.environment` (production / staging) |
| `DOCKER_GID` | `.env` på VPS | GID för docker-gruppen på hosten, så non-root collector kan läsa docker.sock via `group_add` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Compose-level på app-tjänsten | Default `http://otel-collector:4318`, appen pushar hit |
| `OTEL_SERVICE_NAME` | Compose-level på app-tjänsten | Default `malarkrets-app`, sätts som `service.name` på alla signaler |

## PromQL — query-referens

Dash0 tar PromQL med OTel semantic conventions. Två syntaxvarianter:

**Label-selector (vad Dash0 UI genererar):**
```
{otel_metric_name="system.memory.utilization", deployment_environment_name="production"}
```

**Underscore-formad metric-name (traditionell PromQL):**
```
system_memory_utilization{deployment_environment_name="production"}
```

Båda fungerar. Använd vad Dash0 UI:t föreslår när du bygger paneler.

### VPS health-panels

#### RAM utilization %
```promql
{otel_metric_name="system.memory.utilization", deployment_environment_name="production"} * 100
```
Unit: `%`. Rekommenderad alert: `> 80 for 5m`.

#### Swap used (MB)
```promql
{otel_metric_name="system.paging.usage", state="used", deployment_environment_name="production"} / 1024 / 1024
```
Unit: `MB`. Rekommenderad alert: `> 500 for 5m`.

#### Disk utilization on `/` (%)
```promql
{otel_metric_name="system.filesystem.utilization", mountpoint="/", deployment_environment_name="production"} * 100
```
Unit: `%`. Alert: `> 80`.
**Obs:** om `mountpoint="/"` returnerar tomt, kolla i metric explorer
vad labeln faktiskt heter — kan vara `/hostfs` beroende på receiverns
beteende med `root_path`.

#### CPU utilization % (alla cores aggregerat)
```promql
(1 - avg({otel_metric_name="system.cpu.utilization", state="idle", deployment_environment_name="production"})) * 100
```
Unit: `%`. Alert: `> 80 for 5m`.

#### CPU load 5m (normalized per core)
```promql
{otel_metric_name="system.cpu.load_average.5m", deployment_environment_name="production"}
  /
count(count by (cpu) ({otel_metric_name="system.cpu.time", deployment_environment_name="production"}))
```
Dimensionless. Alert: `> 1.5 for 5m`.
Skalar automatiskt om VPS uppgraderas till fler vCPU.

#### Disk I/O throughput (B/s)
```promql
rate({otel_metric_name="system.disk.io", deployment_environment_name="production"}[5m])
```
Group by: `direction`. Unit: `B/s`.

#### Network traffic (B/s)
```promql
rate({otel_metric_name="system.network.io", deployment_environment_name="production"}[5m])
```
Group by: `direction` (receive/transmit). Unit: `B/s`.

#### Network errors + dropped packets
```promql
rate({otel_metric_name="system.network.errors", deployment_environment_name="production"}[5m])
+
rate({otel_metric_name="system.network.dropped", deployment_environment_name="production"}[5m])
```
Unit: `packets/s`. Alert: `> 5/s`.

### Per-container-panels (från `docker_stats`)

#### Container memory (MB) — alla
```promql
{otel_metric_name="container.memory.usage", deployment_environment_name="production"} / 1024 / 1024
```
Group by: `container.name`. Stacked area rekommenderas.

#### Container CPU %
```promql
rate({otel_metric_name="container.cpu.usage.percpu", deployment_environment_name="production"}[1m]) * 100
```
Group by: `container.name`.

#### App-container specifikt (RAM)
```promql
{otel_metric_name="container.memory.usage", container_name="malarkrets-app-1", deployment_environment_name="production"} / 1024 / 1024
```

#### Postgres-container specifikt (RAM)
```promql
{otel_metric_name="container.memory.usage", container_name="malarkrets-postgres-1", deployment_environment_name="production"} / 1024 / 1024
```

### App activity (logs + traces)

Dessa byggs i Dash0:s Logs- respektive Traces-flikar, inte som PromQL
metric-paneler.

| Panel | Typ | Filter |
|---|---|---|
| Log volume per severity | Logs | `service.name="malarkrets-app"`, group by `severityText` |
| Failed login rate | Logs | `body startsWith "auth: login failed"`, count per minut |
| Health check errors | Logs | `body="health: db ping failed"` |
| Server action errors (alla) | Logs | `severityText="ERROR"`, group by `body` |
| HTTP p95 per route | Traces | aggregation `p95(duration)` group by `http.route` |
| HTTP error rate (5xx) | Traces | `http.response.status_code >= 500`, count per minut |

## Rekommenderade alerts

| Alert | Query | Tröskel | Varför |
|---|---|---|---|
| RAM nära taket | `system.memory.utilization` | `> 0.8 for 5m` | 2 GB VPS — reser fahnan innan OOM |
| Swap används | `system.paging.usage{state="used"}` | `> 500MB for 5m` | Latens-katastrof, uppgradera RAM |
| Disk nära fullt | `system.filesystem.utilization{mountpoint="/"}` | `> 0.8` | 50 GB disk — minst 10 GB headroom måste finnas |
| CPU-kö | `system.cpu.load_average.5m / core_count` | `> 1.5 for 5m` | Processer köar, latens stiger |
| DB-ping failar | log body `"health: db ping failed"` | `> 3 per minut` | DB-kontakt problematisk |
| Failed login brute-force | log body `"auth: login failed"` same email | `> 10 per minut` | Misstänkt attack |
| HTTP 5xx burst | traces `status_code >= 500` | `> 10 per minut` | App-problem, trigga incident |

## Debug-flöde när "inga data kommer"

Om Dash0 slutar ta emot signaler, gå igenom i ordning:

### 1. Är collector-containern uppe?
```bash
docker compose ps otel-collector
```
Leta efter `Up`. Om `Restarting` eller saknas → config-problem.

### 2. Vad säger collector-loggen?
```bash
docker compose logs otel-collector --tail 100
```
Vanliga mönster:
- `401 Unauthorized` → token ogiltig
- `permission denied` på `/hostfs/...` → bindmount-problem
- `connection refused` till Dash0 → nätverksproblem
- Tyst efter startup → receivers emitterar inget, eller Docker log-driver trasig

### 3. Fungerar Dash0-endpointen alls?
```bash
curl -I --max-time 10 https://ingress.eu-west-1.aws.dash0.com
```
`405 Method Not Allowed` på GET = bra (endpointen lever, tar bara POST).

### 4. Är tokenen frisk?
```bash
curl -X POST --max-time 10 \
  -H "Authorization: Bearer $(grep ^DASH0_AUTH_TOKEN= .env | cut -d= -f2)" \
  -H "Content-Type: application/x-protobuf" \
  --data '' \
  https://ingress.eu-west-1.aws.dash0.com/v1/metrics
```
- `200` → token OK
- `400` → token OK, bara empty payload avvisas
- `401/403` → rotera token i Dash0 UI, uppdatera `.env`, `docker compose restart otel-collector`

### 5. Force-recreate collectorn om configen ändrats

**Viktigt:** bindmount:ade config-filer triggar inte container-recreate
automatiskt. Om `otel-collector-config.yaml` ändrats i git krävs:
```bash
docker compose up -d --force-recreate otel-collector
```
`scripts/deploy-local.sh` gör inte detta idag — lägg som follow-up.

### 6. Sista utvägen: rulla tillbaka config

```bash
git show HEAD~1:otel-collector-config.yaml > otel-collector-config.yaml
docker compose up -d --force-recreate otel-collector
```

Om data flödar efter rollback vet du att senaste config-ändringen är
boven.

## Planerade förbättringar (parking lot)

Uppdatera när nya behov dyker upp eller när nåt blir aktuellt:

### Deploy-annotations
Skicka en anteckning till Dash0 efter varje deploy så vertikala linjer
visas i dashboards — gör "det började efter den här deployen"-debugging
trivial.

**Konkret:** curl POST till `/api/v2/annotations` som steg i
`release.yml` efter att CI-builden klarat. ~5 rader YAML + 1 GitHub
Secret (`DASH0_API_TOKEN` — separat från ingest-token som redan finns).

### Collector healthcheck fixad
Nuvarande healthcheck (`wget --spider http://localhost:13133/`) kraschar
tyst eftersom distroless-imagen saknar `wget`. Behöver ersättas med
antingen en `CMD`-test som bara anropar collectorn själv, eller byta
till en non-distroless-variant för just healthcheck.

### System.*.utilization för fler scrapers
Idag aktiverade: cpu, memory, filesystem. Inte aktiverade: disk
(förvirrande definition), network (ingen meningsfull "taknivå"),
paging (rå bytes tydligare). Behov kan dyka upp — lätt att aktivera
per scraper i `otel-collector-config.yaml`.

### Logg-retention per severity
Dash0 har retention-policy som styrs via UI. DEBUG-logs kan rimligen ha
kort retention (7 dagar), ERROR längre (90 dagar). Inte konfigurerat
ännu.

### Instrumentation av ytterligare kodvägar
Nuvarande `log.*`-täckning: auth (lib/auth.ts), server actions
(actions/*), health (api/health). Saknas:
- Route handlers i `src/app/api/*` (förutom health)
- Client-error boundary reporting (via en liten `/api/client-error`-endpoint)
- Migrations (scripts/migrate.mjs) — just nu console.log

### Automatisk dashboard-provisioning
Dashboards byggs idag manuellt i UI. Dash0 har en Infrastructure-as-Code-
route via deras API eller Terraform-provider. Värt att utforska när
dashboard-setupen har stabiliserats, så återskapande (efter att tappa
en dashboard, eller vid onboarding av nytt team) blir en copy-paste-sak.

## Relaterade filer

- `src/instrumentation.ts` — OTel-setup för appen
- `src/lib/logger.ts` — Logger-API
- `otel-collector-config.yaml` — Collector-pipeline
- `docker-compose.yml` — `otel-collector`-servicedefinition
- `.env.prod.example` — vilka env-variabler som krävs
- `docs/vps-setup.md` — VPS-provisioning, inkl. var `DOCKER_GID` kommer ifrån
