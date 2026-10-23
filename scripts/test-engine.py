"""Exercise the production HTTP server inside an isolated, network-disabled image."""
import base64
import json
import pathlib
import subprocess

docker = ["docker", "--host=unix:///var/run/docker.sock"]
container = subprocess.check_output(docker + [
    "run", "--rm", "-d", "--network=none", "--read-only", "--cap-drop=ALL",
    "--security-opt=no-new-privileges", "--memory=512m", "--cpus=1", "--pids-limit=64",
    "converter-mce-engine:dev",
], text=True).strip()
client = """
import sys,json,base64,time,urllib.request,urllib.error
for attempt in range(50):
 try:
  urllib.request.urlopen('http://127.0.0.1:8080/health',timeout=1).read()
  break
 except OSError: time.sleep(0.1)
else: raise SystemExit('Engine did not start')
data=base64.b64decode(json.load(sys.stdin)['png'])
def send(payload,query):
 try:
  with urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:8080/convert?'+query,data=payload,method='POST'),timeout=10) as r:
   return r.status,dict(r.headers),r.read()
 except urllib.error.HTTPError as e: return e.code,dict(e.headers),e.read()
status,headers,result=send(data,'format=jpeg&quality=85&width=40')
assert status==200,(status,result)
assert headers['Content-Type']=='image/jpeg'
assert headers['X-Image-Width']=='40' and headers['X-Image-Height']=='20'
from PIL import Image
import io
with Image.open(io.BytesIO(result)) as image:
 image.load();assert image.size==(40,20)
 assert all(channel>=250 for channel in image.getpixel((1,1)))
assert send(b'not an image','format=jpeg')[0]==422
assert send(data,'format=pdf')[0]==422
print('3 production HTTP checks passed: real JPEG/pixels, malformed input, unsupported format.')
"""
try:
    png = (pathlib.Path(__file__).resolve().parents[1] / "tests/fixtures/transparent.png").read_bytes()
    result = subprocess.run(docker + ["exec", "-i", container, "python", "-c", client], input=json.dumps({"png": base64.b64encode(png).decode()}), text=True, timeout=30)
    if result.returncode:
        raise SystemExit(result.returncode)
finally:
    subprocess.run(docker + ["stop", "--time=2", container], stdout=subprocess.DEVNULL, check=True)
