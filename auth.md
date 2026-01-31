# Implementation Plan: OAuth One Tap & Onboarding Flow for React Native + Cloudinary Migration

## Overview

This plan provides comprehensive documentation for implementing Google OAuth (One Tap) authentication and a complete onboarding flow in a React Native (Expo) app that integrates with the In-Blood backend. Additionally, this plan includes migrating all file uploads to Cloudinary (which is already configured) to replace local filesystem storage and deprecated S3 references.

## Implementation Status

### BACKEND: COMPLETE

All critical backend modifications have been successfully implemented:

**Completed:**

- Mobile OAuth endpoint (POST /api/v1/auth/google/mobile) for React Native
- Verification service migrated from local filesystem to Cloudinary
- Profile photo upload implemented with Cloudinary
- Multer middleware configured for file uploads
- All file uploads now use Cloudinary consistently

**Files Modified:**

- src/validators/auth.validator.js - Added googleMobileAuthValidator
- src/services/auth.service.js - Added handleGoogleMobileAuth
- src/controllers/auth.controller.js - Added googleMobileAuth
- src/routes/auth.routes.js - Added POST /google/mobile route
- src/services/verification.service.js - Migrated to Cloudinary
- src/services/user.service.js - Added uploadProfilePhoto
- src/controllers/user.controller.js - Implemented uploadPhoto
- src/routes/user.routes.js - Added multer middleware

**Ready For:**

- React Native frontend integration
- Manual testing of new endpoints
- Frontend development

### FRONTEND: PENDING

This document provides complete specifications for implementing the React Native (Expo) app with OAuth and onboarding flow.

---

## Original Backend Status (Before Implementation)

Based on codebase exploration:

**Authentication**:

- Current: Google OAuth 2.0 using redirect-based web flow (incompatible with mobile)
- Endpoints: GET /auth/google, GET /auth/google/callback, POST /auth/refresh-token
- JWT tokens: Access token (30min), Refresh token (7 days)
- REQUIRED: New mobile OAuth endpoint needed (NOW IMPLEMENTED)

**File Upload Status**:

- Cloudinary is ACTIVE and configured (credentials in .env)
- Universal uploads (POST /upload/single, POST /upload/multiple) use Cloudinary
- Story uploads use Cloudinary with thumbnail generation
- CRITICAL ISSUE: Verification selfie uploads use LOCAL FILESYSTEM (NOW FIXED - USES CLOUDINARY)
- Profile photo upload endpoint exists but throws error (NOW IMPLEMENTED)
- S3 service exists but marked as DEPRECATED

**Onboarding Endpoints Available**:

- All user profile, location, tags, preferences, privacy settings endpoints exist
- Ready for React Native integration

---

## PART 1: BACKEND IMPLEMENTATION (COMPLETED)

### 1.1 Add Mobile OAuth Endpoint (CRITICAL - MUST IMPLEMENT)

**Problem**: Current OAuth uses redirect flow incompatible with React Native.

**Solution**: Add POST /api/v1/auth/google/mobile endpoint that accepts Google access token from mobile clients.

#### Files to Modify:

**1. src/routes/auth.routes.js**
Add new route:

```javascript
import { googleMobileAuthValidator } from "../validators/auth.validator.js";

router.post(
  "/google/mobile",
  googleMobileAuthValidator,
  validateRequest,
  authController.googleMobileAuth,
);
```

**2. src/controllers/auth.controller.js**
Add new controller:

```javascript
export const googleMobileAuth = catchAsync(async (req, res) => {
  console.log("Processing mobile Google OAuth");
  const { access_token } = req.body;

  if (!access_token) {
    throw new ValidationError([
      {
        field: "access_token",
        message: "Google access token is required",
      },
    ]);
  }

  const result = await authService.handleGoogleMobileAuth(access_token);
  sendSuccess(res, "Login successful", result, 200);
});
```

**3. src/services/auth.service.js**
Add new service method:

```javascript
export const handleGoogleMobileAuth = async (accessToken) => {
  console.log("Verifying Google access token from mobile");

  try {
    // Verify access token with Google and get user info
    const googleUser = await verifyAccessToken(accessToken);

    console.log("Token verified for:", googleUser.email);

    // Find or create user (same logic as handleGoogleCallback)
    let user = await User.findOne({ google_id: googleUser.google_id });

    if (!user) {
      user = await User.findOne({ email: googleUser.email });

      if (user) {
        user.google_id = googleUser.google_id;
        user.last_active_at = new Date();
        await user.save();
        console.log("Linked existing user to Google account:", user._id);
      } else {
        user = await User.create({
          google_id: googleUser.google_id,
          email: googleUser.email,
          name: googleUser.name,
          last_active_at: new Date(),
        });
        console.log("Created new user:", user._id);
      }
    } else {
      user.last_active_at = new Date();
      await user.save();
      console.log("Updated existing user last_active_at:", user._id);
    }

    // Generate JWT tokens
    const jwtTokens = generateTokenPair(user._id.toString());
    console.log("Generated JWT tokens for user:", user._id);

    return {
      user: {
        user_id: user._id.toString(),
        name: user.name,
        email: user.email,
        google_id: user.google_id,
        age: user.age,
        gender: user.gender,
      },
      accessToken: jwtTokens.accessToken,
      refreshToken: jwtTokens.refreshToken,
    };
  } catch (error) {
    console.log("Google mobile auth error:", error.message);
    throw handleGoogleOAuthError(error);
  }
};
```

**4. src/validators/auth.validator.js**
Add validator:

```javascript
export const googleMobileAuthValidator = [
  body("access_token")
    .exists()
    .withMessage("Google access token is required")
    .isString()
    .withMessage("access token must be a string")
    .notEmpty()
    .withMessage("access token cannot be empty"),
];
```

**New Endpoint Specification**:

- Route: POST /api/v1/auth/google/mobile
- Access: Public
- Request Body: { "access_token": "eyJhbGci..." }
- Response: { user, accessToken, refreshToken }

---

### 1.2 Migrate Verification Service to Cloudinary (CRITICAL - MUST FIX)

**Problem**: Verification selfie uploads use local filesystem (lines 36-50 in verification.service.js) while all other uploads use Cloudinary.

**Solution**: Replace filesystem storage with Cloudinary upload.

#### File to Modify:

**src/services/verification.service.js**

Replace lines 1-69 with:

```javascript
import { uploadToCloudinary } from "../utils/cloudinaryService.js";
import VerificationRequest from "../models/VerificationRequest.js";
import User from "../models/User.js";
import { NotFoundError, ForbiddenError } from "../utils/errorHandler.js";

/**
 * Submit verification request with selfie
 * @param {String} userId - User ID
 * @param {Object} file - Multer file object
 * @returns {Promise<Object>} Verification request details
 */
export const submitVerificationRequest = async (userId, file) => {
  console.log("Submitting verification request for user:", userId);

  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError("User not found");
  }

  const pendingRequest = await VerificationRequest.findOne({
    user_id: userId,
    status: "pending",
  });

  if (pendingRequest) {
    throw new ForbiddenError("You already have a pending verification request");
  }

  // Upload to Cloudinary instead of local filesystem
  const folder = `verification/${userId}`;
  const resourceType = "image";
  const selfie_url = await uploadToCloudinary(
    file.buffer,
    folder,
    resourceType,
  );

  console.log("Selfie uploaded to Cloudinary:", selfie_url);

  const verificationRequest = await VerificationRequest.create({
    user_id: userId,
    selfie_url: selfie_url,
    status: "pending",
    reviewed_at: null,
  });

  console.log("Verification request created:", verificationRequest._id);

  return {
    verification_id: verificationRequest._id.toString(),
    status: verificationRequest.status,
  };
};

// getVerificationStatus remains unchanged (no file upload)
```

**Impact**: Eliminates filesystem dependencies, makes verification uploads consistent with other file uploads.

---

### 1.3 Implement Profile Photo Upload (CRITICAL - MUST IMPLEMENT)

**Problem**: POST /users/upload-photo throws error despite Cloudinary being configured.

**Solution**: Implement profile photo upload using Cloudinary and Photo model.

#### Files to Modify:

**1. src/controllers/user.controller.js**
Replace `uploadPhoto` function (lines 114-121):

```javascript
export const uploadPhoto = catchAsync(async (req, res) => {
  console.log("Uploading profile photo for user:", req.user.userId);

  if (!req.file) {
    throw new ValidationError("No photo provided");
  }

  const photoData = await userService.uploadProfilePhoto(
    req.user.userId,
    req.file,
  );

  sendSuccess(res, "Photo uploaded successfully", photoData, 200);
});
```

**2. src/services/user.service.js**
Add new service method:

```javascript
import { uploadToCloudinary } from "../utils/cloudinaryService.js";
import Photo from "../models/Photo.js";

/**
 * Upload profile photo
 * @param {String} userId - User ID
 * @param {Object} file - Multer file object
 * @returns {Promise<Object>} Photo details
 */
export const uploadProfilePhoto = async (userId, file) => {
  console.log("Processing profile photo upload for user:", userId);

  const folder = `profiles/${userId}/photos`;
  const resourceType = "image";
  const url = await uploadToCloudinary(file.buffer, folder, resourceType);

  console.log("Photo uploaded to Cloudinary:", url);

  const photoCount = await Photo.countDocuments({ user_id: userId });
  const isPrimary = photoCount === 0;

  const photo = await Photo.create({
    user_id: userId,
    url: url,
    thumbnail_url: url,
    order_index: photoCount,
    is_primary: isPrimary,
    is_approved: false,
    uploaded_at: new Date(),
  });

  console.log("Photo record created:", photo._id);

  return {
    photo_id: photo._id.toString(),
    url: photo.url,
    is_primary: photo.is_primary,
    order_index: photo.order_index,
  };
};
```

**3. src/routes/user.routes.js**
Update route to include multer middleware:

```javascript
import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG and PNG images are allowed"), false);
    }
  },
});

router.post(
  "/upload-photo",
  authenticate,
  upload.single("photo"),
  userController.uploadPhoto,
);
```

---

## PART 2: FRONTEND DOCUMENTATION - REACT NATIVE (EXPO)

### 2.1 OAuth One Tap Implementation

#### Required Dependencies:

```bash
npm install @react-native-google-signin/google-signin
npm install @react-native-async-storage/async-storage
npm install axios
```

After installing, run:

```bash
npx expo prebuild --clean
```

#### Google Cloud Console Setup:

1. Create OAuth 2.0 Client ID for Android
2. Android: Package name (`com.inblood.app`) + SHA-1 certificate fingerprint
3. Get SHA-1: `cd android && ./gradlew signingReport`
4. Add SHA-1 fingerprint to the Android OAuth client in Google Cloud Console

#### Authentication Service Structure:

**File**: src/hooks/useGoogleAuth.ts

Key functions:

- `signIn()` - Opens native Google sign-in modal, returns user info + access token
- `signOut()` - Signs out from Google
- `isConfigured` - Boolean indicating if Google Sign-In is ready
- `isSigningIn` - Boolean indicating sign-in in progress

**File**: src/context/AuthContext.tsx

Key functions:

- `googleLogin(authData)` - Sends access token to backend, stores JWT tokens
- `logout()` - Clears auth state
- `isAuthenticated` - Boolean indicating if user is logged in

#### Login Screen Pattern:

- Use `@react-native-google-signin/google-signin` for native Google Sign-In
- Call `signIn()` to open native Google modal
- Get access token from `GoogleSignin.getTokens()`
- Send access token to POST /api/v1/auth/google/mobile
- Backend verifies token with Google's userinfo API
- Store JWT tokens from backend response
- Navigate to Onboarding if profile incomplete, otherwise MainApp

---

### 2.2 Onboarding Flow (9 Steps)

#### Onboarding Service:

**File**: src/services/onboardingService.js

Functions to implement:

- `updateProfile(profileData)` - PUT /users/profile
- `updateLocation(lat, lng)` - PUT /users/location
- `getTags()` - GET /tags
- `addUserTags(tagIds)` - POST /users/tags
- `updateRelationshipTypes(types)` - POST /users/relationship-types
- `updatePreferences(prefs)` - PUT /users/preferences
- `updateSettings(settings)` - PUT /users/settings
- `uploadProfilePhoto(imageUri)` - POST /users/upload-photo

#### Onboarding Steps:

**Step 1: Basic Info**

- API: PUT /users/profile
- Fields: name (2-100 chars), age (18-99)

**Step 2: Gender**

- API: PUT /users/profile
- Fields: gender (enum), pronouns (optional, max 50 chars)
- Options: Man, Woman, Trans Man, Trans Woman, Non-Binary, Gender Fluid, Prefer to Self-Describe, Prefer Not to Say

**Step 3: Sexual Orientation**

- API: PUT /users/profile
- Field: sexual_orientation (enum)
- Options: Straight, Gay, Lesbian, Bisexual, Pansexual, Asexual, Queer, Questioning, Other

**Step 4: Relationship Types**

- API: POST /users/relationship-types
- Field: types (array, 1-3 elements)
- Options: Friendship, Casual, Dating, Serious, Open, Flexible

**Step 5: Location**

- API: PUT /users/location
- Fields: latitude, longitude (REQUIRED)
- Use expo-location to get GPS coordinates
- Backend auto-geocodes to city/state/country

**Step 6: Photos**

- API: POST /users/upload-photo
- Use expo-image-picker
- Validation: JPEG/PNG, max 10MB
- First photo becomes primary

**Step 7: Interests (Tags)**

- API GET: GET /tags
- API POST: POST /users/tags
- Max 10 tags per user
- Display grouped by category

**Step 8: Discovery Preferences**

- API: PUT /users/preferences
- Fields: proximity_range (1-100 km), age_min (18-99), age_max (18-99)

**Step 9: Bio**

- API: PUT /users/profile
- Field: bio (max 500 chars)
- Navigate to MainApp on completion

---

## PART 3: API REFERENCE FOR FRONTEND DEVELOPERS

### Authentication Endpoints

**POST /api/v1/auth/google/mobile** (NEW)

- Request: { "access_token": "..." }
- Response: { user, accessToken, refreshToken }
- Status: 200 (success), 400 (validation error)

**POST /api/v1/auth/refresh-token**

- Request: { "refresh_token": "..." }
- Response: { accessToken, refreshToken }
- Token Expiration: Access 30min, Refresh 7 days

**POST /api/v1/auth/logout**

- Headers: Authorization: Bearer {token}
- Response: { success: true }

### User Profile Endpoints

**GET /api/v1/users/profile**

- Headers: Authorization: Bearer {token}
- Response: Full user profile object

**PUT /api/v1/users/profile**

- Headers: Authorization: Bearer {token}
- Request: { name?, age?, gender?, pronouns?, sexual_orientation?, bio?, job_title?, company?, education?, drinking?, smoking?, exercise?, pets? }
- All fields optional, can update incrementally

**PUT /api/v1/users/location**

- Headers: Authorization: Bearer {token}
- Request: { latitude: number, longitude: number } (both REQUIRED)
- Response: { location_city, location_state, location_country }

### Tags Endpoints

**GET /api/v1/tags**

- Access: Public (no auth required)
- Response: Array of { \_id, name, category }

**POST /api/v1/users/tags**

- Headers: Authorization: Bearer {token}
- Request: { tag_ids: ["id1", "id2"] }
- Max 10 tags per user

**DELETE /api/v1/users/tags/:tagId**

- Headers: Authorization: Bearer {token}
- Response: { message: "Tag removed successfully" }

### Relationship Types Endpoint

**POST /api/v1/users/relationship-types**

- Headers: Authorization: Bearer {token}
- Request: { types: ["Dating", "Serious"] }
- Validation: 1-3 types from enum
- Options: Friendship, Casual, Dating, Serious, Open, Flexible

### Discovery Preferences Endpoint

**PUT /api/v1/users/preferences**

- Headers: Authorization: Bearer {token}
- Request: { proximity_range?: number, age_min?: number, age_max?: number }
- Validation: age_max >= age_min

### Privacy Settings Endpoint

**PUT /api/v1/users/settings**

- Headers: Authorization: Bearer {token}
- Request: { is_discoverable?: boolean, show_distance?: string, show_last_active?: boolean }
- show_distance options: exact, approximate, hide

### Photo Upload Endpoint

**POST /api/v1/users/upload-photo**

- Headers: Authorization: Bearer {token}, Content-Type: multipart/form-data
- Request: FormData with field "photo"
- Validation: JPEG/PNG, max 10MB
- Response: { photo_id, url, is_primary, order_index }

### Verification Endpoint

**POST /api/v1/verification/request**

- Headers: Authorization: Bearer {token}, Content-Type: multipart/form-data
- Request: FormData with field "selfie"
- Validation: JPEG/PNG, max 5MB
- Response: { verification_id, status: "pending" }

**GET /api/v1/verification/status**

- Headers: Authorization: Bearer {token}
- Response: { verification_id, status, reviewed_at, created_at }

---

## PART 4: VALIDATION RULES SUMMARY

| Endpoint           | Field                       | Type   | Constraints                        |
| ------------------ | --------------------------- | ------ | ---------------------------------- |
| Profile            | name                        | string | 2-100 chars                        |
| Profile            | age                         | number | 18-99                              |
| Profile            | gender                      | enum   | 8 predefined values                |
| Profile            | pronouns                    | string | max 50 chars                       |
| Profile            | sexual_orientation          | enum   | 9 predefined values                |
| Profile            | bio                         | string | max 500 chars                      |
| Profile            | job_title/company/education | string | max 100 chars each                 |
| Location           | latitude                    | number | -90 to 90, REQUIRED                |
| Location           | longitude                   | number | -180 to 180, REQUIRED              |
| Preferences        | proximity_range             | number | 1-100 km                           |
| Preferences        | age_min                     | number | 18-99                              |
| Preferences        | age_max                     | number | 18-99, >= age_min                  |
| Tags               | tag_ids                     | array  | 1+ MongoDB ObjectIds, max 10 total |
| Relationship Types | types                       | array  | 1-3 from enum                      |

---

## PART 5: ERROR HANDLING

### Standard Error Response Format:

```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    {
      "field": "field_name",
      "message": "Field-specific error"
    }
  ]
}
```

### HTTP Status Codes:

- 200: Success
- 201: Created
- 400: Validation Error
- 401: Unauthorized (invalid/expired token)
- 403: Forbidden
- 404: Not Found
- 500: Internal Server Error

### Frontend Error Handling Pattern:

- 401 errors: Auto-refresh token using refresh token endpoint
- Invalid refresh token: Logout and redirect to login
- Validation errors: Display field-specific messages
- Network errors: Show generic retry message

---

## PART 6: IMPLEMENTATION CHECKLIST

### Backend Tasks (Priority Order):

**STATUS: BACKEND IMPLEMENTATION COMPLETE**

All critical backend modifications have been successfully implemented and are ready for React Native integration.

**Priority 1 - Critical** (COMPLETED):

- [x] Add POST /auth/google/mobile endpoint
- [x] Add googleMobileAuth controller
- [x] Add handleGoogleMobileAuth service method
- [x] Add googleMobileAuthValidator
- [x] Migrate verification service to Cloudinary
- [x] Implement profile photo upload with Cloudinary
- [x] Add multer middleware to /users/upload-photo route
- [ ] Test all new endpoints (Ready for testing)

**Priority 2 - Optional**:

- [ ] Add photo deletion endpoint
- [ ] Add photo reordering endpoint
- [ ] Add thumbnail generation for profile photos

### Frontend Tasks:

**Phase 1 - Authentication** (COMPLETED):

- [x] Install @react-native-google-signin/google-signin
- [x] Configure Google OAuth credentials (Android client ID)
- [x] Create useGoogleAuth.ts hook
- [x] Create AuthContext.tsx
- [x] Create LoginScreen.tsx
- [x] Implement backend API integration
- [ ] Implement token storage with AsyncStorage
- [ ] Implement auto token refresh
- [ ] Test OAuth flow end-to-end

**Phase 2 - Onboarding**:

- [ ] Create OnboardingNavigator
- [ ] Create onboardingService.js
- [ ] Implement 9 onboarding screens
- [ ] Add progress indicator
- [ ] Test complete flow

**Phase 3 - Testing**:

- [ ] Test on Android
- [ ] Test on iOS
- [ ] Test with Expo Go
- [ ] Test token refresh
- [ ] Test error handling

---

## PART 7: CRITICAL FILES FOR IMPLEMENTATION

### Backend Files to Modify:

1. **src/routes/auth.routes.js** - Add mobile OAuth route
2. **src/controllers/auth.controller.js** - Add googleMobileAuth controller
3. **src/services/auth.service.js** - Add handleGoogleMobileAuth service
4. **src/validators/auth.validator.js** - Add googleMobileAuthValidator
5. **src/services/verification.service.js** - Replace filesystem with Cloudinary
6. **src/controllers/user.controller.js** - Implement uploadPhoto controller
7. **src/services/user.service.js** - Add uploadProfilePhoto service
8. **src/routes/user.routes.js** - Add multer to photo upload route

### Frontend Files Created:

1. **src/hooks/useGoogleAuth.ts** - Google Sign-In hook using native SDK
2. **src/context/AuthContext.tsx** - Auth state management and backend API calls
3. **src/screens/auth/LoginScreen.tsx** - Login screen with Google Sign-In button

### Frontend Files to Create:

1. **src/services/onboardingService.js** - Onboarding API calls
2. **src/navigation/OnboardingNavigator.js** - Onboarding flow navigator
3. **src/screens/onboarding/\*** - 9 onboarding screens

---

## PART 8: ENVIRONMENT CONFIGURATION

### Backend .env Variables:

```env
# Google OAuth
GOOGLE_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=30m
REFRESH_TOKEN_SECRET=your-refresh-secret
REFRESH_TOKEN_EXPIRES_IN=7d

# Cloudinary (ACTIVE)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
CLOUDINARY_FOLDER=inblood

# Google Maps (for reverse geocoding)
GOOGLE_MAPS_API_KEY=your-maps-api-key
```

### Frontend Configuration:

```javascript
// src/config/auth.config.js
export const AUTH_CONFIG = {
  API_BASE_URL: __DEV__
    ? "http://localhost:5000/api/v1"
    : "https://api.inblood.com/api/v1",
  GOOGLE_WEB_CLIENT_ID: "your-web-client-id",
  GOOGLE_IOS_CLIENT_ID: "your-ios-client-id",
  GOOGLE_ANDROID_CLIENT_ID: "your-android-client-id",
};
```

---

## PART 9: VERIFICATION STEPS

### Backend Verification:

1. Start server and test POST /api/v1/auth/google/mobile with mock access token
2. Test profile photo upload with Cloudinary
3. Test verification request upload with Cloudinary
4. Verify all uploads go to Cloudinary, not local filesystem
5. Check console.log statements for debugging

### Frontend Verification:

1. Test Google OAuth on Android/iOS/Expo Go
2. Verify tokens stored in AsyncStorage
3. Test complete onboarding flow (all 9 steps)
4. Test token auto-refresh on 401 errors
5. Test error handling for validation errors

---

## Summary

This documentation provides complete specification for implementing Google Sign-In and onboarding in React Native, plus all necessary backend integrations.

### Backend Status: COMPLETE

All critical backend modifications have been implemented:

- Mobile OAuth endpoint (POST /api/v1/auth/google/mobile) - Accepts access_token from mobile client
- Access token verification via Google's userinfo API
- Verification service migrated to Cloudinary - No more local filesystem dependencies
- Profile photo upload fully functional - Using Cloudinary with Photo model
- All file uploads now use Cloudinary consistently

### Frontend Status: AUTHENTICATION COMPLETE

Google Sign-In authentication has been implemented:

- Native Google Sign-In using @react-native-google-signin/google-signin
- useGoogleAuth.ts hook for sign-in/sign-out
- AuthContext.tsx for state management and backend API calls
- LoginScreen.tsx with Google Sign-In button
- Backend integration sending access_token to POST /api/v1/auth/google/mobile

### Remaining Frontend Work:

- Token persistence with AsyncStorage
- Auto token refresh on 401 errors
- 9-step onboarding flow implementation
- Error handling improvements

### Authentication Flow:

1. User taps "Continue with Google"
2. Native Google Sign-In modal appears
3. User authenticates with Google
4. Frontend gets access_token via GoogleSignin.getTokens()
5. Frontend sends access_token to POST /api/v1/auth/google/mobile
6. Backend verifies token with Google's userinfo API
7. Backend creates/updates user in database
8. Backend returns JWT tokens (accessToken, refreshToken)
9. Frontend stores tokens and navigates to main app
