# Generated test fixtures

These small fixtures contain no customer or third-party media. `transparent.png`
is a generated transparent 80×40 image. `tone.wav` contains generated 440/660 Hz
stereo sine waves; `tone.mp3` is its MP3 encode. `green.webm` is a generated green
128×64 video with a generated 440 Hz tone. Media duration is 1.5 seconds.

Reproduction with FFmpeg (test tooling, never a server runtime dependency):

```sh
ffmpeg -f lavfi -i 'sine=frequency=440:duration=1.5:sample_rate=44100' -f lavfi -i 'sine=frequency=660:duration=1.5:sample_rate=44100' -filter_complex amerge=inputs=2 -c:a pcm_s16le tone.wav
ffmpeg -i tone.wav -c:a libmp3lame -b:a 128k tone.mp3
ffmpeg -f lavfi -i 'color=c=0x16a34a:size=128x64:rate=24:duration=1.5' -f lavfi -i 'sine=frequency=440:duration=1.5:sample_rate=48000' -c:v libvpx-vp9 -deadline realtime -b:v 300k -c:a libopus -shortest green.webm
```

Extension tests also use generated solid blue 80×40 images and two-frame
animation fixtures. They contain no third-party or customer content:

```sh
ffmpeg -f lavfi -i 'color=c=0x2266cc:size=80x40:rate=1' -frames:v 1 -c:v libwebp -lossless 1 blue.webp
ffmpeg -f lavfi -i 'color=c=0x2266cc:size=80x40:rate=1' -frames:v 1 -pix_fmt bgr24 blue.bmp
ffmpeg -f lavfi -i 'color=c=0x2266cc:size=80x40:rate=1' -frames:v 1 blue.gif
ffmpeg -f lavfi -i 'testsrc=size=80x40:rate=1:duration=2' -frames:v 2 animated.gif
ffmpeg -f lavfi -i 'testsrc=size=80x40:rate=1:duration=2' -frames:v 2 -c:v libwebp_anim -lossless 1 animated.webp
```
