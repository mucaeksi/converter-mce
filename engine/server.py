"""Network-free image processor. Only the bound Worker can reach this container."""
import io
import json
import warnings
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse

from PIL import Image, ImageOps, UnidentifiedImageError

Image.MAX_IMAGE_PIXELS = 8_000_000
warnings.simplefilter("error", Image.DecompressionBombWarning)
MAX_BYTES = 10 * 1024 * 1024
MAX_OUTPUT = 24 * 1024 * 1024


def convert(data, fmt, quality, width):
    if fmt not in ("jpeg", "png", "webp") or not 10 <= quality <= 95:
        raise ValueError("invalid_options")
    if width is not None and not 1 <= width <= 4096:
        raise ValueError("invalid_options")
    with Image.open(io.BytesIO(data)) as probe:
        if probe.format not in ("PNG", "JPEG") or probe.width * probe.height > Image.MAX_IMAGE_PIXELS:
            raise ValueError("unsupported_image")
        if getattr(probe, "n_frames", 1) != 1:
            raise ValueError("animated_image_not_supported")
        probe.verify()
    with Image.open(io.BytesIO(data)) as source:
        source.load()
        image = ImageOps.exif_transpose(source).convert("RGBA")
        if width is not None and width < image.width:
            height = max(1, int(image.height * width / image.width + 0.5))
            image = image.resize((width, height), Image.Resampling.LANCZOS)
        if fmt == "jpeg":
            background = Image.new("RGB", image.size, "white")
            background.paste(image, mask=image.getchannel("A"))
            image = background
        # A new pixel image deliberately strips EXIF, profiles and textual metadata.
        clean = Image.new(image.mode, image.size)
        clean.paste(image)
        output = io.BytesIO()
        clean.save(output, format={"jpeg": "JPEG", "png": "PNG", "webp": "WEBP"}[fmt], quality=quality)
        result = output.getvalue()
        if len(result) > MAX_OUTPUT:
            raise ValueError("output_too_large")
        with Image.open(io.BytesIO(result)) as check:
            check.load()
            if check.size != clean.size:
                raise ValueError("invalid_output")
        return result, clean.size


class Handler(BaseHTTPRequestHandler):
    def respond(self, code, data, mime="application/json", dimensions=None):
        self.send_response(code)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(data)))
        if dimensions:
            self.send_header("X-Image-Width", str(dimensions[0]))
            self.send_header("X-Image-Height", str(dimensions[1]))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        self.respond(200 if self.path == "/health" else 404, b'{"ok":true}')

    def do_POST(self):
        if urlparse(self.path).path != "/convert":
            return self.respond(404, b'{"error":"not_found"}')
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length < 1 or length > MAX_BYTES:
                return self.respond(413, b'{"error":"input_size"}')
            self.connection.settimeout(30)
            data = self.rfile.read(length)
            if len(data) != length:
                raise ValueError("incomplete_input")
            options = parse_qs(urlparse(self.path).query)
            fmt = options.get("format", ["jpeg"])[0]
            quality = int(options.get("quality", ["85"])[0])
            width = int(options["width"][0]) if "width" in options else None
            output, dimensions = convert(data, fmt, quality, width)
            self.respond(200, output, "image/" + fmt, dimensions)
        except (ValueError, OSError, UnidentifiedImageError, Image.DecompressionBombWarning, Image.DecompressionBombError):
            self.respond(422, json.dumps({"error": "invalid_or_unsupported_image"}).encode())
        except TimeoutError:
            self.respond(408, b'{"error":"timeout"}')

    def log_message(self, *_args):
        pass


if __name__ == "__main__":
    HTTPServer(("0.0.0.0", 8080), Handler).serve_forever()
