pushd "$(dirname "$0")"
# Create dist
npm run build

# Remove the previous build
GLOBIGNORE=**/.git:**/LICENSE
rm -rf kataru-dev.github.io/**
unset GLOBIGNORE

# Copy dst
cp -r dist/** kataru-dev.github.io
pushd kataru-dev.github.io
git add .
git commit -am "Auto commit from publish.sh"
git push
popd
popd
