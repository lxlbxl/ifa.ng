#!/bin/bash
# Rebuild the homepage hero chant video from the raw phone clip.
# usage: scripts/hero-video/build.sh path/to/chant.mp4 [workdir]
# Needs ffmpeg, python3 with numpy, pillow and onnxruntime, and internet once
# (downloads the RobustVideoMatting model). Writes into public/hero/.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../.." && pwd)"
export SRC="$(realpath "$1")"; WORK="${2:-$(mktemp -d)}"; mkdir -p "$WORK"; cd "$WORK"
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$SRC" | cut -d. -f1).$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$SRC" | cut -d. -f2 | cut -c1)

# 1. Person matte (keeps every singer, drops the wall and burnt-in caption)
[ -f rvm.onnx ] || curl -sSL -o rvm.onnx https://github.com/PeterL1n/RobustVideoMatting/releases/download/v1.0.0/rvm_mobilenetv3_fp32.onnx
[ -f matte.mp4 ] || python3 -I "$HERE/matte.py" "$SRC" matte.mp4 rvm.onnx

# 2. Backdrop (ink + camwood/sun glow + haze) and edge masks
python3 -I "$HERE/bg.py"; python3 -I "$HERE/mask.py"

# 3. Audio: clean and warm the voice, hall reverb, quiet F# drone pad
ffmpeg -v error -y -f lavfi -i "anoisesrc=d=3.6:c=pink:r=44100:a=0.5:seed=7" -f lavfi -i "anoisesrc=d=3.6:c=pink:r=44100:a=0.5:seed=11" \
  -filter_complex "[0][1]amerge=inputs=2,volume='exp(-t*1.9)':eval=frame,lowpass=f=5200,highpass=f=180,afade=t=in:d=0.012[o]" -map "[o]" ir.wav
ffmpeg -v error -y -i "$SRC" -vn -af "highpass=f=85,afftdn=nr=10:nf=-42,equalizer=f=220:t=q:w=1:g=2.5,equalizer=f=3200:t=q:w=1.2:g=-1.5,equalizer=f=1800:t=q:w=1:g=1,highshelf=f=9000:g=-3,acompressor=threshold=0.12:ratio=2.5:attack=15:release=250:makeup=1.4,aresample=44100" -ac 2 voice.wav
ffmpeg -v error -y -i voice.wav -i ir.wav -filter_complex "[0][1]afir=dry=1:wet=1:length=1[w]" -map "[w]" wetraw.wav
VM=$(ffmpeg -i voice.wav -af volumedetect -f null - 2>&1 | grep -oE "mean_volume: [-0-9.]+" | awk '{print $2}')
WM=$(ffmpeg -i wetraw.wav -af volumedetect -f null - 2>&1 | grep -oE "mean_volume: [-0-9.]+" | awk '{print $2}')
G=$(echo "$VM - ($WM) - 8" | bc)   # reverb sits 8 dB under the dry voice
ffmpeg -v error -y -f lavfi -i "aevalsrc='0.30*sin(2*PI*91.7*t)*(0.75+0.25*sin(2*PI*0.07*t))+0.20*sin(2*PI*137.4*t)*(0.7+0.3*sin(2*PI*0.05*t+1))+0.14*sin(2*PI*183.4*t+0.3*sin(2*PI*0.2*t))*(0.6+0.4*sin(2*PI*0.04*t+2))+0.06*sin(2*PI*274.8*t)*(0.5+0.5*sin(2*PI*0.09*t))|0.30*sin(2*PI*91.9*t)*(0.75+0.25*sin(2*PI*0.06*t+0.5))+0.20*sin(2*PI*137.6*t)*(0.7+0.3*sin(2*PI*0.05*t+2))+0.14*sin(2*PI*183.2*t+0.3*sin(2*PI*0.21*t))*(0.6+0.4*sin(2*PI*0.04*t))+0.06*sin(2*PI*275.1*t)*(0.5+0.5*sin(2*PI*0.08*t+1))':s=44100:d=$D" \
  -f lavfi -i "anoisesrc=c=brown:r=44100:a=0.05:d=$D" \
  -filter_complex "[1]bandpass=f=600:w=400,volume='0.6+0.4*sin(2*PI*0.03*t)':eval=frame,pan=stereo|c0=c0|c1=c0[wind];[0][wind]amix=inputs=2:weights='1 0.5':normalize=0,lowpass=f=1400,aecho=0.8:0.7:180|260:0.3|0.25[o]" -map "[o]" pad.wav
OUTFADE=$(echo "$D - 2.5" | bc)
ffmpeg -v error -y -i voice.wav -i wetraw.wav -i pad.wav -filter_complex "[1]adelay=35|55,volume=${G}dB,equalizer=f=250:t=q:w=1:g=-3[w];[2]volume=-15dB[p];[0][w][p]amix=inputs=3:normalize=0:duration=first,alimiter=limit=0.89:level=false,afade=t=in:d=1.2,afade=t=out:st=$OUTFADE:d=2.5,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[o]" -map "[o]" mix.wav

# 4. Composite masters, then web encodes and posters
export VFADE=$(echo "$D - 0.9" | bc)
bash "$HERE/comp.sh" desk m_desk.mp4 & bash "$HERE/comp.sh" mob m_mob.mp4 & wait
OUT="$ROOT/public/hero"; mkdir -p "$OUT"
for v in desktop mobile; do
  M=m_$([ $v = desktop ] && echo desk || echo mob).mp4
  S=$([ $v = desktop ] && echo "scale=1600:900:flags=lanczos" || echo "scale=720:1280")
  ffmpeg -v error -y -i $M -vf "$S,hqdn3d=2:2:5:5" -c:v libx264 -preset slow -crf 29 -profile:v high -pix_fmt yuv420p -g 60 -movflags +faststart -c:a aac -b:a 96k -ac 2 "$OUT/hero-chant-$v.mp4"
  ffmpeg -v error -y -i $M -vf "$S" -c:v libvpx-vp9 -crf 38 -b:v 0 -row-mt 1 -deadline good -cpu-used 3 -g 120 -c:a libopus -b:a 80k "$OUT/hero-chant-$v.webm"
  ffmpeg -v error -y -ss 20 -i "$OUT/hero-chant-$v.mp4" -frames:v 1 -q:v 4 "$OUT/hero-chant-$v-poster.jpg"
done
ls -la "$OUT"
