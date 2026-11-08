# Hero chant video

`public/hero/` holds the homepage hero loop, in two cuts:

| File | Use |
| --- | --- |
| `hero-chant-desktop.{webm,mp4}` + poster | 1600×900, for wide screens (`min-aspect-ratio: 1/1`). Singers on the right, space for the headline on the left. |
| `hero-chant-mobile.{webm,mp4}` + poster | 720×1280, for tall screens. Lead singer zoomed and raised above the text. |

`HeroSection.tsx` picks the cut, plays it muted and looped, and the "Tap to hear the chant" chip unmutes it. Reduced-motion and Data Saver users get the poster only.

## Rebuild

```bash
scripts/hero-video/build.sh path/to/raw-chant.mp4 /tmp/hero-work
```

It needs ffmpeg (with libvpx, libopus) and python3 with numpy, pillow and onnxruntime. The steps:

1. **Matte**: RobustVideoMatting (downloaded once) cuts every singer out of the background. This drops the wall and the burnt-in caption.
2. **Backdrop**: an ink (`#121611`) base with a camwood and sun glow behind the group, a cool indigo corner and slow drifting haze. Soft masks fade the clip's own frame edges into the dark.
3. **Grade**: a little more contrast and warmth on the singers, plus a vignette. The video fades from and to ink at the loop point.
4. **Audio**: highpass, denoise, low-mid warmth, a softer 3 kHz phone edge and light compression. Then a 3.6 s synthetic hall reverb sits 8 dB under the voice, with a quiet F♯/C♯ drone pad (the chant's tonic, tuned slightly flat to match) and brown-noise air. It is loudness-normalised to −16 LUFS, with fades at the loop seam.
5. **Encode**: H.264 MP4 (faststart) and VP9 WebM with Opus, plus a JPEG poster from 0:20.

The positions and sizes live in `comp.sh` and `mask.py`. The glow centres live in `bg.py`.

### White-background cut

`comp-white.sh` and `bg_white.py` make the same two cuts on a near-white cloth backdrop (`#fdfcf8`). They use a tighter matte threshold and warmer highlights, and drop the vignette. The white dresses blend into the background there, which hides the matte edges.
