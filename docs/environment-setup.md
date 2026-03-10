# Environment Variables Setup

## Overview
The application uses environment variables to manage configuration across different environments (development, staging, production). This allows for easy configuration without hardcoding sensitive values.

## Files Created

1. **`.env.example`** - Template file (checked into Git)
2. **`.env.development`** - Development configuration (excluded from Git)
3. **`.env.production`** - Production configuration (excluded from Git)
4. **`app.config.ts`** - Expo configuration that loads environment variables
5. **Updated configs**:
   - `src/config/firebase.config.ts` - Now uses Constants from expo
   - `src/config/api.config.ts` - Now uses Constants from expo

## Environment Variables

### API Configuration
```
API_BASE_URL=https://backend-cfh1.onrender.com/api/v1
API_TIMEOUT=30000
```

### Firebase Configuration
```
FIREBASE_API_KEY=your_api_key
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_DATABASE_URL=https://your_project.firebasedatabase.app
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=123456789012
FIREBASE_APP_ID=1:123456789012:platform:app_id
FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

### Google OAuth
```
GOOGLE_WEB_CLIENT_ID=your_client_id.apps.googleusercontent.com
```

## Setup Instructions

### 1. Initial Setup

```bash
# Copy the example file to create your development environment
cp .env.example .env.development

# Edit .env.development with your actual credentials
nano .env.development
```

### 2. For Production

```bash
# Create production environment file
cp .env.example .env.production

# Edit with production credentials
nano .env.production
```

### 3. For Staging (Optional)

```bash
# Create staging environment file
cp .env.example .env.staging

# Edit with staging credentials
nano .env.staging
```

## Usage in Code

### Accessing Environment Variables

```typescript
import Constants from 'expo-constants';

// Access environment name
const env = Constants.expoConfig?.extra?.env; // 'development', 'staging', or 'production'

// Access API config
const apiBaseUrl = Constants.expoConfig?.extra?.apiBaseUrl;
const apiTimeout = Constants.expoConfig?.extra?.apiTimeout;

// Access Firebase config
const firebaseConfig = {
  apiKey: Constants.expoConfig?.extra?.firebase?.apiKey,
  projectId: Constants.expoConfig?.extra?.firebase?.projectId,
  // ... other Firebase fields
};

// Access Google OAuth
const googleClientId = Constants.expoConfig?.extra?.googleWebClientId;
```

### Example: New Configuration Value

1. **Add to `.env` files**:
```bash
# Add to .env.development, .env.staging, .env.production
NEW_CONFIG_VALUE=some_value
```

2. **Add to `app.config.ts`**:
```typescript
extra: {
  // ... existing config ...
  newConfigValue: envVars.NEW_CONFIG_VALUE || 'default_value',
}
```

3. **Use in code**:
```typescript
const value = Constants.expoConfig?.extra?.newConfigValue;
```

## Running with Different Environments

### Development (Default)

```bash
npm start
# or
expo start
```

### Production

```bash
APP_VARIANT=production npm start
# or
APP_VARIANT=production expo start
```

### Staging

```bash
APP_VARIANT=staging npm start
# or
APP_VARIANT=staging expo start
```

## Building for Different Environments

### Development Build

```bash
eas build --profile development
```

### Production Build

```bash
APP_VARIANT=production eas build --profile production
```

## Security Best Practices

### ✅ DO:
- Keep `.env.example` in Git (no sensitive values)
- Use different Firebase projects for dev/prod
- Rotate API keys regularly
- Use least-privilege Firebase security rules
- Document all required environment variables

### ❌ DON'T:
- Commit `.env.development`, `.env.staging`, or `.env.production` to Git
- Share production credentials in development
- Hardcode any sensitive values in source code
- Use production Firebase project during development
- Leave default/example values in production

## Firebase Configuration Notes

### Client API Keys Are Public
Firebase client API keys (used in `firebaseConfig`) are **meant to be public** and included in mobile apps. Security is enforced through:
- Firebase Security Rules (database access control)
- Firebase Authentication (user identity verification)
- App Check (prevent abuse from unauthorized apps)

### Still Use Environment Variables Because:
1. **Environment Separation**: Different Firebase projects for dev/prod
2. **Easy Configuration**: Change backend without code changes
3. **Team Collaboration**: Each developer can use their own Firebase project
4. **CI/CD Integration**: Automated builds can inject correct credentials

## Troubleshooting

### "Firebase configuration is missing"
**Solution**: Ensure `.env.development` exists and contains all required Firebase variables. Check that variables are prefixed with `FIREBASE_`.

### "Cannot find module 'dotenv'"
**Solution**: Run `npm install` to install dependencies.

### Environment variables not updating
**Solution**:
1. Kill the Metro bundler
2. Clear cache: `npx expo start --clear`
3. Restart the app

### Variables showing as undefined
**Solution**:
1. Check `app.config.ts` exports the variable in `extra` object
2. Verify environment file has the correct variable name
3. Ensure no typos in variable names
4. Check that you're accessing via `Constants.expoConfig.extra`

## Firebase Projects Setup

### Development Environment
- **Project**: `nice-ripple-456414-c0` (Current)
- **Purpose**: Development and testing
- **Database**: `nice-ripple-456414-c0-default-rtdb.asia-southeast1.firebasedatabase.app`

### Production Environment (TODO)
- **Project**: Create separate production Firebase project
- **Purpose**: Live user data
- **Database**: Configure separate production database
- **Security**: Stricter security rules, monitoring enabled

## Current Status

✅ **Completed**:
- Environment variable infrastructure setup
- `.env` files created for development and production
- `app.config.ts` configured to load environment variables
- Firebase config updated to use Constants
- API config updated to use Constants
- `.gitignore` updated to exclude sensitive files
- Documentation created

⚠️ **TODO**:
- [ ] Create separate production Firebase project
- [ ] Update `.env.production` with production credentials
- [ ] Configure Google OAuth for production
- [ ] Set up CI/CD environment variable injection
- [ ] Test builds with different environments

## References

- [Expo Constants Documentation](https://docs.expo.dev/versions/latest/sdk/constants/)
- [Expo Environment Variables](https://docs.expo.dev/guides/environment-variables/)
- [Firebase Security Best Practices](https://firebase.google.com/docs/rules)
