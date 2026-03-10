Stories API Endpoints - Complete Guide
Overview
Stories are match-only content - users can only view stories from people they've mutually liked (matched with). Stories expire after 24 hours.

1. Upload Story (Create)
Endpoint
POST /api/v1/stories

Location: story.routes.js:21-28

Service: story.service.js:16-64

Request
Type: multipart/form-data

Fields:


media: [File] (required)
Response
Success (201):


{
  "success": true,
  "message": "Story uploaded successfully",
  "data": {
    "story_id": "507f1f77bcf86cd799439011",
    "media_type": "photo",
    "media_url": "https://cdn.cloudinary.com/...",
    "thumbnail_url": "https://cdn.cloudinary.com/...",
    "expires_at": "2026-02-04T10:00:00.000Z",
    "view_count": 0,
    "created_at": "2026-02-03T10:00:00.000Z"
  }
}
File Validation
Allowed File Types:

Photos: image/jpeg, image/png
Videos: video/mp4, video/quicktime (MOV)
File Size Limits:

Photos: Max 10 MB (fileUpload.js:47-52)
Videos: Max 50 MB (fileUpload.js:54-59)
Backend Processing
✅ Validates file type and size
✅ Uploads to Cloudinary
✅ Generates 300x300px thumbnail (for photos and videos)
✅ Sets expiry to 24 hours from creation
✅ Initializes view_count to 0
✅ DO's
DO show upload progress indicator for large files
DO validate file type on frontend before uploading
DO handle network failures with retry logic
DO show preview before uploading
DO inform users about the 24-hour expiry
❌ DON'Ts
DON'T allow users to upload without being authenticated
DON'T upload files larger than the limits (10MB photos, 50MB videos)
DON'T send unsupported file formats (GIF, WEBP, etc.)
DON'T forget to handle multer errors on frontend (413 for file too large)
2. Get Stories Feed (View Others' Stories)
Endpoint
GET /api/v1/stories/feed

Location: story.routes.js:35-41

Service: story.service.js:73-188

Query Parameters

limit: number (optional, default: 20, max: 50)
offset: number (optional, default: 0)
Response
Success (200):


{
  "success": true,
  "message": "Stories retrieved successfully",
  "data": {
    "stories": [
      {
        "user_id": "507f1f77bcf86cd799439011",
        "user_name": "John",
        "user_photo": "https://cdn.cloudinary.com/...",
        "has_unviewed": true,
        "stories": [
          {
            "story_id": "507f1f77bcf86cd799439012",
            "media_type": "photo",
            "media_url": "https://cdn.cloudinary.com/...",
            "thumbnail_url": "https://cdn.cloudinary.com/...",
            "created_at": "2026-02-03T10:00:00.000Z",
            "expires_at": "2026-02-04T10:00:00.000Z",
            "view_count": 15,
            "is_viewed": false
          }
        ]
      }
    ],
    "has_more": false
  }
}
Business Logic
Who Can View: (story.service.js:76-88)

✅ ONLY matched users (mutual likes)
✅ ONLY non-expired stories (expires_at > now)
Sorting: (story.service.js:171-177)

Unviewed stories first (has_unviewed: true)
Then by latest creation date
Grouping:

Stories are grouped by user (story.service.js:149-169)
Each user can have multiple stories
✅ DO's
DO show unviewed stories with a highlighted border/indicator
DO implement "swipe to next story" UX (like Instagram)
DO show story progress bars at the top
DO auto-advance to next story after viewing duration
DO cache thumbnails for faster loading
DO show "No stories available" when matches have no active stories
DO pull-to-refresh to fetch new stories
DO preload next story media for smooth transitions
❌ DON'Ts
DON'T forget to mark stories as viewed after viewing
DON'T load all media at once (lazy load)
3. Track Story View
Endpoint
POST /api/v1/stories/:story_id/view

Location: story.routes.js:48-54

Service: story.service.js:196-241

Request
URL Parameter:


story_id: MongoDB ObjectId (required)
Response
Success (200):


{
  "success": true,
  "message": "Story view tracked",
  "data": {
    "view_id": "507f1f77bcf86cd799439013",
    "story_id": "507f1f77bcf86cd799439012",
    "viewer_user_id": "507f1f77bcf86cd799439014",
    "viewed_at": "2026-02-03T10:05:00.000Z"
  }
}
Duplicate View (200):


{
  "success": true,
  "message": "Story view tracked",
  "data": {
    "message": "Story already viewed"
  }
}
Authorization Check
Permission Check: (story.service.js:209-213)

✅ Must be matched with story owner
✅ OR viewing own story
Side Effects
Creates story_view record (unique constraint on story_id + viewer_user_id)
Increments story.view_count by 1
If duplicate view (same user already viewed), returns success but doesn't increment
✅ DO's
DO call this endpoint when story is fully viewed (1+ seconds or full duration)
DO track view even if user skips (after minimum threshold)
DO handle duplicate view responses gracefully
DO show view count to story owner in real-time
DO call this BEFORE moving to next story
❌ DON'Ts
DON'T track views for accidental taps (< 1 second)
DON'T track multiple views if user replays same story
DON'T track view if story failed to load
DON'T forget to handle 403 Forbidden (not authorized to view)
DON'T spam this endpoint (already has duplicate protection)
4. Get Story Viewers (Who Viewed My Story)
Endpoint
GET /api/v1/stories/:story_id/viewers

Location: story.routes.js:62-67

Service: story.service.js:249-310

Request
URL Parameter:


story_id: MongoDB ObjectId (required)
Response
Success (200):


{
  "success": true,
  "message": "Story viewers retrieved successfully",
  "data": {
    "viewers": [
      {
        "user_id": "507f1f77bcf86cd799439011",
        "name": "John",
        "age": 28,
        "primary_photo": "https://cdn.cloudinary.com/...",
        "viewed_at": "2026-02-03T10:05:00.000Z"
      }
    ],
    "total": 15
  }
}
Authorization
Permission Check: (story.service.js:258-260)

✅ ONLY story owner can see viewers
❌ Others get 403 Forbidden
✅ DO's
DO show viewers list sorted by most recent first
DO allow story owner to tap on viewer to see their profile
DO update viewer count in real-time
DO show viewer profile pictures in circular avatars
❌ DON'Ts
DON'T allow non-owners to see who viewed a story
DON'T expose viewers list to API without authentication
DON'T forget to handle empty viewers list
DON'T show blocked users in viewers list
5. Delete Story
Endpoint
DELETE /api/v1/stories/:story_id

Location: story.routes.js:74-80

Service: story.service.js:318-343

Request
URL Parameter:


story_id: MongoDB ObjectId (required)
Response
Success (200):


{
  "success": true,
  "message": "Story deleted successfully",
  "data": null
}
Authorization
Permission Check: (story.service.js:327-329)

✅ ONLY story owner can delete
❌ Others get 403 Forbidden
Side Effects
Deletes story document from database
Deletes all story_views for this story
Deletes media from Cloudinary
Deletes thumbnail from Cloudinary (if different from media)
✅ DO's
DO show confirmation dialog before deleting
DO remove story from UI immediately after successful delete
DO allow swipe-to-delete gesture
DO show "Delete Story" option in story options menu
❌ DON'Ts
DON'T allow deletion of others' stories
DON'T forget to remove story from local cache after deletion
DON'T show deleted stories in feed
DON'T forget to handle 404 (story already deleted or expired)
6. Automatic Story Expiry (Cron Job)
Background Process
Function: deleteExpiredStories()

Location: story.service.js:349-381

Frequency: Every hour (configured in backend)

What It Does
Finds stories where expires_at < now
Deletes story documents
Deletes story views
Deletes media and thumbnails from Cloudinary
Frontend Implications
DO filter out expired stories on frontend (check expires_at)
DO show countdown timer on own stories
DO remove expired stories from UI automatically
DON'T rely solely on cron job (handle expiry on frontend too)
Comparison: Backend vs implementation.md
Feature	implementation.md Spec	Backend Implementation	Status
Upload Story	POST /api/v1/stories	✅ POST /api/v1/stories	✅ Match
File Types	photo/video	✅ JPEG, PNG, MP4, MOV	✅ Match
Size Limits	Max 5MB (spec)	✅ 10MB photos, 50MB videos	⚠️ Different (better)
Thumbnail Generation	200x200px (spec)	✅ 300x300px	⚠️ Different (bigger)
Get Stories Feed	GET /api/v1/stories/feed	✅ GET /api/v1/stories/feed	✅ Match
Match-only access	✅ Yes	✅ Yes	✅ Match
24-hour expiry	✅ Yes	✅ Yes	✅ Match
Track View	POST /api/v1/stories/:id/view	✅ POST /api/v1/stories/:id/view	✅ Match
Get Viewers	GET /api/v1/stories/:id/viewers	✅ GET /api/v1/stories/:id/viewers	✅ Match
Delete Story	DELETE /api/v1/stories/:id	✅ DELETE /api/v1/stories/:id	✅ Match
Cron Job	Hourly cleanup	✅ Implemented	✅ Match
Security & Privacy
✅ Implemented Security Features
Authentication Required: All endpoints require JWT token
Match Verification: Only matched users can view stories (story.service.js:209)
Owner-only Delete: Only story owner can delete (story.service.js:327)
Owner-only Viewers: Only story owner can see who viewed (story.service.js:258)
Expiry Enforcement: Stories automatically expire after 24 hours
Duplicate View Protection: Unique constraint on story_id + viewer_user_id
⚠️ Frontend Security Reminders
DO clear expired stories from cache
DON'T store media URLs permanently (they expire)
Error Handling
Common Errors
Stories API Endpoints Documentation
Overview
Stories are MATCH-ONLY content - only visible to users you've matched with (mutual likes). Stories expire after 24 hours.

1. Upload Story (Create)
Endpoint

POST /api/v1/stories
Authentication
Required - JWT token in Authorization header

Request
Content-Type: multipart/form-data

Form Data:

media (File) - Photo or video file
Supported File Types
Photos: JPEG, PNG
Videos: MP4, MOV (QuickTime)
File Size Limits
Photos: Max 10 MB
Videos: Max 50 MB
Implementation Location
Route: story.routes.js:21-28
Controller: story.controller.js:10-18
Service: story.service.js:16-64
Validator: story.validator.js:6
Response

{
  "success": true,
  "message": "Story uploaded successfully",
  "data": {
    "story_id": "507f1f77bcf86cd799439011",
    "media_type": "photo",
    "media_url": "https://cloudinary.com/stories/story_507f.jpg",
    "thumbnail_url": "https://cloudinary.com/stories/thumb_507f.jpg",
    "expires_at": "2026-02-04T10:00:00.000Z",
    "view_count": 0,
    "created_at": "2026-02-03T10:00:00.000Z"
  }
}
How It Works
Validates file type and size (fileUpload.js:36-60)
Uploads media to Cloudinary
Generates thumbnail (300x300px, 80% quality)
Creates story document with 24-hour expiry
Returns story details
✅ DO's
DO validate file type on frontend before upload
DO show upload progress indicator
DO handle file size errors gracefully
DO inform users about 24-hour expiry
DO allow users to upload multiple stories (separate uploads)
DO show preview before uploading
❌ DON'Ts
DON'T upload files larger than 10MB (photos) or 50MB (videos)
DON'T upload unsupported file types (GIF, WebP, etc.)
DON'T upload without user consent/confirmation
DON'T forget to handle network errors
DON'T cache story media permanently (expires in 24h)
DON'T allow batch uploads (one at a time)
2. Get Stories Feed (View Others' Stories)
Endpoint

GET /api/v1/stories/feed
Authentication
Required - JWT token in Authorization header

Query Parameters
limit (optional, default: 20) - Number of users to return (1-50)
offset (optional, default: 0) - Pagination offset
Implementation Location
Route: story.routes.js:35-41
Controller: story.controller.js:25-36
Service: story.service.js:73-188
Validator: story.validator.js:11-20
Response

{
  "success": true,
  "message": "Stories retrieved successfully",
  "data": {
    "stories": [
      {
        "user_id": "507f1f77bcf86cd799439011",
        "user_name": "John",
        "user_photo": "https://cloudinary.com/photos/user_507f.jpg",
        "has_unviewed": true,
        "stories": [
          {
            "story_id": "507f1f77bcf86cd799439012",
            "media_type": "photo",
            "media_url": "https://cloudinary.com/stories/story_507f.jpg",
            "thumbnail_url": "https://cloudinary.com/stories/thumb_507f.jpg",
            "created_at": "2026-02-03T10:00:00.000Z",
            "expires_at": "2026-02-04T10:00:00.000Z",
            "view_count": 15,
            "is_viewed": false
          }
        ]
      }
    ],
    "has_more": true
  }
}
How It Works (story.service.js:73-188)
Fetches active matches for current user
Queries stories from matched users only
Filters expired stories (expires_at > now)
Checks which stories current user has viewed
Groups stories by user
Orders by: unviewed first, then by creation date
Returns paginated results
Filtering Logic

// Only matched users
const matches = await Match.find({
  $or: [{ user1_id: userId }, { user2_id: userId }],
  is_active: true
});

// Only non-expired stories
const stories = await Story.find({
  user_id: { $in: matchedUserIds },
  expires_at: { $gt: new Date() }
});
✅ DO's
DO show unviewed stories first (ring indicator)
DO cache story thumbnails
DO show story expiry time
DO auto-refresh feed when new stories are available
DO mark stories as viewed after watching
DO preload next story for smooth viewing
DO handle video playback with proper controls
❌ DON'Ts
DON'T show stories from non-matched users
DON'T show expired stories
DON'T load all stories at once (use pagination)
DON'T cache expired story content
DON'T show your own story in this feed (separate section)
DON'T forget to handle empty states
3. Track Story View
Endpoint

POST /api/v1/stories/:story_id/view
Authentication
Required - JWT token in Authorization header

URL Parameters
story_id (required) - MongoDB ObjectId of the story
Implementation Location
Route: story.routes.js:48-54
Controller: story.controller.js:43-51
Service: story.service.js:196-241
Response

{
  "success": true,
  "message": "Story view tracked",
  "data": {
    "view_id": "507f1f77bcf86cd799439013",
    "story_id": "507f1f77bcf86cd799439012",
    "viewer_user_id": "507f1f77bcf86cd799439011",
    "viewed_at": "2026-02-03T10:05:00.000Z"
  }
}
How It Works
Validates story exists and is not expired
Verifies match exists between viewer and story owner (story.service.js:209-213)
Creates story view record (prevents duplicates)
Increments story view_count
Returns view details
Authorization Check

const isMatched = await verifyMatchExists(viewerUserId, story.user_id);

if (!isMatched && story.user_id !== viewerUserId) {
  throw new ForbiddenError('Not authorized to view this story');
}
✅ DO's
DO track view when story is actually watched (1+ seconds)
DO track view only once per story per user
DO call this endpoint before showing story content
DO handle duplicate view gracefully (silent success)
DO track view even if user skips quickly
❌ DON'Ts
DON'T track views for expired stories
DON'T track views without watching the story
DON'T track multiple views from same user
DON'T allow viewing stories from non-matched users
DON'T skip this endpoint (important for analytics)
4. Get Story Viewers
Endpoint

GET /api/v1/stories/:story_id/viewers
Authentication
Required - JWT token in Authorization header (must be story owner)

URL Parameters
story_id (required) - MongoDB ObjectId of the story
Implementation Location
Route: story.routes.js:61-67
Controller: story.controller.js:58-66
Service: story.service.js:249-310
Response

{
  "success": true,
  "message": "Story viewers retrieved successfully",
  "data": {
    "viewers": [
      {
        "user_id": "507f1f77bcf86cd799439011",
        "name": "John",
        "age": 28,
        "primary_photo": "https://cloudinary.com/photos/user_507f.jpg",
        "viewed_at": "2026-02-03T10:05:00.000Z"
      }
    ],
    "total": 15
  }
}
✅ DO's
DO show viewers in chronological order (latest first)
DO show viewer count prominently
DO allow tapping viewer to view their profile
DO refresh viewers list when reopening
❌ DON'Ts
DON'T allow non-owners to see viewers
DON'T show viewers for other users' stories
DON'T cache viewers list (should be real-time)
5. Delete Story
Endpoint

DELETE /api/v1/stories/:story_id
Authentication
Required - JWT token in Authorization header (must be story owner)

URL Parameters
story_id (required) - MongoDB ObjectId of the story
Implementation Location
Route: story.routes.js:74-80
Controller: story.controller.js:73-81
Service: story.service.js:318-343
Response

{
  "success": true,
  "message": "Story deleted successfully",
  "data": null
}
How It Works
Validates story belongs to current user
Deletes media from Cloudinary (video + thumbnail)
Deletes story document from database
Deletes all story views
Returns success
✅ DO's
DO confirm deletion with user
DO remove story from UI immediately
DO show undo option (with 3-5 second delay)
❌ DON'Ts
DON'T allow deleting other users' stories
DON'T delete without confirmation
DON'T leave media orphaned in cloud storage
Summary Table
Endpoint	Method	Purpose	Who Can Access
/api/v1/stories	POST	Upload story	Authenticated users
/api/v1/stories/feed	GET	View matched users' stories	Authenticated users
/api/v1/stories/:story_id/view	POST	Track story view	Matched users only
/api/v1/stories/:story_id/viewers	GET	See who viewed your story	Story owner only
/api/v1/stories/:story_id	DELETE	Delete your story	Story owner only
Key Security Rules
Stories are MATCH-ONLY - Only visible to mutually matched users
24-Hour Expiry - Auto-deleted after 24 hours (cron job runs hourly)
Authorization Checks - Match verification before viewing (story.service.js:389-399)
Ownership Validation - Only owner can delete or see viewers
File Size Limits - Enforced at upload time
Cron Job: Auto-Delete Expired Stories
A cron job runs every hour to delete expired stories:

Finds stories where expires_at < now
Deletes media from Cloudinary
Removes story documents and views from database
Implementation: story.service.js:349-381