# A-1 Drain Cleaning Field App

Permanent native Android application repository for A-1 Drain Cleaning.

Business details: A-1 Drain Cleaning, 206 29th St SW, Mason City, Iowa 50401, 641-530-2728.

## Native Android foundation
- Kotlin Android Studio-compatible Gradle project.
- Existing floating scratchpad drawing canvas and overlay service preserved from `android-scratchpad`.
- Local SQLite storage supports creating, editing, listing, and searching job records without cellular service.
- AndroidX enabled in `gradle.properties`.
- GitHub Actions workflow builds and uploads a debug APK on pushes to `main` and manual dispatch.

## Build
Requires JDK 17 and Android SDK 35. Run `gradle assembleDebug`. APK output: `app/build/outputs/apk/debug/app-debug.apk`.

## Migration status
The original PWA source and Supabase SQL are intentionally retained as migration references. Do not delete them or run destructive database changes. The current native foundation is not yet feature-complete: Supabase authentication and idempotent cloud synchronization, photo capture/upload, signature capture, PDF export, and attaching scratchpad drawings to jobs still require implementation and verification. The scratchpad's current Save action writes to Pictures/Scratchpad.

Never embed a Supabase service-role key or database password in the APK. Use authenticated user access, the public anon key, and Row Level Security.
