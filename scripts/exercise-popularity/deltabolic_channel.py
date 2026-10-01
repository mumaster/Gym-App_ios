import re, json, sys, urllib.request, time
UA = {"User-Agent": "Mozilla/5.0", "Accept-Language": "en-US,en;q=0.9"}
def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30).read().decode("utf8")
def post(url, body):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={**UA, "Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(req, timeout=30).read().decode("utf8"))
def walk(o, out):
    if isinstance(o, dict):
        # long videos: lockupViewModel
        lm = o.get("lockupMetadataViewModel")
        if lm:
            title = lm.get("title", {}).get("content")
            views = None
            for row in lm.get("metadata", {}).get("contentMetadataViewModel", {}).get("metadataRows", []):
                for part in row.get("metadataParts", []):
                    lab = part.get("accessibilityLabel", "")
                    if "view" in lab: views = lab
            out.append(("video", title, views))
        # shorts: shortsLockupViewModel
        sv = o.get("shortsLockupViewModel")
        if sv:
            ov = sv.get("overlayMetadata", {})
            title = ov.get("primaryText", {}).get("content")
            views = ov.get("secondaryText", {}).get("content")
            vid = sv.get("onTap", {}).get("innertubeCommand", {}).get("reelWatchEndpoint", {}).get("videoId")
            out.append(("short", title, views))
        for v in o.values(): walk(v, out)
    elif isinstance(o, list):
        for v in o: walk(v, out)
def tokens(o, acc):
    if isinstance(o, dict):
        if "continuationCommand" in o: acc.append(o["continuationCommand"]["token"])
        for v in o.values(): tokens(v, acc)
    elif isinstance(o, list):
        for v in o: tokens(v, acc)
def scrape(tab):
    html = get(f"https://www.youtube.com/@DeltaBolic/{tab}")
    key = re.search(r'"INNERTUBE_API_KEY":"([^"]+)"', html).group(1)
    ver = re.search(r'"INNERTUBE_CLIENT_VERSION":"([^"]+)"', html).group(1)
    data = json.loads(re.search(r"var ytInitialData = (\{.*?\});</script>", html, re.S).group(1))
    out = []; walk(data, out)
    acc = []; tokens(data, acc)
    seen = set(); pages = 0
    while acc and pages < 400:
        tok = acc.pop()
        if tok in seen: continue
        seen.add(tok); pages += 1
        d = post(f"https://www.youtube.com/youtubei/v1/browse?key={key}", {"context": {"client": {"clientName": "WEB", "clientVersion": ver, "hl": "en", "gl": "US"}}, "continuation": tok})
        walk(d, out); tokens(d, acc); time.sleep(0.3)
    return out, pages
res = {}
for tab in ["videos", "shorts"]:
    out, pages = scrape(tab)
    res[tab] = out
    print(tab, "pages", pages, "items", len(out), file=sys.stderr)
json.dump(res, open("deltabolic.json", "w"), indent=0)
