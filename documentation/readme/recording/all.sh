cd /tmp/iskios-demo
bash scripts/reset.sh
for s in terminal sidequest handover backup mention iskios; do python3 scripts/rec.py scenes/$s.py $s || { echo "FAILED $s"; exit 1; }; bash scripts/gif.sh $s; done
