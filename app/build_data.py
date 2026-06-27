# -*- coding: utf-8 -*-
"""
KhoyaPaya Command Center - data builder.
Reads the raw operational CSVs (treated as read-only) and produces a single
web/data.json consumed by the live Leaflet dashboard.

The Missing-Persons dataset is NEVER modified. We only *augment* it:
  - geocode each last_seen_location
  - assign it to an administrative zone
  - compute zone-level risk, blind-spots and infrastructure stats
"""
import csv, json, math, os, hashlib, random

HERE = os.path.dirname(os.path.abspath(__file__))
RAW  = os.path.dirname(HERE)            # ...\KhoyaPaya
OUT  = os.path.join(HERE, "web", "data.json")

def p(*a): return os.path.join(RAW, *a)

# ---------------------------------------------------------------- geo helpers
def haversine(lat1, lon1, lat2, lon2):
    R = 6371000.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat/2)**2 +
         math.cos(math.radians(lat1))*math.cos(math.radians(lat2))*math.sin(dlon/2)**2)
    return 2*R*math.asin(math.sqrt(a))

def jitter(case_id, base_lat, base_lng, radius_m=170):
    """Deterministic small offset so co-located reports don't stack."""
    h = hashlib.md5(case_id.encode()).hexdigest()
    ang = (int(h[:8], 16) / 0xFFFFFFFF) * 2*math.pi
    rad = (int(h[8:16], 16) / 0xFFFFFFFF) * radius_m
    dlat = (rad*math.cos(ang)) / 111111.0
    dlng = (rad*math.sin(ang)) / (111111.0*math.cos(math.radians(base_lat)))
    return base_lat + dlat, base_lng + dlng

# ------------- geocoding table for the 20 last_seen_location values ----------
# Anchored to real infrastructure coords present in the other datasets so that
# "nearest CCTV / police / chokepoint" intelligence stays meaningful.
GEO = {
    "Ramkund Ghat":          (20.00670, 73.79060),
    "Laxmi Narayan Ghat":    (20.00550, 73.79200),
    "Nandur Ghat":           (20.01020, 73.80100),
    "Dasak Ghat":            (19.99300, 73.82800),
    "Gauri Patangan":        (20.00800, 73.78850),
    "Kapila Sangam":         (20.02050, 73.81500),
    "Takli Sangam":          (19.96500, 73.82000),
    "Kushavart Kund":        (19.96000, 73.67000),
    "Trimbakeshwar Approach":(19.96637, 73.66150),
    "Trimbak Road":          (19.97500, 73.70000),
    "Panchavati Circle":     (20.01000, 73.79500),
    "Main Police Chowki":    (20.00560, 73.77980),
    "Sadhugram Gate 1":      (20.01400, 73.80500),
    "Sadhugram Gate 2":      (20.01650, 73.80900),
    "Madsangvi Transit":     (20.06600, 73.88300),
    "Adgaon Parking":        (20.04200, 73.83800),
    "Rajur Bahula":          (19.94600, 73.67300),
    "Nashik Road Station":   (19.94880, 73.84060),
    "Bus Stand Nashik":      (19.99720, 73.77990),
    "Dindori Road Crossing": (20.03450, 73.80330),
}

def fnum(s):
    try: return float(str(s).strip())
    except: return None

# ----------------------------------------------------------------- load infra
def load_cctv():
    out=[]
    for r in csv.DictReader(open(p("CCTV_Locations.csv"), encoding="utf-8")):
        lng,lat = fnum(r["longitude"]), fnum(r["latitude"])
        if lat and lng: out.append({"id":r["camera_id"],"lat":lat,"lng":lng})
    return out

def load_police():
    out=[]
    for r in csv.DictReader(open(p("Police_Stations.csv"), encoding="utf-8")):
        lng,lat = fnum(r["longitude"]), fnum(r["latitude"])
        if lat and lng: out.append({"name":r["station_name"].strip(),"lat":lat,"lng":lng})
    return out

def load_chokepoints():
    out=[]
    for r in csv.DictReader(open(p("Chokepoints_Parking.csv"), encoding="utf-8")):
        lng,lat = fnum(r.get("longitude")), fnum(r.get("latitude"))
        cat=(r.get("category") or "").strip().strip('"')
        name=(r.get("location_name") or "").strip().strip('"')
        if lat and lng and name: out.append({"name":name,"category":cat,"lat":lat,"lng":lng})
    return out

def load_zones():
    out=[]
    for r in csv.DictReader(open(p("Zone_Boundaries.csv"), encoding="utf-8")):
        lat,lng = fnum(r["centroid_lat"]), fnum(r["centroid_lng"])
        if lat and lng:
            out.append({"name":r["zone_name"].strip(),"lat":lat,"lng":lng,
                        "pts":fnum(r.get("approx_boundary_points")) or 0})
    return out

def load_missing(zones):
    out=[]
    for r in csv.DictReader(open(p("Synthetic_Missing_Persons_2500.csv"), encoding="utf-8")):
        loc=r["last_seen_location"].strip()
        base=GEO.get(loc)
        if not base: continue
        lat,lng=jitter(r["case_id"], base[0], base[1])
        # nearest zone centroid
        zname=min(zones,key=lambda z:haversine(lat,lng,z["lat"],z["lng"]))["name"]
        out.append({
            "id":r["case_id"], "name":r["missing_person_name"].strip(),
            "gender":r["gender"].strip(), "age":r["age_band"].strip(),
            "status":r["status"].strip(), "ts":r["reported_at"].strip(),
            "loc":loc, "lat":round(lat,6),"lng":round(lng,6),
            "zone":zname, "lang":r["language"].strip(),
            "home":f'{r["district"].strip()}, {r["state"].strip()}',
            "desc":r["physical_description"].strip().strip('"'),
            "center":r["reporting_center"].strip(),
            "dup":r["is_duplicate_report"].strip().lower()=="true",
            # extra fields surfaced in the role-gated staff portal
            "phone":r["reporter_mobile"].strip(),
            "district":r["district"].strip(), "state":r["state"].strip(),
            "resolution":r["resolution_hours"].strip(),
            "remarks":r["remarks"].strip().strip('"'),
        })
    return out

# ----------------------------------------------- synthetic VOLUNTEER dataset
FIRST=["Aarav","Vivaan","Aditya","Sai","Reyansh","Krishna","Ishaan","Rohan","Arjun","Kabir",
       "Ananya","Diya","Saanvi","Aadhya","Pari","Anika","Myra","Sara","Riya","Kavya",
       "Prakash","Suresh","Mahesh","Ganesh","Ramesh","Sunita","Manisha","Pooja","Sneha","Vaishali",
       "Yusuf","Imran","Farah","Zoya","Tara","Nikhil","Omkar","Sachin","Deepak","Lata"]
LAST=["Patil","Deshmukh","Joshi","Kulkarni","Pawar","Shinde","More","Jadhav","Sharma","Verma",
      "Nair","Iyer","Reddy","Gupta","Singh","Khan","Sayyed","Bhosale","Kale","Wagh"]
SKILLS=["First Aid","Medical","Local Guide","Crowd Control","Child Care","Senior Care",
        "Sign Language","Photography Match","Drone Spotter"]
VLANG=["Hindi","Marathi","English","Gujarati","Telugu","Tamil","Bengali","Kannada"]

def generate_volunteers(zones, chokepoints, n=140):
    random.seed(42)
    # crowd-heavy anchor points: chokepoints + the geocoded last-seen hotspots
    anchors=[(c["lat"],c["lng"]) for c in chokepoints] + list(GEO.values())
    out=[]
    for i in range(1,n+1):
        base=random.choice(anchors)
        lat,lng=jitter(f"VOL{i}", base[0], base[1], radius_m=320)
        zname=min(zones,key=lambda z:haversine(lat,lng,z["lat"],z["lng"]))["name"]
        out.append({
            "id":f"V-{i:03d}",
            "name":f"{random.choice(FIRST)} {random.choice(LAST)}",
            "lat":round(lat,6),"lng":round(lng,6),"zone":zname,
            "phone":f"+91 9{random.randint(100000000,999999999)}",
            "skills":random.sample(SKILLS,k=random.randint(1,3)),
            "langs":random.sample(VLANG,k=random.randint(1,3)),
            "status":"Available" if random.random()<0.82 else "Engaged",
            "rating":round(random.uniform(3.8,5.0),1),
        })
    return out

def write_volunteer_csv(vols):
    path=p("Volunteers_Synthetic.csv")
    with open(path,"w",newline="",encoding="utf-8") as f:
        w=csv.writer(f)
        w.writerow(["volunteer_id","name","latitude","longitude","zone","phone",
                    "skills","languages","status","rating"])
        for v in vols:
            w.writerow([v["id"],v["name"],v["lat"],v["lng"],v["zone"],v["phone"],
                        "; ".join(v["skills"]),"; ".join(v["langs"]),v["status"],v["rating"]])
    return path

# ----------------------------------------------------------- zone intelligence
def norm(vals):
    lo,hi=min(vals),max(vals)
    rng=(hi-lo) or 1.0
    return [(v-lo)/rng for v in vals]

def build_zone_stats(zones, missing, cameras, chokepoints, police):
    ELDER={"61-70","71-80","80+"}
    PARKISH={"Parking","Parking belt","Outer parking","Transfer node"}
    by_zone={z["name"]:[] for z in zones}
    for m in missing: by_zone[m["zone"]].append(m)

    raw=[]
    for z in zones:
        recs=by_zone[z["name"]]
        n=len(recs)
        elder=sum(1 for m in recs if m["age"] in ELDER)
        unresolved=sum(1 for m in recs if m["status"] in ("Unresolved","Pending"))
        cams=sum(1 for c in cameras if haversine(z["lat"],z["lng"],c["lat"],c["lng"])<=900)
        chk=sum(1 for c in chokepoints if c["category"] in
                ("Traffic choke point","No-vehicle pressure zone")
                and haversine(z["lat"],z["lng"],c["lat"],c["lng"])<=900)
        park=sum(1 for c in chokepoints if c["category"] in PARKISH
                 and haversine(z["lat"],z["lng"],c["lat"],c["lng"])<=900)
        pdist=min(haversine(z["lat"],z["lng"],s["lat"],s["lng"]) for s in police)
        raw.append({"z":z,"n":n,"elder":elder/n if n else 0,
                    "unresolved":unresolved,"cams":cams,"chk":chk,
                    "park":park,"pdist":pdist})

    n_n   = norm([r["n"] for r in raw])
    n_eld = norm([r["elder"] for r in raw])
    n_chk = norm([r["chk"] for r in raw])
    n_prk = norm([r["park"] for r in raw])
    n_cam = norm([r["cams"] for r in raw])
    n_pd  = norm([r["pdist"] for r in raw])

    stats={}
    for i,r in enumerate(raw):
        risk = (0.34*n_n[i] + 0.15*n_eld[i] + 0.14*n_chk[i] +
                0.10*n_prk[i] + 0.15*(1-n_cam[i]) + 0.12*n_pd[i])
        blind = n_n[i]*(1-n_cam[i])           # high cases + low cameras
        reasons=[]
        if n_n[i]>0.6:  reasons.append("High historical reports")
        if n_eld[i]>0.6:reasons.append("High elderly visitor share")
        if n_chk[i]>0.6:reasons.append("Dense traffic chokepoints")
        if n_prk[i]>0.6:reasons.append("Major parking / transfer node")
        if n_cam[i]<0.34:reasons.append("Low CCTV coverage")
        if n_pd[i]>0.6: reasons.append("Far from nearest police station")
        if not reasons: reasons.append("Nominal risk profile")
        stats[r["z"]["name"]]={
            "cases":r["n"], "elder_pct":round(r["elder"]*100),
            "unresolved":r["unresolved"], "cameras":r["cams"],
            "chokepoints":r["chk"], "parking":r["park"],
            "police_km":round(r["pdist"]/1000,2),
            "risk":round(risk*100), "blind":round(blind*100),
            "reasons":reasons,
        }
    return stats

# ----------------------------------------------------------------------- main
def main():
    zones=load_zones()
    cameras=load_cctv()
    police=load_police()
    chokepoints=load_chokepoints()
    missing=load_missing(zones)
    volunteers=generate_volunteers(zones,chokepoints)
    vpath=write_volunteer_csv(volunteers)
    zstats=build_zone_stats(zones,missing,cameras,chokepoints,police)

    for z in zones: z["stats"]=zstats[z["name"]]

    blindspots=sorted(zones,key=lambda z:z["stats"]["blind"],reverse=True)[:6]

    # ---- split sensitive fields out of the PUBLIC payload ----
    # data.json is served statically (anyone on the map can fetch it), so it must
    # not carry reporter phone numbers, remarks, home district/state, etc.
    SENSITIVE={"phone","district","state","resolution","remarks"}
    public_missing=[{k:v for k,v in m.items() if k not in SENSITIVE} for m in missing]

    data={
        "meta":{
            "title":"KhoyaPaya — Kumbh Mela Command Center",
            "missing":len(missing),"cameras":len(cameras),
            "police":len(police),"chokepoints":len(chokepoints),
            "zones":len(zones),"volunteers":len(volunteers),
            "reunited":sum(1 for m in missing if m["status"]=="Reunited"),
            "open":sum(1 for m in missing if m["status"] in ("Unresolved","Pending")),
            "center":[20.0, 73.79],
        },
        "missing":public_missing, "cameras":cameras, "police":police,
        "chokepoints":chokepoints, "zones":zones, "volunteers":volunteers,
        "blindspots":[{"zone":z["name"],"lat":z["lat"],"lng":z["lng"],
                       "blind":z["stats"]["blind"],"cases":z["stats"]["cases"],
                       "cameras":z["stats"]["cameras"]} for z in blindspots],
    }
    os.makedirs(os.path.dirname(OUT),exist_ok=True)
    json.dump(data,open(OUT,"w",encoding="utf-8"),ensure_ascii=False)
    # full (sensitive) case list — NOT under web/, only the authenticated API reads it
    full_path=os.path.join(HERE,"cases_full.json")
    json.dump(missing,open(full_path,"w",encoding="utf-8"),ensure_ascii=False)
    print(f"[ok] wrote {OUT}")
    print(f"[ok] wrote private {full_path} (full fields, server-only)")
    print(f"     missing={len(missing)} cameras={len(cameras)} "
          f"police={len(police)} chokepoints={len(chokepoints)} zones={len(zones)} "
          f"volunteers={len(volunteers)}")
    print(f"     wrote synthetic volunteers -> {vpath}")
    print(f"     top blind-spot: {blindspots[0]['name']} "
          f"(score {blindspots[0]['stats']['blind']})")

if __name__=="__main__":
    main()
