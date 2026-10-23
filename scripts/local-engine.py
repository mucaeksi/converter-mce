"""Local-only relay for hosts missing the kernel support used by Wrangler's container proxy.

The conversion runs in the actual production image, in a fresh network-disabled
Docker process. This relay is never deployed to Cloudflare.
"""
import json
import subprocess
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse

EXECUTE = """
import sys,json,server
options=json.loads(sys.argv[1])
try:
 data=sys.stdin.buffer.read(server.MAX_BYTES+1)
 if not 0<len(data)<=server.MAX_BYTES: raise ValueError('input_size')
 output,dimensions=server.convert(data,options['format'],options['quality'],options['width'])
 sys.stdout.buffer.write(json.dumps({'width':dimensions[0],'height':dimensions[1]}).encode()+b'\\n'+output)
except Exception:
 sys.exit(2)
"""


class Relay(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200 if self.path == "/health" else 404)
        self.end_headers()

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 10 * 1024 * 1024 or urlparse(self.path).path != "/convert":
                raise ValueError("invalid_request")
            self.connection.settimeout(30)
            body = self.rfile.read(length)
            query = parse_qs(urlparse(self.path).query)
            options = {"format": query.get("format", ["jpeg"])[0], "quality": int(query.get("quality", ["85"])[0]), "width": int(query["width"][0]) if "width" in query else None}
            process = subprocess.run([
                "docker", "--host=unix:///var/run/docker.sock", "run", "--rm", "-i", "--network=none", "--read-only",
                "--cap-drop=ALL", "--security-opt=no-new-privileges", "--memory=512m", "--cpus=1", "--pids-limit=64",
                "--entrypoint=python", "converter-mce-engine:dev", "-c", EXECUTE, json.dumps(options),
            ], input=body, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=60)
            if process.returncode:
                self.send_response(422 if process.returncode == 2 else 503); self.end_headers(); return
            header, output = process.stdout.split(b"\n", 1)
            dimensions = json.loads(header)
            self.send_response(200)
            self.send_header("Content-Type", "image/" + options["format"])
            self.send_header("Content-Length", str(len(output)))
            self.send_header("X-Image-Width", str(dimensions["width"]))
            self.send_header("X-Image-Height", str(dimensions["height"]))
            self.end_headers(); self.wfile.write(output)
        except (ValueError, TimeoutError, subprocess.TimeoutExpired, OSError):
            self.send_response(503); self.end_headers()

    def log_message(self, *_args):
        pass


if __name__ == "__main__":
    print("Local Docker conversion relay ready (loopback only, no container network).", flush=True)
    HTTPServer(("127.0.0.1", 8788), Relay).serve_forever()
