#!/usr/bin/env python3
"""Bir kerelik YouTube yetkilendirmesi: refresh token üretir.

KENDİ BİLGİSAYARINIZDA çalıştırın (tarayıcı açılır):
  python3 scripts/yetkilendir.py ~/Downloads/client_secret_XXXX.json

Çıkan refresh token'ı GitHub → Settings → Secrets and variables → Actions
altına YT_REFRESH_TOKEN olarak ekleyin. Sohbete ya da repoya yapıştırmayın.
Yalnızca Python standart kütüphanesini kullanır.
"""
from __future__ import annotations

import base64
import hashlib
import http.server
import json
import secrets
import sys
import urllib.error
import urllib.parse
import urllib.request
import webbrowser

SCOPES = " ".join([
    # Video, oynatma listesi, yorum ve altyazı yönetimi
    "https://www.googleapis.com/auth/youtube.force-ssl",
    # İzlenme analizleri (salt okunur)
    "https://www.googleapis.com/auth/yt-analytics.readonly",
])


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit("Kullanım: python3 scripts/yetkilendir.py <client_secret.json>")
    with open(sys.argv[1], encoding="utf-8") as fh:
        cfg = json.load(fh).get("installed")
    if not cfg:
        sys.exit("Bu dosya bir 'Desktop app' OAuth istemcisine ait değil.")

    verifier = secrets.token_urlsafe(64)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    state = secrets.token_urlsafe(16)
    result: dict[str, str] = {}

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self) -> None:  # noqa: N802
            query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            if query.get("state", [""])[0] != state:
                self.send_response(400)
                self.end_headers()
                return
            result.update({k: v[0] for k, v in query.items()})
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write("Tamam. Bu sekmeyi kapatıp terminale dönebilirsiniz.".encode())

        def log_message(self, *args) -> None:
            pass

    server = http.server.HTTPServer(("127.0.0.1", 0), Handler)
    redirect = f"http://127.0.0.1:{server.server_port}"
    url = cfg["auth_uri"] + "?" + urllib.parse.urlencode({
        "client_id": cfg["client_id"],
        "redirect_uri": redirect,
        "response_type": "code",
        "scope": SCOPES,
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
    })
    print("Tarayıcıda açılmazsa bu adresi açın:\n" + url + "\n")
    webbrowser.open(url)
    while "code" not in result and "error" not in result:
        server.handle_request()
    server.server_close()
    if "error" in result:
        sys.exit("İzin verilmedi: " + result["error"])

    body = urllib.parse.urlencode({
        "client_id": cfg["client_id"],
        "client_secret": cfg["client_secret"],
        "code": result["code"],
        "code_verifier": verifier,
        "grant_type": "authorization_code",
        "redirect_uri": redirect,
    }).encode()
    req = urllib.request.Request(cfg["token_uri"], data=body, method="POST",
                                 headers={"Content-Type": "application/x-www-form-urlencoded"})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            tokens = json.load(resp)
    except urllib.error.HTTPError as err:
        sys.exit(f"Token alınamadı (HTTP {err.code}): {err.read().decode('utf-8', 'replace')[:500]}")
    refresh = tokens.get("refresh_token")
    if not refresh:
        sys.exit("Refresh token gelmedi. myaccount.google.com/permissions adresinden uygulamanın erişimini kaldırıp tekrar deneyin.")

    print("GitHub → Settings → Secrets and variables → Actions → New repository secret ile ekleyin:\n")
    print(f"  YT_CLIENT_ID      = {cfg['client_id']}")
    print("  YT_CLIENT_SECRET  = (client_secret JSON dosyasındaki client_secret değeri)")
    print(f"  YT_REFRESH_TOKEN  = {refresh}\n")
    print("Bu değerleri sohbete, repoya ya da başka bir yere yapıştırmayın.")


if __name__ == "__main__":
    main()
