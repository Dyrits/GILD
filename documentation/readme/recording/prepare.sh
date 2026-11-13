# Copies this kit into /tmp/iskios-demo and builds the demo realm. Run from the repository root.
set -e
K=documentation/readme/recording; D=/tmp/iskios-demo
rm -rf $D && mkdir -p $D/scripts $D/scenes $D/zdot $D/shots $D/realm/storefront
cp $K/*.sh $K/*.py $D/scripts/ && cp $K/scenes/*.py $D/scenes/ && cp $K/demo.base.json $D/ && cp $K/zshrc $D/zdot/.zshrc
cp -R $K/storefront/. $D/realm/storefront/
(cd $D/realm/storefront && git init -q -b main && git add -A && git -c user.name=demo -c user.email=demo@example.com commit -qm "Checkout totals")
