# -*- coding: utf-8 -*-
"""
KhoyaPaya Command Center — Flask server with REAL server-side auth + RBAC.

- Public map assets (web/) are served statically; web/data.json is sanitised
  (no reporter phone numbers / remarks / home).
- The full case data (cases_full.json) lives OUTSIDE web/ and is reachable
  only via /api/cases, which requires a valid signed-cookie session and
  STRIPS restricted fields on the server before they ever reach the browser.
"""
import os, json, hashlib, secrets, webbrowser, threading
try:
    from dotenv import load_dotenv      # load a local .env if present (optional)
    load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))
except Exception:
    pass
from flask import Flask, session, request, jsonify, send_from_directory

HERE=os.path.dirname(os.path.abspath(__file__))
WEB=os.path.join(HERE,"web")
PORT=int(os.environ.get("PORT","8765"))

# rebuild data so public + private payloads are in sync with the CSVs
try:
    import build_data; build_data.main()
except Exception as e:
    print("[warn] data build skipped:",e)

FULL=json.load(open(os.path.join(HERE,"cases_full.json"),encoding="utf-8"))

# valid enums for AI extraction, derived from the (authoritative) full dataset
AGE_BANDS=sorted({r["age"] for r in FULL if r.get("age")})
GENDERS=sorted({r["gender"] for r in FULL if r.get("gender")})
LOCATIONS=sorted({r["loc"] for r in FULL if r.get("loc")})

# ---------------- Claude (free-form report extraction) ----------------
try:
    import anthropic
    _claude=anthropic.Anthropic()                       # reads ANTHROPIC_API_KEY
    AI_OK=bool(os.environ.get("ANTHROPIC_API_KEY"))
except Exception as e:
    _claude=None; AI_OK=False
    print("[warn] Claude extraction disabled:", e)

# ---------------- credentials (server-side) ----------------
def h(pw): return hashlib.sha256(("kp$alt::"+pw).encode()).hexdigest()
USERS={
    "admin":     {"hash":h("admin123"),     "name":"Control Room Admin"},
    "police":    {"hash":h("police123"),    "name":"Duty Officer"},
    "volunteer": {"hash":h("volunteer123"), "name":"Field Volunteer"},
}
# fields each role is NOT allowed to receive
RESTRICTED={
    "admin":     set(),
    "police":    {"resolution","dup"},
    "volunteer": {"phone","home","district","state","resolution","remarks","dup"},
}
def filter_record(rec, role):
    drop=RESTRICTED.get(role)
    if drop is None: return {}           # unknown role -> deny all
    return {k:v for k,v in rec.items() if k not in drop}

# ---------------- app ----------------
app=Flask(__name__, static_folder=WEB, static_url_path="")
app.secret_key=os.urandom(32)            # signs the session cookie
app.config.update(SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE="Lax")

# server-side registry of live session ids so logout (and a stolen cookie)
# can be invalidated — a signed cookie alone cannot be revoked.
ACTIVE=set()
def current_role():
    if session.get("sid") in ACTIVE and "role" in session:
        return session["role"]
    return None

@app.after_request
def no_cache(r):
    r.headers["Cache-Control"]="no-store"; return r

@app.route("/")
def root(): return send_from_directory(WEB,"index.html")

@app.post("/api/login")
def login():
    d=request.get_json(silent=True) or {}
    role=(d.get("role") or "").lower().strip()
    pw=d.get("password") or ""
    u=USERS.get(role)
    if not u or h(pw)!=u["hash"]:
        return jsonify(ok=False, error="Invalid role or access code"), 401
    sid=secrets.token_hex(16); ACTIVE.add(sid)
    session.clear(); session["sid"]=sid; session["role"]=role; session["name"]=u["name"]
    return jsonify(ok=True, role=role, name=u["name"])

@app.post("/api/logout")
def logout():
    ACTIVE.discard(session.get("sid")); session.clear()
    return jsonify(ok=True)

@app.get("/api/session")
def whoami():
    role=current_role()
    if not role: return jsonify(ok=False), 401
    return jsonify(ok=True, role=role, name=session.get("name"))

@app.get("/api/cases")
def cases():
    role=current_role()
    if not role: return jsonify(ok=False, error="Not authenticated"), 401
    data=[filter_record(r, role) for r in FULL]
    return jsonify(ok=True, role=role, name=session.get("name"),
                   count=len(data), cases=data)

# ---- AI extraction: free-form spoken description -> structured fields ----
EXTRACT_SYSTEM=(
    "You are an intake assistant for a Kumbh Mela missing-person help desk. "
    "From a free-form spoken description (which may be in English, Hindi, Marathi, "
    "Gujarati or Tamil, possibly transliterated), extract the report fields. "
    "Map the age to the closest provided age band and the last-seen place to the "
    "closest provided location. Use \"\" (empty string) for any field you cannot "
    "determine. Keep the person's name and description in readable English/transliteration."
)
def extract_schema():
    return {
        "type":"object",
        "properties":{
            "name":{"type":"string","description":"Missing person's name, or \"\" if not stated"},
            "age_band":{"type":"string","enum":AGE_BANDS+[""],"description":"Closest age band"},
            "gender":{"type":"string","enum":GENDERS+[""]},
            "location":{"type":"string","enum":LOCATIONS+[""],"description":"Closest last-seen location"},
            "language":{"type":"string","description":"Language the person speaks, if mentioned, else \"\""},
            "description":{"type":"string","description":"Physical description: clothing, distinctive marks"},
        },
        "required":["name","age_band","gender","location","language","description"],
        "additionalProperties":False,
    }

@app.post("/api/extract")
def extract():
    if not AI_OK or not _claude:
        return jsonify(ok=False, error="AI extraction unavailable (no ANTHROPIC_API_KEY)"), 503
    d=request.get_json(silent=True) or {}
    transcript=(d.get("transcript") or "").strip()
    if not transcript:
        return jsonify(ok=False, error="empty transcript"), 400
    try:
        msg=_claude.messages.create(
            model="claude-opus-4-8",
            max_tokens=1024,
            system=EXTRACT_SYSTEM,
            messages=[{"role":"user","content":
                f"Spoken report:\n\"\"\"{transcript}\"\"\"\n\nExtract the fields."}],
            output_config={"format":{"type":"json_schema","schema":extract_schema()}},
        )
        text=next((b.text for b in msg.content if b.type=="text"), "{}")
        fields=json.loads(text)
        return jsonify(ok=True, fields=fields, transcript=transcript)
    except Exception as e:
        return jsonify(ok=False, error=f"{type(e).__name__}: {e}"), 502

def open_browser():
    webbrowser.open(f"http://127.0.0.1:{PORT}/index.html")

if __name__=="__main__":
    print(f"\n  KhoyaPaya Command Center (Flask + auth)  ->  http://127.0.0.1:{PORT}/")
    print("  Staff login at /login.html   (Ctrl+C to stop)\n")
    threading.Timer(1.0, open_browser).start()
    app.run(host="127.0.0.1", port=PORT, debug=False, threaded=True)
