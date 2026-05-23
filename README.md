# CrowdPulse AI — Real-time AI Command Center for Cricket Stadium Crowd Management

> **Google Agentic AI Premier League — Finale Submission**

## Problem Statement

Massive crowds at cricket matches create dangerous bottlenecks, security vulnerabilities, and logistical chaos. Current stadium operations rely on fragmented, manual systems unable to adapt instantly to rapid crowd surges, weather shifts, or emerging threats. CrowdPulse AI is an integrated, real-time command platform that unifies ticketing, dynamically routes crowd flow, and automates emergency responses for a safe and seamless fan experience.

## Architecture

```
┌──────────────────────────────────────────────────┐
│              CrowdPulse AI Dashboard              │
│     React 18 · Vite · Tailwind CSS · Recharts     │
└──────────────────────┬───────────────────────────┘
                       │ REST API (polling 3s)
┌──────────────────────▼───────────────────────────┐
│           Orchestrator Agent (Express.js)          │
│        Gemini 2.0 Flash + Function Calling         │
├───────────────────────────────────────────────────┤
│  8 Agentic Tools:                                  │
│  ├─ get_gate_status     ├─ get_zone_density        │
│  ├─ reroute_crowd       ├─ trigger_emergency       │
│  ├─ update_gate_status  ├─ get_weather_status      │
│  ├─ get_crowd_analytics └─ assign_ticket_gate      │
├───────────────────────────────────────────────────┤
│  Simulation Engine (In-Memory)                     │
│  12 Gates · 8 Zones · Live Incidents · Weather     │
└───────────────────────────────────────────────────┘
```

### Multi-Agent Design

| Agent | Role | Tools |
|---|---|---|
| **Orchestrator** | Central reasoning via Gemini 2.0 Flash | All 8 tools via function calling |
| **Crowd Flow Agent** | Gate density analysis + dynamic rerouting | `get_gate_status`, `get_zone_density`, `reroute_crowd` |
| **Emergency Response Agent** | Anomaly detection + protocol triggers | `trigger_emergency_protocol`, `get_zone_density` |
| **Ticketing Intelligence Agent** | Optimal gate assignment for arrivals | `assign_ticket_gate`, `get_gate_status` |

## Tech Stack

| Layer | Technology |
|---|---|
| AI | Google Gemini 2.0 Flash (`@google/genai` SDK) with Function Calling |
| Backend | Node.js, Express.js |
| Frontend | React 18, Vite, Tailwind CSS, Recharts, Lucide Icons |
| Security | Helmet.js, CORS, express-rate-limit |
| Deployment | Docker, Google Cloud Run |

## Features

- **Live Dashboard** — 6 KPI cards, gate grid, zone heatmap, crowd trend chart, incident feed
- **AI Command Panel** — Natural language interface to Gemini 2.0 Flash with function calling; 6 quick-action buttons
- **Agentic Function Calling** — Gemini autonomously calls stadium tools (gate status, crowd rerouting, emergency protocols) in a multi-turn loop
- **Dynamic Crowd Routing** — AI analyzes zone density and reroutes crowds to less congested gates
- **Emergency Automation** — Auto-detects anomalies and triggers lockdown/evacuation/medical protocols
- **Ticket Intelligence** — Optimal gate assignment for incoming ticket holders based on real-time load
- **Weather-Aware Operations** — Weather monitoring with operational impact assessment
- **Simulation Engine** — Realistic 50,000-capacity stadium with fluctuating gates, zones, incidents, and weather

## Quick Start

### Prerequisites
- Node.js 18+
- Gemini API key from [Google AI Studio](https://aistudio.google.com/)

### Run Locally

```bash
# Clone & enter
cd crowdpulse-ai

# Backend
cd backend
echo "GEMINI_API_KEY=your_key_here" > .env
npm install
npm start           # → http://localhost:8080

# Frontend (dev mode, optional)
cd ../frontend
npm install
npm run dev         # → http://localhost:5173 (proxied to backend)
```

### Production Build

```bash
cd frontend && npm run build
cp -r dist/* ../backend/public/
cd ../backend && npm start
```

## Deployment

### Option A: Antigravity (Recommended)

1. Push code to GitHub (`.env` is gitignored — keys stay safe)
2. Connect repo in Antigravity dashboard
3. Set environment variable `GEMINI_API_KEY` in Antigravity's env config
4. Deploy — Antigravity reads the Dockerfile automatically

### Option B: GCP Cloud Run (Manual)

```bash
# Set project
gcloud config set project crowdpulseai-497205

# Build & push
gcloud builds submit --tag gcr.io/crowdpulseai-497205/crowdpulse-ai

# Deploy
gcloud run deploy crowdpulse-ai \
  --image gcr.io/crowdpulseai-497205/crowdpulse-ai \
  --platform managed \
  --region asia-south1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=$GEMINI_API_KEY \
  --memory 512Mi \
  --cpu 1
```

### Option C: Cloud Build (CI/CD)

```bash
gcloud builds submit \
  --config cloudbuild.yaml \
  --substitutions _GEMINI_API_KEY=$GEMINI_API_KEY
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/stadium/state` | Full stadium state snapshot |
| GET | `/api/stadium/gates` | All gate statuses |
| GET | `/api/stadium/zones` | Zone density data |
| GET | `/api/stadium/incidents` | Incident feed |
| GET | `/api/stadium/alerts` | Active alerts |
| POST | `/api/agent/query` | Send natural language command to Gemini agent |
| POST | `/api/agent/auto-analyze` | Trigger autonomous AI analysis cycle |
| PATCH | `/api/stadium/gates/:id/status` | Update gate status |
| POST | `/api/stadium/match-status` | Update match phase |

## Evaluation Criteria Alignment

| Criteria | Points | How CrowdPulse Addresses It |
|---|---|---|
| **Functional Fulfillment** | 15 | Unifies ticketing, crowd routing, and emergency response in one real-time AI command center |
| **Scalability & Security** | 10 | Helmet.js, CORS, rate limiting, stateless design for horizontal scaling, Cloud Run ready |
| **Static Code Analysis & Google AI SDKs** | 15 | Clean modular code, `@google/genai` SDK with Gemini 2.0 Flash function calling, 8 structured tool definitions |
| **GCP Deployment** | 5 | Dockerfile included, Cloud Run deployment commands provided |

## License

MIT
