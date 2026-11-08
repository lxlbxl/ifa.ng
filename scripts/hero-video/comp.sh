#!/bin/bash
# usage: SRC=chant.mp4 comp.sh desk|mob out.mp4 [input args, e.g. -ss 18 -t 4]  (run inside the work dir)
set -e
V="$SRC"
M=$1; OUT=$2; shift 2
GRADE="eq=contrast=1.07:saturation=1.1:gamma=0.97,colorbalance=rs=0.03:gs=0.0:bs=-0.04:rm=0.03:bm=-0.03:rh=0.02:bh=-0.02"
if [ $M = desk ]; then
  W=1920;H=1080;HW=3840
  FG="crop=720:900:0:380,scale=864:1080:flags=lanczos"; MCROP="crop=720:900:0:380,scale=864:1080:flags=lanczos"
  POS="x=1056:y=0"; HAZE="-960-420*sin(2*PI*t/62.8)"
else
  W=720;H=1280;HW=1440
  FG="scale=806:1434:flags=lanczos"; MCROP="scale=806:1434:flags=lanczos"
  POS="x=720-806:y=-170"; HAZE="-360-260*sin(2*PI*t/62.8)"
fi
ffmpeg -v error -y "$@" -i "$V" "$@" -i matte.mp4 -loop 1 -i bg_$M.png -loop 1 -i haze_$M.png -loop 1 -i mask_$M.png -i mix.wav -filter_complex "
[1]format=gray,lutyuv=y='clip((val-20)*1.12,0,255)'[mt0];
[4]format=gray[mk];[mt0][mk]blend=all_mode=multiply:shortest=1,$MCROP,boxblur=1:1[mt];
[0]$GRADE,$FG,format=yuva420p[fg0];[fg0][mt]alphamerge[fg];
[3]format=gray[hz];color=c=0xf3d9a8:s=${HW}x${H}[hc];
[hc][hz]alphamerge,colorchannelmixer=aa=0.22[haze];
[2]format=yuv420p[bg];[bg][haze]overlay=x='$HAZE':y=0:shortest=1[bgh];
[bgh][fg]overlay=$POS:shortest=1,vignette=angle=PI/4.5,fps=30,fade=t=in:d=0.7:color=0x121611,fade=t=out:st=${VFADE:-61.9}:d=0.8:color=0x121611,format=yuv420p[v]" -map "[v]" -map 5:a -shortest -c:v libx264 -crf 18 -preset fast -c:a aac -b:a 160k $OUT
