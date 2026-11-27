# Feature Preservation Checklist

## Existing primary PWA retained as migration source
- [x] Supabase email/password authentication code
- [x] Jobs table schema and user-scoped RLS policies
- [x] Private `job-photos` bucket policies
- [x] IndexedDB offline job/file queues
- [x] Customer/job fields, authorization, signature data, timestamps/timezone
- [x] Invoice and job photo upload logic
- [x] Browser PDF report generation
- [x] PWA shell and service worker
- [ ] Native equivalents fully implemented and verified

## Existing Android scratchpad copied into primary repository
- [x] Floating overlay service and movable bubble
- [x] Drawing canvas and stroke undo
- [x] Clear and gallery save
- [ ] Attach drawing to a selected job
- [ ] Physical-device overlay and foreground-service testing

## Native application
- [x] Kotlin / Android / Gradle project foundation
- [x] AndroidX configuration
- [x] Local SQLite create/edit/list/search job foundation
- [x] Primary repository debug APK workflow
- [ ] Supabase Auth and authenticated REST client
- [ ] Idempotent sync queue, retries, and conflict handling
- [ ] Private photo capture and cloud storage
- [ ] Signature capture and durable local storage
- [ ] PDF generation and sharing
- [ ] Automated unit and instrumentation tests
- [ ] Physical-device offline/online and overlay tests

## Safety
- [x] Existing PWA and SQL retained; no destructive migration executed
- [x] No service-role key or database password committed
