import re, json, sys, urllib.request, time
UA = {"User-Agent": "Mozilla/5.0", "Accept-Language": "en-US,en;q=0.9"}
html = urllib.request.urlopen(urllib.request.Request("https://www.youtube.com/results?search_query=bench+press", headers=UA), timeout=30).read().decode()
KEY = re.search(r'"INNERTUBE_API_KEY":"([^"]+)"', html).group(1)
VER = re.search(r'"INNERTUBE_CLIENT_VERSION":"([^"]+)"', html).group(1)
def num(t):
    if not t: return 0
    t = t.replace(",", "")
    m = re.search(r'([\d.]+)\s*([KMB]?)', t)
    if not m: return 0
    return int(float(m.group(1)) * {"": 1, "K": 1e3, "M": 1e6, "B": 1e9}[m.group(2)])
def walk(o, out):
    if isinstance(o, dict):
        vr = o.get("videoRenderer")
        if vr:
            title = "".join(r.get("text", "") for r in vr.get("title", {}).get("runs", []))
            views = num(vr.get("viewCountText", {}).get("simpleText") or "".join(r.get("text","") for r in vr.get("viewCountText", {}).get("runs", [])))
            ch = "".join(r.get("text","") for r in vr.get("ownerText", {}).get("runs", []))
            out.append({"title": title, "views": views, "channel": ch, "id": vr.get("videoId")})
        sv = o.get("shortsLockupViewModel")
        if sv:
            ov = sv.get("overlayMetadata", {})
            out.append({"title": ov.get("primaryText", {}).get("content", ""), "views": num(ov.get("secondaryText", {}).get("content")), "channel": "", "id": None})
        for v in o.values(): walk(v, out)
    elif isinstance(o, list):
        for v in o: walk(v, out)
def search(q):
    body = {"context": {"client": {"clientName": "WEB", "clientVersion": VER, "hl": "en", "gl": "US"}}, "query": q}
    req = urllib.request.Request(f"https://www.youtube.com/youtubei/v1/search?key={KEY}", data=json.dumps(body).encode(), headers={**UA, "Content-Type": "application/json"})
    d = json.loads(urllib.request.urlopen(req, timeout=30).read().decode())
    out = []; walk(d, out); return out
if __name__ == "__main__":
    qs = json.load(open(sys.argv[1])) if sys.argv[1].endswith(".json") else sys.argv[1:]
    res = {}
    for i, q in enumerate(qs):
        for attempt in range(3):
            try:
                res[q] = search(q); break
            except Exception as e:
                time.sleep(2 + attempt * 3)
        time.sleep(0.4)
        if i % 25 == 0: print(i, file=sys.stderr)
    json.dump(res, open(sys.argv[2] if len(sys.argv) > 2 and sys.argv[1].endswith(".json") else "yt-test.json", "w"))
