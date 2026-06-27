# KhoyaPaya — Kumbh Mela Missing-Person Command Center

A **live operational dashboard** that augments the (read-only) Missing-Persons
dataset with intelligence built from the CCTV, Zones, Police and
Chokepoints/Parking datasets. The missing-person records are **never modified** —
they are only geocoded, zoned and analysed.

## Run it

Double-click **`RUN.bat`** (or):

```bash
cd app
python server.py     # Flask app with real server-side auth + RBAC
```

It rebuilds the data and opens `http://127.0.0.1:8765/`.
(Internet is needed for map tiles, Leaflet libraries, and OSRM vehicle routing.)
`serve.py` remains as a zero-dependency static fallback (public map only, **no auth**).

## Languages

The UI is available in **English, हिन्दी, मराठी, ગુજરાતી, தமிழ்** via the 🌐 selector in the top bar
(present on the map, login, and portal pages). Choice persists across pages/visits (localStorage).
Translations live in `web/i18n.js`; strings are tagged with `data-i18n` and resolved by `t(key)`.
Dataset values (names, descriptions) and a few operational log lines stay in their source form.

## Voice-guided report intake

The **➕ File New Report** modal has a **🎤 Voice Guide** that files a report by conversation in the
selected language (English / हिन्दी / मराठी / ગુજરાતી / தமிழ்):

- The agent **speaks each question** (text-to-speech) and **listens** (speech-to-text) using the
  browser **Web Speech API** — no API key or backend.
- Answers are parsed into the form: name (free text), **age** (number → age band), **gender**
  (multilingual keywords), **location** (fuzzy-matched to known last-seen spots), **description** (free text).
- You review the filled form and hit File — voice fills, human confirms.

Requires **Chrome or Edge** with mic permission (Firefox lacks `SpeechRecognition`); needs internet.
Code in `web/voice.js`. For production-grade Indian-language accuracy, swap the engine for
**Bhashini/ULCA** (Govt of India ASR/TTS) or cloud STT.

### 🗣️ AI free-form extraction (Claude)

The **🗣️ Describe freely (AI)** button lets a reporter say **one natural sentence** in any of the
five languages; the browser sends the transcript to the Flask `/api/extract` endpoint, which calls
**Claude (`claude-opus-4-8`, structured outputs)** server-side to fill **every field at once** —
name, age band, gender, last-seen location, language, and description.

- The API key stays server-side (`ANTHROPIC_API_KEY`); the browser only sends the transcript.
- Claude maps free speech to the dataset's valid enums (e.g. *"राम कुंड के पास"* → `Ramkund Ghat`,
  *"ऊँचा सुनाई देता है"* → "hard of hearing", *"about 75"* → `71-80`).
- If the key/SDK is absent, it **falls back** to the offline keyword heuristics.
- Install the SDK once: `pip install anthropic`.

## Deploy to Vercel

The repo is Vercel-ready — `api/index.py` is a Flask **serverless function** that serves both
the static frontend and the JSON API; `vercel.json` routes everything to it.

1. Push to GitHub (already done) and **Import** the repo at [vercel.com/new](https://vercel.com/new).
2. In **Project → Settings → Environment Variables**, add:
   - `FLASK_SECRET` — any long random string (signs the login session cookie). **Required.**
   - `ANTHROPIC_API_KEY` — your Anthropic key (enables the 🗣️ Claude free-form extraction). Optional;
     without it the voice intake falls back to offline heuristics.
3. **Deploy.** No build settings needed — `requirements.txt` + `vercel.json` are auto-detected.

Files: `vercel.json` (builds `api/index.py` with `@vercel/python`, bundles `app/**`, routes all
traffic to it), `requirements.txt` (flask + anthropic + python-dotenv), `api/index.py` (the function).

> Serverless note: sessions are **signed-cookie only** on Vercel (the in-memory revocation registry
> from `app/server.py` can't be shared across serverless instances), so logout clears the cookie
> rather than being server-revoked. The generated `app/web/data.json` + `app/cases_full.json` are
> committed (deterministic output) so nothing is built at request time.

## Staff login & access control (server-enforced)

Open **🔐 Staff Login** → sign in → role-gated **Case Register** (`/portal.html`).

| Role | Password | Sees |
|---|---|---|
| 🛡️ Admin | `admin123` | everything + CSV export |
| 🚓 Police | `police123` | + reporter phone, home, remarks (no resolution/dup) |
| 🧑‍🤝‍🧑 Volunteer | `volunteer123` | operational fields only — **phone/home/remarks removed server-side** |

RBAC is enforced in `server.py`, not the browser:
- Passwords are checked server-side (SHA-256); the session lives in a **signed cookie**.
- `/api/cases` requires a valid session and **strips restricted fields before sending** — a volunteer's browser never receives phone numbers.
- The full dataset (`app/cases_full.json`) sits **outside `web/`**, so it can't be fetched statically; `web/data.json` (the public map feed) is sanitised.
- An in-memory **active-session registry** makes logout real: a cleared *or stolen* cookie is rejected after logout.

> Still a demo gate (single shared password per role, in-memory sessions). For production: per-user accounts, a real session/identity store, and HTTPS.

## What's inside

| Module | Datasets used | What it does |
|---|---|---|
| **AI Search-Radius Prediction** | Missing · Chokepoints · Zones | Ranks the most probable corridors (ghats, transfer nodes, parking) with %, weighted by distance, pedestrian-flow category and age profile |
| **CCTV Recommendation Engine** | Missing · CCTV · Zones | Picks the top 5 of 1,280 cameras along the predicted corridor |
| **Nearest Response** | Missing · Police · Zones | Closest station + estimated drive/walk response time |
| **Likely Movement Route** | Missing · Chokepoints · Police | Last seen → transfer node → outer parking → police |
| **Similar Past Cases** | Missing | Same location + age-band history |
| **Zone Risk Index** | ALL | 0–100 composite (reports, elderly %, chokepoints, parking, inverse-CCTV, police distance) |
| **CCTV Blind-Spot Detection** | Missing · CCTV · Zones | High-missing + low-camera zones → mobile cam / drone / volunteer tower |
| **Integrated GIS Dashboard** | ALL | Toggleable layers, clustering, heatmap, filters, live case workflow |
| **Live Report Intake** | Missing (in-session) | "File New Report" form; new cases appear live without touching the source CSV |
| **Semantic Duplicate Detection** | Missing | TF-IDF cosine + name (Dice bigram) + location/age heuristics flag likely duplicates before filing |
| **Auto-Dispatch Automation** | Volunteers · Police · CCTV | On a new report, nearest *available* volunteers + police + cameras are auto-notified; volunteers flip to "Engaged" |
| **YOLO CCTV Auto-Flagging** | CCTV · Missing | Simulated detection engine streams person-match flags with confidence; high-confidence pings pulse on the map |
| **Synthetic Volunteers** | generated | 140 field volunteers (skills, languages, status, rating) → `Volunteers_Synthetic.csv` |

### Using the new features
- **➕ File New Report** (top-right) → fill the form → **🔎 Check Duplicates** runs semantic search across all 2,500 records → **✅ File & Auto-Dispatch** files the case and fires the volunteer/police/CCTV dispatch log.
- **🎥 CCTV AI** toggle → starts the YOLO feed panel (bottom-right). Each detection shows camera, confidence, matched attributes; **Review** jumps to the case + camera.

## Architecture

```
app/
  build_data.py     # CSVs -> geocode+zone+risk -> web/data.json (public) + cases_full.json (private)
  server.py         # Flask: static + /api/login /api/logout /api/session /api/cases (RBAC)
  serve.py          # zero-dependency static fallback (public map only, no auth)
  cases_full.json   # FULL case fields — server-only, never under web/
  web/
    index.html      # map dashboard shell        login.html  # staff login
    app.js          # client AI modules          auth.js     # posts to /api/login
    portal.html     # case register table        portal.js   # fetches /api/cases
    style.css       # government-portal theme
    data.json       # generated, sanitised (no phone/remarks/home)
```

Built with Python stdlib (no pip installs) + Leaflet / MarkerCluster / Leaflet.heat (CDN).
