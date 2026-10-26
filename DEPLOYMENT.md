# Repository setup and download instructions

## Expected GitHub setup

Use a dedicated repository named `property-management-system`. The source code in this folder is intended for that repository, not for an unrelated project repository.

## GitHub UI upload (without local command line)

1. Open the dedicated repository on GitHub.
2. Choose **Add file → Upload files**.
3. Upload the extracted project files and folders, keeping the folder paths intact.
4. Commit to `main`.
5. Open **Actions** and watch **EstateFlow PC and Android builds**.
6. After the workflow succeeds, open **Releases** to download the `.exe` and `.apk`.

GitHub Actions must be enabled, and the repository's Actions workflow permissions must permit creating releases (`Settings → Actions → General → Workflow permissions → Read and write permissions`).

## Why no APK/EXE is pre-attached here

The native Windows installer is built on a Windows runner and the Android APK on an Android/Java-enabled Linux runner. The included GitHub Actions workflow performs those platform builds. The checked-in source archive itself is not a Windows installer or Android APK.
