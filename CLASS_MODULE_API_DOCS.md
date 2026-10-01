# Class Module & S3 Upload API Documentation

This covers the endpoints the merchant class editor and the mentor class manager use: file upload, class creation and settings, syllabus (chapters, videos, resources), meetings and attendance, assignments and grading, certificates, tutors, and students. It matches the current API; Swagger (`/api`) has the full request and response schemas.

## Conventions

- **Auth:** every endpoint here needs `Authorization: Bearer <token>`.
- **Response envelope:** JSON responses are `{ "data": …, "responseMessage": "…" }`. Lists add `"meta": { "total", "page", "limit" }` and accept `?page=` (≥ 1) and `?limit=` (1–100). The upload endpoints in section 1 answer with raw JSON (no envelope).
- **Errors:** `{ "responseMessage": ["…"], "error": "BAD_REQUEST", "statusCode": 400 }`.
- **Ids:** every path id is a UUID; any other value answers 400.
- **Who may call:**
  - The owner of the class's merchant has full access.
  - An assigned tutor may use an endpoint when their permission matrix allows it (section 3.9).
  - Anyone else gets 404, as if the class did not exist.
  - A tutor without the needed permission gets 403.

---

## 1. File upload (S3 multipart) and registration

Every file goes through the same three upload steps and is then **registered** for its purpose. Registration checks the type and size, and returns the `asset_id` that the class endpoints accept. Paid material (class resources, assignment files, certificates) is stored privately, and learners only ever receive a signed link valid for 10 minutes.

### 1.1 Initiate upload
- **Endpoint:** `POST /api/v1/upload/initiate`
- **Body:**
```json
{ "fileName": "Modul 1 - Denah.pdf", "contentType": "application/pdf" }
```
- **Response (201):**
```json
{ "uploadId": "aws_multipart_upload_id_xyz", "key": "uploads/<yourUserId>/1790900000000-Modul_1_-_Denah.pdf" }
```
The key always sits under the uploader's own `uploads/<userId>/` prefix.

### 1.2 Get presigned part URLs
- **Endpoint:** `POST /api/v1/upload/presigned-urls`
- **Body:** `{ "uploadId": "…", "key": "…", "partsCount": 3 }` (`partsCount` 1–10000, parts of 5 MiB)
- **Response (201):** `[{ "partNumber": 1, "url": "https://…" }, …]`, where each URL expires after one hour.
- `PUT` each chunk to its URL, and keep the `ETag` response header of each part.
- The key must be your own: another user's key answers **403**.

### 1.3 Complete upload
- **Endpoint:** `POST /api/v1/upload/complete`
- **Body:**
```json
{
  "uploadId": "…",
  "key": "uploads/<yourUserId>/1790900000000-Modul_1_-_Denah.pdf",
  "parts": [ { "PartNumber": 1, "ETag": "\"etag_1\"" }, { "PartNumber": 2, "ETag": "\"etag_2\"" } ]
}
```
- **Response (201):** `{ "key": "…", "location": "https://…", "bucket": "…" }`. Another user's key answers **403**.

### 1.4 Register the uploaded file
- **Endpoint:** `POST /file-assets/v1/register-upload`
- **Body:** `{ "key": "uploads/<yourUserId>/…", "purpose": "class_resource" }`
- **Response (201):** `data.id` is the **`asset_id`** to send to the class endpoints. Registering the same key again returns the same asset.
- **Purposes used by classes:**

| Purpose | Accepted files | Max size | Visibility |
|---|---|---|---|
| `class_cover` | png, jpeg, webp | 4 MiB | public |
| `class_resource` | pdf, doc, docx, txt, epub, zip, rar, png, jpg, jpeg, webp, dwg, dxf, skp | 100 MiB | private |
| `assignment_resource` | same as `class_resource` | 100 MiB | private |
| `submission_file` (learners) | pdf, dwg, zip | 20 MiB | private |
| `certificate_file` | pdf, png, jpg | 10 MiB | private |

- **Errors:**
  - a wrong type, size or key format answers 400;
  - another user's key answers 403;
  - a key already registered by someone else answers 409.

---

## 2. Merchant classes

### 2.1 Create class
- **Endpoint:** `POST /merchants/v1/:merchantId/classes` (owner of the merchant only)
- **Body** (only `title` is required):
```json
{
  "title": "Belajar AutoCAD dari Nol",
  "description": "Kelas komprehensif AutoCAD",
  "type": "video",
  "status": "draft",
  "originalPrice": 399000,
  "discountedPrice": 299000,
  "cover_asset_id": "uuid (purpose class_cover)",
  "post_purchase_instructions": "Instruksi setelah pembelian",
  "category": "Sipil",
  "level": "Pemula",
  "duration": "8 minggu",
  "prerequisites": "Laptop\nDasar menggambar teknik",
  "learning_outcomes": ["Membuat denah 2D", "Mencetak gambar kerja"]
}
```
- **Values:**
  - `type`: `video` or `live-bootcamp` (lowercase).
  - `status`: `draft`, `published` or `archived`. Archived means unlisted: hidden from lists, still open and purchasable by link.
  - `originalPrice` is the strikethrough price. When `discountedPrice` is above 0 it is the selling price, and it must not exceed `originalPrice`.
  - `category` (Bidang): `Coding`, `Elektro`, `Mesin`, `Desain`, `Sipil` or `Kimia`.
  - `level`: `Pemula`, `Menengah` or `Mahir`.
  - Other limits: `duration` up to 60 characters; `prerequisites` up to 2000 characters (the catalog shows each line as a requirement); `learning_outcomes` up to 20 items of 1–200 characters.
- **Response (201):** the class. It includes `cover_url` and every field above (`learning_outcomes` is `[]` when empty).

### 2.2 List classes
- **Endpoint:** `GET /merchants/v1/:merchantId/classes?page=1&limit=10&status=published&type=video`
- **Response:** `{ "data": [class, …], "meta": { "total", "page", "limit" } }`, newest first.

### 2.3 Class detail and update
- `GET /api/v1/classes/:classId` returns the class.
- `PATCH /api/v1/classes/:classId` changes only the fields sent (same fields as create).
  - `null` clears `description`, `discountedPrice`, `cover_asset_id`, `post_purchase_instructions`, `category`, `level`, `duration`, `prerequisites` and `learning_outcomes`.
  - A lead tutor may change only the presentation fields (title, description, cover, instructions, Bidang, level, duration, prerequisites, outcomes). Pricing, type and status stay with the owner.

### 2.4 Duplicate class ("Duplikat Kelas")
- `POST /api/v1/classes/:classId/duplicate` with `{ "type": "video" | "live-bootcamp" }`. Owner only: tutors get 403, anyone else 404.
- The new class is a **draft** named "{title} (Salinan)", of the chosen type.
  - Copied: details, cover, prices, chapters, videos, resources (files are shared), assignments and quizzes, certificate settings, and FAQ.
  - Not copied: learners, reviews, discussions, submissions, grades, certificates, tutors, and meetings.

---

## 3. Class content and management

### 3.1 Chapters (Bab)
- `POST /api/v1/classes/:classId/chapters` with `{ "title": "BAB 1: Pengenalan", "description": "…", "order": 1 }`. `order` is optional; by default the chapter goes after the last one.
- `GET /api/v1/classes/:classId/chapters` returns chapters, each with its `videos` and `resources`.
- `PATCH /api/v1/classes/:classId/chapters/:chapterId` with `{ "title"?, "description"? }`.
- `DELETE /api/v1/classes/:classId/chapters/:chapterId` also removes the chapter's videos and resources.
- `PUT /api/v1/classes/:classId/chapters/:chapterId/order` with `{ "video_ids": [...], "resource_ids": [...] }` gives the full new order of the chapter's videos and resources.

### 3.2 Videos
Videos are **YouTube or embed links**; video files are not accepted.
- `POST /api/v1/classes/:classId/chapters/:chapterId/videos` with:
```json
{ "title": "Pengenalan Layer", "description": "…", "youtubeUrl": "https://www.youtube.com/watch?v=…", "duration": "12:30" }
```
- `PATCH …/videos/:videoId` with `{ "title"?, "description"?, "youtubeUrl"?, "duration"? }`.
- `DELETE …/videos/:videoId`.

### 3.3 Resources (files and links)
- **Endpoint:** `POST /api/v1/classes/:classId/chapters/:chapterId/resources` (1–20 per request)
- **Body:**
```json
{
  "resources": [
    { "type": "pdf", "name": "Modul 1.pdf", "description": "Materi pembuka", "asset_id": "uuid from 1.4 (purpose class_resource)" },
    { "type": "archive", "name": "Latihan.zip", "asset_id": "uuid" },
    { "type": "link", "name": "Referensi Autodesk", "url": "https://help.autodesk.com/…" }
  ]
}
```
- `type` is `pdf`, `archive`, `image`, `file` or `link`.
  - An uploaded file must send `asset_id` (upload with section 1, then register with purpose `class_resource`).
  - `url` is only for `link`, and must be https.
  - A file URL instead of an `asset_id` answers 400. So does type `video` (use 3.2) or `zip` (use `archive`).
- Owners and tutors see private files as short-lived `download_url`s; learners get the same through the learning pages.
- `PATCH …/resources/:resourceId` with `{ "name"?, "description"?, "url"? }` (`url` only for links).
- `DELETE …/resources/:resourceId`.

### 3.4 Meetings (live sessions)
Only live bootcamps (`type: "live-bootcamp"`) have meetings. Hide the Meeting and Absensi tabs for video classes.
- `POST /api/v1/classes/:classId/meetings` with:
```json
{ "title": "Sesi Q&A 1", "content": "Sesi tanya jawab live", "date": "2026-10-12", "time": "19:00", "liveUrl": "https://zoom.us/j/123456", "duration_minutes": 90, "mentor_id": "<mentor id>" }
```
  - `date` is `YYYY-MM-DD` and `time` is `HH:mm`, both in Asia/Jakarta.
  - `duration_minutes` (Durasi, 1–1440) and `mentor_id` are optional. The mentor must be an active tutor of the class (the `mentor_id` from `GET /api/v1/classes/:classId/mentors`); otherwise the response is 400.
  - A meeting on a video class is 400. A live bootcamp that has meetings cannot be changed to `video` (400).
- `GET /api/v1/classes/:classId/meetings` and `PATCH /api/v1/classes/:classId/meetings/:meetingId`. In the update, `null` clears `content`, `liveUrl`, `duration_minutes` and `mentor_id`.
- `DELETE /api/v1/classes/:classId/meetings/:meetingId` (204) needs `meeting.delete`. The meeting disappears everywhere, its attendance stops counting, and learners who now qualify get their automatic certificate. A bootcamp whose meetings are all deleted can be changed to `video`.
- Every meeting response includes `duration_minutes` and `mentor` (`{ id, name }` or null). `time` is always `HH:mm`, so it can be sent back unchanged.
- **Status:** a meeting is "started" from its date and time. `status` is `upcoming` until the start plus its duration has passed (180 minutes when no duration is set), then `completed`. The same rule applies on the class editor, the public bootcamp page, the learner pages and the attendance page.
- **Attendance:**
  - `GET /api/v1/classes/:classId/attendance-summary` returns the totals per class.
  - `GET /api/v1/classes/:classId/meetings/:meetingId/attendances` returns every enrolled learner with status `hadir`, `izin` or `alpa`, the check-in time and notes.
  - `PATCH /api/v1/classes/:classId/meetings/:meetingId/attendances/:userId` sets the status with `{ "status": "hadir" }`.
- **Learner check-in** (for the attendance link):
  - signed in: `POST /learning/v1/check-in/:meetingId`;
  - public page `/absensi/{classId}`: `GET /learning/v1/get-attendance-session/:classId`, then `POST /learning/v1/check-in-by-email/:classId` with `{ name, email, feedback? }`.

### 3.5 Assignments (Tugas) and quizzes
- `POST /api/v1/classes/:classId/assignments` with:
```json
{
  "title": "Quiz Dasar",
  "description": "Uji pemahaman dasar.",
  "due": "2026-10-20T23:59:00+07:00",
  "type": "quiz",
  "questions": [
    { "question_text": "Apa itu Layer?", "type": "multiple_choice", "options": ["A", "B", "C", "D"], "correct_answer": "A", "score_weight": 50 },
    { "question_text": "Jelaskan fungsi xref.", "type": "essay", "correct_answer": "Kunci jawaban (opsional)", "score_weight": 50 }
  ]
}
```
  - `type` is `file_upload` or `quiz`.
  - `due` needs a timezone offset and must be in the future.
  - A quiz needs at least one question.
  - A multiple-choice question needs 2–4 options, and `correct_answer` must be one of them.
  - A file assignment may attach a template file: `resource_asset_id` (purpose `assignment_resource`).
- `GET /api/v1/classes/:classId/assignments` lists them with submission counts.
- `DELETE /api/v1/classes/:classId/assignments/:assignmentId`.
- `GET /api/v1/classes/:classId/assignments/:assignmentId/submissions` returns learners' submissions, with signed file links and essay answers.
- `PATCH /api/v1/classes/:classId/submissions/:submissionId/grade`:
  - file assignments: `{ "score": 85, "feedback": "…" }`, score 0–100;
  - quizzes: `{ "essay_scores": [{ "question_id": "uuid", "score": 40 }], "feedback": "…" }`. Multiple-choice questions are scored automatically.
  - `feedback` is optional.
- `GET /api/v1/classes/:classId/grades` returns the grade table: each learner's scores and average.

### 3.6 Certificates
- `GET` / `PATCH /api/v1/classes/:classId/certificate-settings` with `{ "auto_issue": true, "min_attendance_percent": 80, "min_score": 75 }`. The defaults are shown.
- **Eligibility:** all three must hold:
  - progress is 100%;
  - attendance is at least the minimum (only if the class has started meetings);
  - the average score is at least the minimum (only if something was graded).
- `GET /api/v1/classes/:classId/certificates` lists each learner with status `issued`, `pending` or `ineligible`, the number (`PP-CERT-YYYY-NNNN`), the issue date and the file.
- `POST /api/v1/classes/:classId/certificates/:userId/issue` issues manually ("Terbitkan").
- `PUT /api/v1/classes/:classId/certificates/:userId/file` attaches a PDF or image with `{ "asset_id": "uuid (purpose certificate_file)" }`.
- `DELETE /api/v1/classes/:classId/certificates/:userId` withdraws a certificate; its number is never reused.

### 3.7 Discussions
- `GET /discussions/v1/get-threads/:classId`
- `POST /discussions/v1/create-thread`
- `POST /discussions/v1/create-comment`

The class owner, its tutors and its enrolled learners may use these; learners can reply but not start threads.

### 3.8 Students
- `GET /api/v1/classes/:classId/students` returns enrolled learners: enrolment `id`, `user_id`, `joinDate`, `progress`, and `user { id, name, email }`. It never includes password data. Certificate status per learner is in section 3.6.

### 3.9 Tutors (mentor roster of the class)
- `POST /api/v1/classes/:classId/mentors` with:
```json
{
  "email": "tutor@pintarpintar.id",
  "role": "assistant",
  "permissions": {
    "nilai": { "lihat": true, "tambah": true, "edit": true, "delete": true },
    "materi": { "lihat": true }
  }
}
```
  - The email must belong to a registered mentor.
  - `role` is `lead` (Lead Tutor), `assistant` (Asisten Tutor) or `moderator` (Moderator Live Session).
- `permissions` is optional; each role has defaults:
  - `lead`: everything;
  - `assistant`: materi and tugas `lihat`, nilai everything;
  - `moderator`: materi `lihat`, meeting everything.

  Areas are `materi`, `meeting`, `tugas`, `nilai` and `sertifikat`; actions are `lihat`, `tambah`, `edit` and `delete`. Anything left out is `false`.
- `GET /api/v1/classes/:classId/mentors`.
- `PATCH /api/v1/classes/:classId/mentors/:classMentorId` with `{ "role"?, "permissions"? }`.
- `DELETE /api/v1/classes/:classId/mentors/:classMentorId` revokes the tutor.

### 3.10 FAQ ("Kelola FAQ")
- `GET /api/v1/classes/:classId/faqs` lists the entries in the order they were added.
- `POST /api/v1/classes/:classId/faqs` with `{ "question", "answer" }` (question up to 300 characters, answer up to 3000; at most 50 entries per class).
- `PATCH /api/v1/classes/:classId/faqs/:faqId` with `{ "question"?, "answer"? }`, and `DELETE /api/v1/classes/:classId/faqs/:faqId` (204).
- Permissions follow the `materi` area (`lihat`, `tambah`, `edit`, `delete`).
- The public class detail (`GET /catalog/v1/get-class/:id`) and the learner view (`GET /learning/v1/get-class/:id`) include `faqs`.

