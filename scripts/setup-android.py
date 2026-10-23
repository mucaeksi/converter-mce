"""Install the pinned Linux x86_64 development toolchain, retaining TLS/checksum verification."""
import hashlib
import json
import os
import pathlib
import platform
import shutil
import subprocess
import tarfile
import tempfile
import urllib.request
import zipfile

project = pathlib.Path(__file__).resolve().parents[1]
tools = project.parent / ".tools"
spec = json.loads((project / "scripts/toolchain.json").read_text())
if platform.system() != "Linux" or platform.machine() not in ("x86_64", "amd64"):
    raise SystemExit("Install Android SDK and JDK 21 for this platform; this bootstrap is Linux x86_64 only.")
tools.mkdir(exist_ok=True)


def download(url, expected, algorithm, path):
    with urllib.request.urlopen(url, timeout=60) as response, path.open("wb") as output:
        shutil.copyfileobj(response, output)
    digest = hashlib.new(algorithm)
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    if digest.hexdigest() != expected:
        path.unlink()
        raise SystemExit("Toolchain checksum mismatch; refusing installation.")


jdk = tools / spec["jdk"]["directory"]
sdk = tools / "android-sdk"
with tempfile.TemporaryDirectory(prefix="converter-toolchain-") as temporary:
    temporary = pathlib.Path(temporary)
    if not (jdk / "bin/javac").is_file():
        archive = temporary / "jdk.tar.gz"
        download(spec["jdk"]["url"], spec["jdk"]["sha256"], "sha256", archive)
        with tarfile.open(archive) as tar:
            tar.extractall(tools, filter="data")
    manager = sdk / "cmdline-tools/latest/bin/sdkmanager"
    if not manager.is_file():
        archive = temporary / "android.zip"
        download(spec["android"]["url"], spec["android"]["sha1"], "sha1", archive)
        with zipfile.ZipFile(archive) as zipped:
            zipped.extractall(temporary / "sdk")
        manager.parent.parent.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(temporary / "sdk/cmdline-tools"), manager.parent.parent)
        for binary in manager.parent.iterdir():
            binary.chmod(0o755)
    if not (sdk / "platforms/android-36/android.jar").is_file() or not (sdk / "build-tools/36.0.0/aapt2").is_file():
        process_env = os.environ.copy()
        process_env["JAVA_HOME"] = str(jdk)
        process_env["ANDROID_HOME"] = str(sdk)
        # sdkmanager's current native Android CLI inherits the session HTTPS proxy/CA.
        subprocess.run([str(manager), "--sdk_root=" + str(sdk), spec["android"]["platform"], spec["android"]["buildTools"]], input="y\n" * 100, text=True, env=process_env, check=True)
print("Pinned Android SDK and JDK are available under", tools)
