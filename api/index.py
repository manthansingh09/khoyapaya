# -*- coding: utf-8 -*-
"""
Vercel serverless entrypoint (Python / Flask).

Serves the static frontend AND the JSON API for the KhoyaPaya command center.
Mirrors app/server.py, adapted for a stateless serverless runtime:
  - data is PRECOMPUTED (app/cases_full.json + app/web/data.json are committed),
    so nothing is built at request time.
  - sessions are signed-cookie only (no in-memory revocation registry — that
    can't be shared across serverless instances). Logout clears the cookie.
Set these in Vercel → Project → Settings → Environment Variables:
  FLASK_SECRET      (required) any long random string — signs the session cookie
  ANTHROPIC_API_KEY (optional) enables the Claude free-form report extraction
"""
import os, json, hashlib
from flask import Flask, session, request, jsonify, send_from_directory

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # repo root
WEB  = os.path.join(ROOT, "app", "web")
FULL = json.load(open(os.path.join(ROOT, "app", "cases_full.json"), encoding="utf-8"))

AGE_BANDS = sorted({r["age"] for r in FULL if r.get("age")})
GENDERS   = sorted({r["gender"] for r in FULL if r.get("gender")})
LOCATIONS = sorted({r["loc"] for r in FULL if r.get("loc")})

# ---------------- credentials + RBAC ----------------
def h(pw): return hashlib.sha256(("kp$alt::"+pw).encode()).hexdigest()
USERS = {
    "admin":     {"hash": h("admin123"),     "name": "Control Room Admin"},
    "police":    {"hash": h("police123"),    "name": "Duty Officer"},
    "volunteer": {"hash": h("volunteer123"), "name": "Field Volunteer"},
}
RESTRICTED = {
    "admin":     set(),
    "police":    {"resolution", "dup"},
    "volunteer": {"phone", "home", "district", "state", "resolution", "remarks", "dup"},
}
def filter_record(rec, role):
    drop = RESTRICTED.get(role)
    if drop is None: return {}
    return {k: v for k, v in rec.items() if k not in drop}

# ---------------- Claude extraction ----------------
try:
    import anthropic
    _claude = anthropic.Anthropic()
    AI_OK = bool(os.environ.get("ANTHROPIC_API_KEY"))
except Exception as e:
    _claude = None; AI_OK = False

EXTRACT_SYSTEM = (
    "You are an intake assistant for a Kumbh Mela missing-person help desk. "
    "From a free-form spoken description (which may be in English, Hindi, Marathi, "
    "Gujarati or Tamil, possibly transliterated), extract the report fields. "
    "Map the age to the closest provided age band and the last-seen place to the "
    "closest provided location. Use \"\" (empty string) for any field you cannot "
    "determine. Keep the person's name and description in readable English/transliteration."
)
def extract_schema():
    return {
        "type": "object",
        "properties": {
            "name": {"type": "string"},
            "age_band": {"type": "string", "enum": AGE_BANDS + [""]},
            "gender": {"type": "string", "enum": GENDERS + [""]},
            "location": {"type": "string", "enum": LOCATIONS + [""]},
            "language": {"type": "string"},
            "description": {"type": "string"},
        },
        "required": ["name", "age_band", "gender", "location", "language", "description"],
        "additionalProperties": False,
    }

# ---------------- app ----------------
app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET") or "kp-dev-secret-set-FLASK_SECRET-in-vercel"
app.config.update(SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE="Lax",
                  SESSION_COOKIE_SECURE=True)

@app.after_request
def no_cache(r):
    if request.path.startswith("/api/"):
        r.headers["Cache-Control"] = "no-store"
    return r

def current_role():
    return session.get("role")   # stateless: trust the signed cookie

@app.post("/api/login")
def login():
    d = request.get_json(silent=True) or {}
    role = (d.get("role") or "").lower().strip()
    pw = d.get("password") or ""
    u = USERS.get(role)
    if not u or h(pw) != u["hash"]:
        return jsonify(ok=False, error="Invalid role or access code"), 401
    session.clear(); session["role"] = role; session["name"] = u["name"]
    return jsonify(ok=True, role=role, name=u["name"])

@app.post("/api/logout")
def logout():
    session.clear(); return jsonify(ok=True)

@app.get("/api/session")
def whoami():
    role = current_role()
    if not role: return jsonify(ok=False), 401
    return jsonify(ok=True, role=role, name=session.get("name"))

@app.get("/api/cases")
def cases():
    role = current_role()
    if not role: return jsonify(ok=False, error="Not authenticated"), 401
    data = [filter_record(r, role) for r in FULL]
    return jsonify(ok=True, role=role, name=session.get("name"), count=len(data), cases=data)

@app.post("/api/extract")
def extract():
    if not AI_OK or not _claude:
        return jsonify(ok=False, error="AI extraction unavailable (no ANTHROPIC_API_KEY)"), 503
    d = request.get_json(silent=True) or {}
    transcript = (d.get("transcript") or "").strip()
    if not transcript:
        return jsonify(ok=False, error="empty transcript"), 400
    try:
        msg = _claude.messages.create(
            model="claude-opus-4-8", max_tokens=1024, system=EXTRACT_SYSTEM,
            messages=[{"role": "user",
                       "content": f'Spoken report:\n"""{transcript}"""\n\nExtract the fields.'}],
            output_config={"format": {"type": "json_schema", "schema": extract_schema()}},
        )
        text = next((b.text for b in msg.content if b.type == "text"), "{}")
        return jsonify(ok=True, fields=json.loads(text), transcript=transcript)
    except Exception as e:
        return jsonify(ok=False, error=f"{type(e).__name__}: {e}"), 502

# ---------------- static frontend ----------------
@app.get("/")
def root():
    return send_from_directory(WEB, "index.html")

@app.get("/<path:p>")
def assets(p):
    full = os.path.join(WEB, p)
    if os.path.isfile(full):
        return send_from_directory(WEB, p)
    return send_from_directory(WEB, "index.html")
