#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PACK="$ROOT/work/packaging"
APP_SOURCE="$ROOT/work/app"
NAME="${PLAYER_NAME:-间奏}"
BUNDLE_ID="${PLAYER_BUNDLE_ID:-com.jianzou.player}"
ELECTRON_APP="$PACK/node_modules/electron/dist/Electron.app"
BUILD="$(mktemp -d /tmp/jianzou-package.XXXXXX)"
trap 'rm -rf "$BUILD"' EXIT
OUTPUT="$ROOT/outputs/$NAME.dmg"
if [ ! -d "$ELECTRON_APP" ]; then
  npm install --prefix "$PACK" --no-save --no-audit --no-fund electron@40.6.1
  node "$PACK/node_modules/electron/install.js"
fi
if [ ! -f "$APP_SOURCE/package.json" ]; then
  echo "Missing $APP_SOURCE/package.json" >&2
  exit 1
fi
rm -rf "$BUILD"
mkdir -p "$BUILD/dmg" "$BUILD/icon.iconset" "$ROOT/outputs"
swift "$PACK/make-icon.swift" "$BUILD/icon-1024.png"
for n in 16 32 128 256 512; do
  sips -z "$n" "$n" "$BUILD/icon-1024.png" --out "$BUILD/icon.iconset/icon_${n}x${n}.png" >/dev/null
  n2=$((n * 2))
  sips -z "$n2" "$n2" "$BUILD/icon-1024.png" --out "$BUILD/icon.iconset/icon_${n}x${n}@2x.png" >/dev/null
done
iconutil -c icns "$BUILD/icon.iconset" -o "$BUILD/icon.icns"
ditto "$ELECTRON_APP" "$BUILD/dmg/$NAME.app"
APP="$BUILD/dmg/$NAME.app"
rm -f "$APP/Contents/Resources/default_app.asar"
mkdir -p "$APP/Contents/Resources/app"
ditto "$APP_SOURCE" "$APP/Contents/Resources/app"
# The browser bundle is self-contained; build dependencies are not runtime assets.
rm -rf "$APP/Contents/Resources/app/node_modules"
cp "$BUILD/icon.icns" "$APP/Contents/Resources/electron.icns"
PLIST="$APP/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleName $NAME" "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName $NAME" "$PLIST" || /usr/libexec/PlistBuddy -c "Add :CFBundleDisplayName string $NAME" "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier $BUNDLE_ID" "$PLIST"
/usr/libexec/PlistBuddy -c "Add :NSAppleEventsUsageDescription string 间奏需要访问 Spotify 和音乐，以显示当前歌曲并控制播放。" "$PLIST"
xattr -cr "$APP"
codesign --force --deep --sign - --options runtime --entitlements "$PACK/entitlements.plist" "$APP"
codesign --verify --deep --strict "$APP"
ditto --norsrc -c -k --keepParent "$APP" "$BUILD/dmg/$NAME.zip"
rm -rf "$APP"
printf '安装：\n1. 将“%s.zip”拖到下载文件夹。\n2. 双击解压，然后将“%s.app”拖到“应用程序”。\n3. 首次打开如遇系统提示，请在系统设置的“隐私与安全性”中允许打开。\n' "$NAME" "$NAME" > "$BUILD/dmg/安装说明.txt"
rm -f "$OUTPUT"
hdiutil makehybrid -hfs -hfs-volume-name "$NAME" -o "$BUILD/image" "$BUILD/dmg"
hdiutil convert "$BUILD/image.dmg" -format UDZO -o "$OUTPUT"
echo "Created $OUTPUT"
