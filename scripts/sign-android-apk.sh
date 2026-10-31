#!/usr/bin/env bash
set -euo pipefail

# Re-sign a CI-built Android debug APK with AXIVESTRA's persistent PKCS#12 key.
# This creates a v1-signed sideloadable APK. Never distribute the CI debug APK itself.
# Usage:
#   ANDROID_KEYSTORE_PASSWORD='...' ./scripts/sign-android-apk.sh input.apk key.p12 output.apk

INPUT_APK="${1:-}"
KEYSTORE="${2:-}"
OUTPUT_APK="${3:-AXIVESTRA-Android.apk}"
KEY_ALIAS="${ANDROID_KEY_ALIAS:-axivestra-release}"
KEY_PASSWORD="${ANDROID_KEY_PASSWORD:-${ANDROID_KEYSTORE_PASSWORD:-}}"

if [[ -z "$INPUT_APK" || -z "$KEYSTORE" || -z "$KEY_PASSWORD" ]]; then
  echo "Usage: ANDROID_KEYSTORE_PASSWORD=... $0 input.apk keystore.p12 [output.apk]" >&2
  exit 2
fi
[[ -s "$INPUT_APK" ]] || { echo "Input APK not found or empty." >&2; exit 2; }
[[ -s "$KEYSTORE" ]] || { echo "PKCS#12 keystore not found or empty." >&2; exit 2; }
command -v python3 >/dev/null || { echo "Python 3 is required." >&2; exit 2; }
command -v jarsigner >/dev/null || { echo "JDK jarsigner is required." >&2; exit 2; }

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT
CLEAN_APK="$WORK_DIR/unsigned-clean.apk"

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

jarsigner \
  -keystore "$KEYSTORE" \
  -storetype PKCS12 \
  -storepass:env ANDROID_KEYSTORE_PASSWORD \
  -keypass "$KEY_PASSWORD" \
  -sigalg SHA256withRSA \
  -digestalg SHA-256 \
  -signedjar "$OUTPUT_APK" \
  "$CLEAN_APK" "$KEY_ALIAS"

jarsigner -verify "$OUTPUT_APK" >/dev/null
echo "Signed APK created: $OUTPUT_APK"
sha256sum "$OUTPUT_APK"
