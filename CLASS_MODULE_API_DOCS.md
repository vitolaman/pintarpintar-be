# Class Module & S3 Upload API Documentation

This documentation provides the endpoints, request payloads, and expected responses for the newly implemented Class Module and S3 Resumable Upload features.

## 1. S3 Resumable Upload API

These endpoints handle the multipart upload flow directly to AWS S3.

### 1.1 Initiate Upload
Initializes the multipart upload and returns an Upload ID and S3 Key.
- **Endpoint**: `POST /api/v1/upload/initiate`
- **Auth**: Bearer Token required
- **Body**:
```json
{
  "fileName": "lesson-1-intro.mp4",
  "contentType": "video/mp4"
}
```
- **Response**:
```json
{
  "uploadId": "aws_multipart_upload_id_xyz",
  "key": "uploads/1690000000000-lesson-1-intro.mp4"
}
```

### 1.2 Get Presigned URLs
Generates secure S3 upload URLs for each file chunk.
- **Endpoint**: `POST /api/v1/upload/presigned-urls`
- **Auth**: Bearer Token required
- **Body**:
```json
{
  "uploadId": "aws_multipart_upload_id_xyz",
  "key": "uploads/1690000000000-lesson-1-intro.mp4",
  "partsCount": 5
}
```
- **Response**:
```json
[
  {
    "partNumber": 1,
    "url": "https://bucket.s3.region.amazonaws.com/...&partNumber=1..."
  },
  {
    "partNumber": 2,
    "url": "https://bucket.s3.region.amazonaws.com/...&partNumber=2..."
  }
]
```

### 1.3 Complete Upload
Tells S3 to assemble the uploaded chunks into the final file.
- **Endpoint**: `POST /api/v1/upload/complete`
- **Auth**: Bearer Token required
- **Body**:
*(Note: `ETag` is returned in the response headers by S3 when you PUT a chunk to the presigned URL).*
```json
{
  "uploadId": "aws_multipart_upload_id_xyz",
  "key": "uploads/1690000000000-lesson-1-intro.mp4",
  "parts": [
    { "PartNumber": 1, "ETag": "\"etag_value_1\"" },
    { "PartNumber": 2, "ETag": "\"etag_value_2\"" }
  ]
}
```
- **Response**:
```json
{
  "key": "uploads/1690000000000-lesson-1-intro.mp4",
  "location": "https://bucket.s3.region.amazonaws.com/uploads/...",
  "bucket": "bucket-name"
}
```

---

## 2. Merchant Class API (Dashboard Setup)

### 2.1 Create Class
Creates a base class instance for a merchant.
- **Endpoint**: `POST /merchants/v1/:merchantId/classes`
- **Auth**: Bearer Token required
- **Body**:
```json
{
  "title": "Belajar AutoCAD dari Nol",
  "description": "Kelas komprehensif AutoCAD",
  "status": "draft", // options: draft, published, archived
  "type": "video", // options: video, live-bootcamp
  "originalPrice": 399000,
  "discountedPrice": 299000
}
```

### 2.2 List Classes
Retrieves classes managed by a specific merchant.
- **Endpoint**: `GET /merchants/v1/:merchantId/classes`
- **Auth**: Bearer Token required
- **Query Params**:
  - `page` (default 1)
  - `limit` (default 10)
  - `status` (optional)
- **Response**:
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Belajar AutoCAD dari Nol",
      "status": "draft"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 10
  }
}
```

---

## 3. Class Module API (Syllabus & Management)

### 3.1 Get Class Detail
- **Endpoint**: `GET /api/v1/classes/:classId`
- **Auth**: Bearer Token required

### 3.2 Create Chapter (Bab)
- **Endpoint**: `POST /api/v1/classes/:classId/chapters`
- **Auth**: Bearer Token required
- **Body**:
```json
{
  "title": "BAB 1: Pengenalan Dasar",
  "description": "Materi pembuka",
  "order": 1
}
```

### 3.3 Get Chapters
- **Endpoint**: `GET /api/v1/classes/:classId/chapters`
- **Response**: Returns chapters including their `videos` and `resources` relations.

### 3.4 Save Uploaded Resources
Attach successfully uploaded S3 files to a specific chapter.
- **Endpoint**: `POST /api/v1/classes/:classId/chapters/:chapterId/resources`
- **Auth**: Bearer Token required
- **Body**:
```json
{
  "resources": [
    {
      "type": "video", // video, pdf, zip, link, image
      "name": "Materi-1.mp4",
      "url": "https://bucket.s3.../uploads/Materi-1.mp4"
    },
    {
      "type": "pdf",
      "name": "Cheatsheet.pdf",
      "url": "https://bucket.s3.../uploads/Cheatsheet.pdf"
    }
  ]
}
```

### 3.5 Create Assignment (Tugas/Quiz)
- **Endpoint**: `POST /api/v1/classes/:classId/assignments`
- **Auth**: Bearer Token required
- **Body**:
```json
{
  "title": "Quiz Dasar",
  "description": "Uji pemahaman dasar.",
  "due": "2025-10-20T23:59:59Z",
  "type": "quiz", // file_upload, quiz
  "questions": [
    {
      "question_text": "Apa itu Layer?",
      "type": "multiple_choice", // multiple_choice, essay
      "options": ["A", "B", "C"],
      "correct_answer": "A",
      "score_weight": 50
    }
  ]
}
```

### 3.6 Get Assignments
- **Endpoint**: `GET /api/v1/classes/:classId/assignments`

### 3.7 Schedule Live Meeting
- **Endpoint**: `POST /api/v1/classes/:classId/meetings`
- **Auth**: Bearer Token required
- **Body**:
```json
{
  "title": "Sesi Q&A 1",
  "content": "Sesi tanya jawab live",
  "date": "2025-10-12",
  "time": "19:00:00",
  "liveUrl": "https://zoom.us/j/123456"
}
```

### 3.8 Get Meetings
- **Endpoint**: `GET /api/v1/classes/:classId/meetings`

### 3.9 Invite Mentor
- **Endpoint**: `POST /api/v1/classes/:classId/mentors`
- **Auth**: Bearer Token required
- **Body**:
```json
{
  "email": "tutor@pintarpintar.id",
  "role": "Assistant",
  "permissions": { "canGrade": true }
}
```

### 3.10 Get Mentors
- **Endpoint**: `GET /api/v1/classes/:classId/mentors`

### 3.11 Get Enrolled Students
- **Endpoint**: `GET /api/v1/classes/:classId/students`
