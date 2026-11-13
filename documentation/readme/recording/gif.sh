# gif.sh <name> [width] -> /tmp/iskios-demo/out/<name>.gif
n=$1; w=${2:-1280}; mkdir -p /tmp/iskios-demo/out
ffmpeg -loglevel error -y -f concat -safe 0 -i /tmp/iskios-demo/frames/$n/list.txt \
 -vf "fps=12,scale=$w:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle" \
 /tmp/iskios-demo/out/$n.gif && ls -la /tmp/iskios-demo/out/$n.gif
