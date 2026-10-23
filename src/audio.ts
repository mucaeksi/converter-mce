function validateAudio(channels: Float32Array[], rate: number, gain: number) {
  if (![44100, 48000].includes(rate) || !Number.isFinite(gain) || gain < 0 || gain > 2 || channels.length < 1 || channels.length > 2 || channels.some(c => !c.length || c.length !== channels[0].length || c.length > rate * 120)) throw new Error('Geçersiz ses aralığı veya kanal sayısı.');
}
const pcm = (value: number, gain: number) => {
  const sample = Number.isFinite(value) ? Math.max(-1, Math.min(1, value * gain)) : 0;
  return Math.round(sample * (sample < 0 ? 32768 : 32767));
};
export function encodeWav(channels: Float32Array[], rate: number, gain: number) {
  validateAudio(channels, rate, gain);
  const frames = channels[0].length, count = channels.length;
  const bytes = new ArrayBuffer(44 + frames * count * 2), view = new DataView(bytes);
  const text = (offset: number, value: string) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, 'RIFF'); view.setUint32(4, bytes.byteLength - 8, true); text(8, 'WAVE'); text(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, count, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * count * 2, true); view.setUint16(32, count * 2, true); view.setUint16(34, 16, true);
  text(36, 'data'); view.setUint32(40, frames * count * 2, true);
  for (let frame = 0; frame < frames; frame++) for (let channel = 0; channel < count; channel++) {
    view.setInt16(44 + (frame * count + channel) * 2, pcm(channels[channel][frame], gain), true);
  }
  return { blob: new Blob([bytes], { type: 'audio/wav' }), name: 'converter-mce.wav', detail: `${(frames / rate).toFixed(2)} saniye · ${rate} Hz · ${count} kanal · PCM 16 bit` };
}

export async function encodeAudio(channels: Float32Array[], rate: number, gain: number, format: 'wav' | 'mp3') {
  if (format === 'wav') return encodeWav(channels, rate, gain);
  if (format !== 'mp3') throw new Error('Desteklenmeyen ses çıktısı.');
  validateAudio(channels, rate, gain);
  const { Mp3Encoder } = await import('@breezystack/lamejs');
  const encoder = new Mp3Encoder(channels.length, rate, 192), chunks: Uint8Array<ArrayBuffer>[] = [];
  for (let start = 0; start < channels[0].length; start += 1152) {
    const length = Math.min(1152, channels[0].length - start);
    const block = channels.map(channel => Int16Array.from(channel.subarray(start, start + length), value => pcm(value, gain)));
    const encoded = encoder.encodeBuffer(block[0], block[1]);
    if (encoded.length) chunks.push(new Uint8Array(encoded));
  }
  const tail = encoder.flush(); if (tail.length) chunks.push(new Uint8Array(tail));
  const blob = new Blob(chunks, { type: 'audio/mpeg' });
  if (!blob.size) throw new Error('MP3 çıktısı boş.');
  return { blob, name: 'converter-mce.mp3', detail: `${(channels[0].length / rate).toFixed(2)} saniye kaynak · ${rate} Hz · ${channels.length} kanal · MP3 / 192 kbps` };
}
