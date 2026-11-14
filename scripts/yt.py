#!/usr/bin/env python3
"""YouTube kanal yöneticisi: yedek alma ve onaylı toplu düzenleme.

Yalnızca Python standart kütüphanesini kullanır. Kimlik bilgileri ortam
değişkenlerinden okunur (YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN) ve
hiçbir zaman ekrana ya da dosyaya yazılmaz.

Kullanım:
  python scripts/yt.py yedek                         # data/kanal.json
  python scripts/yt.py uygula planlar/X.json         # yalnızca önizleme
  python scripts/yt.py uygula planlar/X.json --gercekten
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

API = "https://www.googleapis.com/youtube/v3"
TOKEN_URL = "https://oauth2.googleapis.com/token"
ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
PLANS = ROOT / "planlar"

TITLE_MAX = 100
DESC_MAX_BYTES = 5000
TAGS_MAX_CHARS = 500
PLAYLIST_TITLE_MAX = 150
VIDEO_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")
SNIPPET_KEYS = ("title", "description", "tags", "categoryId", "defaultLanguage", "defaultAudioLanguage")
PLAYLIST_PRIVACY = ("public", "unlisted", "private")
# Günlük ücretsiz kota 10.000; okuma ve hatalar için pay bırakılır.
QUOTA_LIMIT = 9000
COST_WRITE = 50


class YouTube:
    def __init__(self) -> None:
        names = ("YT_CLIENT_ID", "YT_CLIENT_SECRET", "YT_REFRESH_TOKEN")
        missing = [n for n in names if not os.environ.get(n)]
        if missing:
            sys.exit("Eksik ortam değişkeni: " + ", ".join(missing))
        body = urllib.parse.urlencode({
            "client_id": os.environ["YT_CLIENT_ID"],
            "client_secret": os.environ["YT_CLIENT_SECRET"],
            "refresh_token": os.environ["YT_REFRESH_TOKEN"],
            "grant_type": "refresh_token",
        }).encode()
        data = self._http("POST", TOKEN_URL, body, {"Content-Type": "application/x-www-form-urlencoded"})
        self.token = data["access_token"]
        self.writes = 0

    @staticmethod
    def _http(method: str, url: str, body: bytes | None, headers: dict) -> dict:
        req = urllib.request.Request(url, data=body, method=method, headers=headers)
        where = f"{method} {url.split('?')[0]}"
        for attempt in range(4):
            try:
                with urllib.request.urlopen(req, timeout=60) as resp:
                    raw = resp.read()
                    return json.loads(raw) if raw else {}
            except urllib.error.HTTPError as err:
                detail = err.read().decode("utf-8", "replace")[:2000]
                if err.code in (500, 502, 503, 504) and attempt < 3:
                    time.sleep(2 ** attempt)
                    continue
                raise SystemExit(f"HTTP {err.code} {where}: {detail}")
            except urllib.error.URLError as err:
                if attempt < 3:
                    time.sleep(2 ** attempt)
                    continue
                raise SystemExit(f"Ağ hatası {where}: {err.reason}")
        raise AssertionError("unreachable")

    def call(self, method: str, path: str, params: dict, body: dict | None = None) -> dict:
        url = f"{API}/{path}?{urllib.parse.urlencode(params)}"
        headers = {"Authorization": f"Bearer {self.token}"}
        data = None
        if body is not None:
            data = json.dumps(body).encode()
            headers["Content-Type"] = "application/json"
        if method != "GET":
            self.writes += 1
        return self._http(method, url, data, headers)

    def pages(self, path: str, params: dict):
        page = None
        while True:
            query = dict(params, maxResults=50)
            if page:
                query["pageToken"] = page
            data = self.call("GET", path, query)
            yield from data.get("items", [])
            page = data.get("nextPageToken")
            if not page:
                return

    def videos(self, ids: list[str], part: str) -> dict[str, dict]:
        found: dict[str, dict] = {}
        for i in range(0, len(ids), 50):
            chunk = ids[i:i + 50]
            for item in self.call("GET", "videos", {"part": part, "id": ",".join(chunk)}).get("items", []):
                found[item["id"]] = item
        return found

    def playlist_video_ids(self, playlist_id: str) -> list[str]:
        return [it["contentDetails"]["videoId"]
                for it in self.pages("playlistItems", {"part": "contentDetails", "playlistId": playlist_id})]


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%SZ")


# ---------------------------------------------------------------- yedek

def backup(yt: YouTube) -> None:
    items = yt.call("GET", "channels", {"part": "snippet,contentDetails,statistics,brandingSettings", "mine": "true"}).get("items", [])
    if not items:
        sys.exit("Bu hesaba bağlı YouTube kanalı bulunamadı.")
    channel = items[0]
    uploads = channel["contentDetails"]["relatedPlaylists"]["uploads"]
    ids = yt.playlist_video_ids(uploads)
    videos = yt.videos(ids, "snippet,status,contentDetails,statistics,localizations")
    playlists = list(yt.pages("playlists", {"part": "snippet,status,contentDetails", "mine": "true"}))
    for pl in playlists:
        pl["videoIds"] = yt.playlist_video_ids(pl["id"])
    snapshot = {
        "alindi": now(),
        "kanal": channel,
        "videolar": [videos[i] for i in ids if i in videos],
        "oynatma_listeleri": playlists,
    }
    write_json(DATA / "kanal.json", snapshot)
    write_json(DATA / "yedekler" / f"{snapshot['alindi']}.json", snapshot)
    print(f"Kanal: {channel['snippet']['title']}")
    print(f"Video: {len(snapshot['videolar'])}, oynatma listesi: {len(playlists)}")
    print("Yazıldı: data/kanal.json ve data/yedekler/")


# ---------------------------------------------------------------- plan

def tag_chars(tags: list[str]) -> int:
    # YouTube boşluk içeren etiketi tırnakla sayar; etiketler virgülle ayrılır.
    return sum(len(t) + (2 if " " in t else 0) for t in tags) + max(len(tags) - 1, 0)


def check_text(errors: list[str], where: str, field: str, value) -> None:
    if not isinstance(value, str):
        errors.append(f"{where}: {field} metin olmalı")
    elif "<" in value or ">" in value:
        errors.append(f"{where}: {field} içinde < veya > olamaz (YouTube reddeder)")


def validate(plan: dict) -> list[str]:
    errors: list[str] = []
    if not isinstance(plan, dict):
        return ["Plan bir JSON nesnesi olmalı"]
    unknown = set(plan) - {"aciklama", "videolar", "oynatma_listeleri"}
    if unknown:
        errors.append("Bilinmeyen alan: " + ", ".join(sorted(unknown)))
    videos = plan.get("videolar", {})
    if not isinstance(videos, dict):
        return errors + ["videolar bir nesne olmalı: {video_id: {...}}"]
    for vid, change in videos.items():
        where = f"video {vid}"
        if not VIDEO_ID.match(vid):
            errors.append(f"{where}: geçersiz video kimliği")
        if not isinstance(change, dict) or not change:
            errors.append(f"{where}: değişiklik nesnesi boş/geçersiz")
            continue
        bad = set(change) - set(SNIPPET_KEYS)
        if bad:
            errors.append(f"{where}: desteklenmeyen alan: " + ", ".join(sorted(bad)))
        if "title" in change:
            check_text(errors, where, "title", change["title"])
            if isinstance(change["title"], str) and not (1 <= len(change["title"].strip()) and len(change["title"]) <= TITLE_MAX):
                errors.append(f"{where}: başlık 1-{TITLE_MAX} karakter olmalı")
        if "description" in change:
            check_text(errors, where, "description", change["description"])
            if isinstance(change["description"], str) and len(change["description"].encode()) > DESC_MAX_BYTES:
                errors.append(f"{where}: açıklama {DESC_MAX_BYTES} baytı aşıyor")
        if "tags" in change:
            tags = change["tags"]
            if not isinstance(tags, list) or not all(isinstance(t, str) and t.strip() for t in tags):
                errors.append(f"{where}: tags boş olmayan metinlerden oluşan liste olmalı")
            elif any("<" in t or ">" in t or "," in t for t in tags):
                errors.append(f"{where}: etiketlerde < > , olamaz")
            elif tag_chars(tags) > TAGS_MAX_CHARS:
                errors.append(f"{where}: etiketler toplam {TAGS_MAX_CHARS} karakteri aşıyor ({tag_chars(tags)})")
        for key in ("categoryId", "defaultLanguage", "defaultAudioLanguage"):
            if key in change and not isinstance(change[key], str):
                errors.append(f"{where}: {key} metin olmalı")
    playlists = plan.get("oynatma_listeleri", [])
    if not isinstance(playlists, list):
        return errors + ["oynatma_listeleri bir liste olmalı"]
    for n, pl in enumerate(playlists, 1):
        where = f"oynatma listesi #{n}"
        if not isinstance(pl, dict):
            errors.append(f"{where}: nesne olmalı")
            continue
        bad = set(pl) - {"id", "title", "description", "privacyStatus", "videolar"}
        if bad:
            errors.append(f"{where}: desteklenmeyen alan: " + ", ".join(sorted(bad)))
        title = pl.get("title")
        check_text(errors, where, "title", title)
        if isinstance(title, str) and not (title.strip() and len(title) <= PLAYLIST_TITLE_MAX):
            errors.append(f"{where}: başlık 1-{PLAYLIST_TITLE_MAX} karakter olmalı")
        if "description" in pl:
            check_text(errors, where, "description", pl["description"])
            if isinstance(pl["description"], str) and len(pl["description"].encode()) > DESC_MAX_BYTES:
                errors.append(f"{where}: açıklama {DESC_MAX_BYTES} baytı aşıyor")
        if pl.get("privacyStatus", "public") not in PLAYLIST_PRIVACY:
            errors.append(f"{where}: privacyStatus {PLAYLIST_PRIVACY} değerlerinden biri olmalı")
        ids = pl.get("videolar", [])
        if not isinstance(ids, list) or not all(isinstance(v, str) and VIDEO_ID.match(v) for v in ids):
            errors.append(f"{where}: videolar geçerli video kimliklerinden oluşan liste olmalı")
    return errors


def load_plan(arg: str) -> dict:
    path = (ROOT / arg).resolve() if not Path(arg).is_absolute() else Path(arg).resolve()
    if path.parent != PLANS.resolve() or path.suffix != ".json":
        sys.exit("Plan dosyası planlar/ klasöründe bir .json dosyası olmalı")
    if not path.is_file():
        sys.exit(f"Plan bulunamadı: {arg}")
    try:
        plan = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as err:
        sys.exit(f"Plan JSON hatası: {err}")
    errors = validate(plan)
    if errors:
        sys.exit("Plan geçersiz:\n  - " + "\n  - ".join(errors))
    return plan


def short(value, limit: int = 90) -> str:
    text = json.dumps(value, ensure_ascii=False)
    return text if len(text) <= limit else text[:limit - 1] + "…"


# ---------------------------------------------------------------- uygula

def apply(yt: YouTube, plan_arg: str, execute: bool) -> None:
    plan = load_plan(plan_arg)
    log = {"plan": plan_arg, "baslangic": now(), "gercekten": execute, "videolar": [], "oynatma_listeleri": []}

    # Videolar: mevcut snippet okunur, yalnızca plandaki alanlar değiştirilir.
    # videos.update snippet'i bütünüyle değiştirdiğinden etiket vb. korunmalıdır.
    changes = plan.get("videolar", {})
    current = yt.videos(list(changes), "snippet")
    missing = [v for v in changes if v not in current]
    if missing:
        sys.exit("Kanalda bulunamayan video: " + ", ".join(missing))
    updates = []
    for vid, change in changes.items():
        old = current[vid]["snippet"]
        before = {k: old[k] for k in SNIPPET_KEYS if k in old}
        after = dict(before, **change)
        if after.get("tags") == []:
            after.pop("tags")
        if after != before:
            updates.append((vid, before, after))

    # Oynatma listeleri: kimlikle ya da tam başlıkla eşleşir; yoksa oluşturulur.
    # Listeden video çıkarılmaz, yalnızca eksikler eklenir.
    existing = {pl["id"]: pl for pl in yt.pages("playlists", {"part": "snippet,status", "mine": "true"})}
    by_title = {}
    for pl in existing.values():
        by_title.setdefault(pl["snippet"]["title"], []).append(pl["id"])
    pl_ops = []
    for pl in plan.get("oynatma_listeleri", []):
        pid = pl.get("id")
        if pid and pid not in existing:
            sys.exit(f"Oynatma listesi bulunamadı: {pid}")
        if not pid:
            matches = by_title.get(pl["title"], [])
            if len(matches) > 1:
                sys.exit(f"'{pl['title']}' başlıklı birden çok liste var; planda id verin")
            pid = matches[0] if matches else None
        snippet = {"title": pl["title"], "description": pl.get("description", "")}
        privacy = pl.get("privacyStatus")
        if pid:
            cur = existing[pid]
            cur_snip = {"title": cur["snippet"]["title"], "description": cur["snippet"].get("description", "")}
            if "description" not in pl:
                snippet["description"] = cur_snip["description"]
            cur_privacy = cur["status"]["privacyStatus"]
            need_update = snippet != cur_snip or bool(privacy and privacy != cur_privacy)
            present = set(yt.playlist_video_ids(pid))
        else:
            cur_snip, cur_privacy, need_update, present = None, None, False, set()
        to_add = [v for v in dict.fromkeys(pl.get("videolar", [])) if v not in present]
        pl_ops.append({"id": pid, "snippet": snippet, "privacy": privacy or cur_privacy or "public",
                       "before": cur_snip, "update": need_update, "add": to_add})

    add_ids = sorted({v for op in pl_ops for v in op["add"]})
    unknown = [v for v in add_ids if v not in yt.videos(add_ids, "id")] if add_ids else []
    if unknown:
        sys.exit("Listeye eklenecek ama bulunamayan video: " + ", ".join(unknown))

    writes = len(updates) + sum((op["id"] is None) + op["update"] + len(op["add"]) for op in pl_ops)
    cost = writes * COST_WRITE
    print(f"Plan: {plan_arg}" + (f" — {plan['aciklama']}" if plan.get("aciklama") else ""))
    print(f"Video güncellemesi: {len(updates)} / {len(changes)} (diğerleri zaten aynı)")
    for vid, before, after in updates:
        print(f"\n  {vid}  {before.get('title', '')}")
        for key in SNIPPET_KEYS:
            if before.get(key) != after.get(key):
                print(f"    {key}: {short(before.get(key))}\n      → {short(after.get(key))}")
    for op in pl_ops:
        state = "YENİ" if op["id"] is None else ("güncellenecek" if op["update"] else "aynı")
        print(f"\n  Liste [{state}] {op['snippet']['title']} — eklenecek video: {len(op['add'])}")
    print(f"\nTahmini kota: {cost} birim (günlük sınır 10.000, bu araç {QUOTA_LIMIT} ile durur)")
    if cost > QUOTA_LIMIT:
        sys.exit("Plan tek günlük kotayı aşıyor; birden çok plana bölün.")
    if not execute:
        print("\nÖnizleme. Hiçbir şey değiştirilmedi. Uygulamak için --gercekten ekleyin.")
        return

    try:
        for vid, before, after in updates:
            yt.call("PUT", "videos", {"part": "snippet"}, {"id": vid, "snippet": after})
            log["videolar"].append({"id": vid, "once": before, "sonra": after})
            print(f"✓ video {vid}")
        for op in pl_ops:
            body = {"snippet": op["snippet"], "status": {"privacyStatus": op["privacy"]}}
            if op["id"] is None:
                op["id"] = yt.call("POST", "playlists", {"part": "snippet,status"}, body)["id"]
                print(f"✓ liste oluşturuldu: {op['snippet']['title']}")
            elif op["update"]:
                yt.call("PUT", "playlists", {"part": "snippet,status"}, dict(body, id=op["id"]))
                print(f"✓ liste güncellendi: {op['snippet']['title']}")
            for vid in op["add"]:
                yt.call("POST", "playlistItems", {"part": "snippet"}, {
                    "snippet": {"playlistId": op["id"], "resourceId": {"kind": "youtube#video", "videoId": vid}}})
            log["oynatma_listeleri"].append({"id": op["id"], "once": op["before"], "sonra": op["snippet"],
                                              "eklenen": op["add"]})
            if op["add"]:
                print(f"  + {len(op['add'])} video eklendi")
    finally:
        log["bitis"] = now()
        log["yazma_istegi"] = yt.writes
        write_json(DATA / "islemler" / f"{log['baslangic']}.json", log)
        print(f"Kayıt: data/islemler/{log['baslangic']}.json")


def main() -> None:
    parser = argparse.ArgumentParser(description="YouTube kanal yöneticisi")
    sub = parser.add_subparsers(dest="komut", required=True)
    sub.add_parser("yedek", help="Kanalın tüm meta verisini data/ altına yedekle")
    check = sub.add_parser("dogrula", help="Planı API'ye bağlanmadan doğrula")
    check.add_argument("plan")
    run = sub.add_parser("uygula", help="Planı önizle; --gercekten ile uygula")
    run.add_argument("plan")
    run.add_argument("--gercekten", action="store_true", help="Değişiklikleri kanala gönder")
    args = parser.parse_args()
    if args.komut == "dogrula":
        plan = load_plan(args.plan)
        print(f"Plan geçerli: {len(plan.get('videolar', {}))} video, "
              f"{len(plan.get('oynatma_listeleri', []))} oynatma listesi")
        return
    yt = YouTube()
    if args.komut == "yedek":
        backup(yt)
    else:
        apply(yt, args.plan, args.gercekten)


if __name__ == "__main__":
    main()
