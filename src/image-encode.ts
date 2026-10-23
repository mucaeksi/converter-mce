export function encodeBmp(pixels: Uint8ClampedArray, width: number, height: number) {
  const stride = Math.ceil(width * 3 / 4) * 4, buffer = new ArrayBuffer(54 + stride * height), view = new DataView(buffer);
  view.setUint16(0, 0x4d42, true); view.setUint32(2, buffer.byteLength, true); view.setUint32(10, 54, true);
  view.setUint32(14, 40, true); view.setInt32(18, width, true); view.setInt32(22, height, true);
  view.setUint16(26, 1, true); view.setUint16(28, 24, true); view.setUint32(34, stride * height, true);
  const output = new Uint8Array(buffer);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const source = (y * width + x) * 4, target = 54 + (height - 1 - y) * stride + x * 3;
    output[target] = pixels[source + 2]; output[target + 1] = pixels[source + 1]; output[target + 2] = pixels[source];
  }
  return new Blob([buffer], { type: 'image/bmp' });
}

export async function encodeIco(png: Blob, width: number, height: number) {
  const header = new ArrayBuffer(22), view = new DataView(header);
  view.setUint16(2, 1, true); view.setUint16(4, 1, true); view.setUint8(6, width === 256 ? 0 : width); view.setUint8(7, height === 256 ? 0 : height);
  view.setUint16(10, 1, true); view.setUint16(12, 32, true); view.setUint32(14, png.size, true); view.setUint32(18, 22, true);
  return new Blob([header, png], { type: 'image/vnd.microsoft.icon' });
}
