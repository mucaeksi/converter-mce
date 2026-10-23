export function encodeWav(channels: Float32Array[], rate: number, gain: number) {
  if (![44100, 48000].includes(rate) || !Number.isFinite(gain) || gain < 0 || gain > 2 || channels.length < 1 || channels.length > 2 || channels.some(c => !c.length || c.length !== channels[0].length || c.length > rate * 120)) throw new Error('Geçersiz ses aralığı veya kanal sayısı.');
  const frames = channels[0].length, count = channels.length;
  const bytes = new ArrayBuffer(44 + frames * count * 2), view = new DataView(bytes);
  const text = (offset: number, value: string) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, 'RIFF'); view.setUint32(4, bytes.byteLength - 8, true); text(8, 'WAVE'); text(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, count, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * count * 2, true); view.setUint16(32, count * 2, true); view.setUint16(34, 16, true);
  text(36, 'data'); view.setUint32(40, frames * count * 2, true);
  for (let frame = 0; frame < frames; frame++) for (let channel = 0; channel < count; channel++) {
    const sample = Math.max(-1, Math.min(1, channels[channel][frame] * gain));
    view.setInt16(44 + (frame * count + channel) * 2, Math.round(sample * (sample < 0 ? 32768 : 32767)), true);
  }
  return { blob: new Blob([bytes], { type: 'audio/wav' }), name: 'converter-mce.wav', detail: `${(frames / rate).toFixed(2)} saniye · ${rate} Hz · ${count} kanal · PCM 16 bit` };
}
