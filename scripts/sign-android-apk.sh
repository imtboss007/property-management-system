#!/usr/bin/env bash
set -euo pipefail

# Re-sign a CI-built APK using Android's official zipalign + apksigner tools.
# The APK is aligned first; apksigner then adds v1/v2 signatures without rewriting
# ZIP entry payloads. Never substitute jarsigner for Android APK signing.
#
# Usage:
#   ANDROID_KEYSTORE_PASSWORD='...' ./scripts/sign-android-apk.sh input.apk key.p12 output.apk

INPUT_APK="${1:-}"
KEYSTORE="${2:-}"
OUTPUT_APK="${3:-AXIVESTRA-Android.apk}"
KEY_ALIAS="${ANDROID_KEY_ALIAS:-axivestra-release}"
STORE_PASSWORD="${ANDROID_KEYSTORE_PASSWORD:-}"
KEY_PASSWORD="${ANDROID_KEY_PASSWORD:-$STORE_PASSWORD}"
SDK_ROOT="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"

if [[ -z "$INPUT_APK" || -z "$KEYSTORE" || -z "$STORE_PASSWORD" ]]; then
  echo "Usage: ANDROID_KEYSTORE_PASSWORD=... $0 input.apk keystore.p12 [output.apk]" >&2
  exit 2
fi
[[ -s "$INPUT_APK" ]] || { echo "Input APK not found or empty." >&2; exit 2; }
[[ -s "$KEYSTORE" ]] || { echo "PKCS#12 keystore not found or empty." >&2; exit 2; }
[[ -n "$SDK_ROOT" && -d "$SDK_ROOT/build-tools" ]] || {
  echo "Android SDK Build Tools not found. Set ANDROID_SDK_ROOT or ANDROID_HOME." >&2
  exit 2
}
command -v python3 >/dev/null || { echo "Python 3 is required." >&2; exit 2; }

BUILD_TOOLS_DIR="${ANDROID_BUILD_TOOLS_DIR:-}"
if [[ -z "$BUILD_TOOLS_DIR" ]]; then
  BUILD_TOOLS_DIR="$(find "$SDK_ROOT/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -n 1)"
fi
ZIPALIGN="$BUILD_TOOLS_DIR/zipalign"
APKSIGNER="$BUILD_TOOLS_DIR/apksigner"
[[ -x "$ZIPALIGN" ]] || { echo "zipalign not found in $BUILD_TOOLS_DIR." >&2; exit 2; }
[[ -x "$APKSIGNER" ]] || { echo "apksigner not found in $BUILD_TOOLS_DIR." >&2; exit 2; }

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT
CLEAN_APK="$WORK_DIR/unsigned-clean.apk"
ALIGNED_APK="$WORK_DIR/aligned.apk"

python3 - "$INPUT_APK" "$CLEAN_APK" <<'PY'
import sys
import zipfile

source, target = sys.argv[1:3]
with zipfile.ZipFile(source, "r") as original, zipfile.ZipFile(target, "w") as clean:
    for entry in original.infolist():
        name = entry.filename.upper()
        if name.startswith("META-INF/") and (
            name.endswith((".SF", ".RSA", ".DSA", ".EC"))
            or name == "META-INF/MANIFEST.MF"
        ):
            continue
        clean.writestr(entry, original.read(entry.filename))
PY

# APK signing order is strict: align before adding signatures.
"$ZIPALIGN" -f -v 4 "$CLEAN_APK" "$ALIGNED_APK"

export ANDROID_KEYSTORE_PASSWORD="$STORE_PASSWORD"
export ANDROID_KEY_PASSWORD="$KEY_PASSWORD"
"$APKSIGNER" sign \
  --ks "$KEYSTORE" \
  --ks-type PKCS12 \
  --ks-key-alias "$KEY_ALIAS" \
  --ks-pass env:ANDROID_KEYSTORE_PASSWORD \
  --key-pass env:ANDROID_KEY_PASSWORD \
  --v1-signing-enabled true \
  --v2-signing-enabled true \
  --out "$OUTPUT_APK" \
  "$ALIGNED_APK"

"$ZIPALIGN" -c -v 4 "$OUTPUT_APK"
"$APKSIGNER" verify --verbose --print-certs "$OUTPUT_APK"

echo "Android-signed APK created: $OUTPUT_APK"
sha256sum "$OUTPUT_APK"
