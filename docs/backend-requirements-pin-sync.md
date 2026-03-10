# Backend Requirements: Conversation Pin Sync

## Overview
The frontend has been fully implemented to support pinning conversations. Backend endpoints are needed to persist pin state across devices and app restarts.

## Database Changes Required

### Add Columns to `matches` Table

```sql
ALTER TABLE matches ADD COLUMN user1_pinned BOOLEAN DEFAULT FALSE;
ALTER TABLE matches ADD COLUMN user2_pinned BOOLEAN DEFAULT FALSE;
```

**Explanation**: Each user in a match can independently pin/unpin the conversation. `user1_pinned` tracks if user1 has pinned, `user2_pinned` tracks if user2 has pinned.

## API Endpoints Required

### 1. Pin a Match

**Endpoint**: `POST /matches/:matchId/pin`

**Auth**: Required (JWT)

**Request**: Empty body `{}`

**Success Response** (200):
```json
{
  "success": true,
  "message": "Match pinned successfully",
  "data": null
}
```

**Error Responses**:
- 401: Unauthorized (invalid/missing JWT)
- 404: Match not found
- 403: User is not part of this match

**Implementation Logic**:
1. Verify user is authenticated
2. Verify match exists and user is participant (either user1 or user2)
3. Determine if authenticated user is user1 or user2 in the match
4. Set `user1_pinned = TRUE` or `user2_pinned = TRUE` accordingly
5. Return success response

---

### 2. Unpin a Match

**Endpoint**: `DELETE /matches/:matchId/unpin`

**Auth**: Required (JWT)

**Success Response** (200):
```json
{
  "success": true,
  "message": "Match unpinned successfully",
  "data": null
}
```

**Error Responses**:
- 401: Unauthorized
- 404: Match not found
- 403: User is not part of this match

**Implementation Logic**:
1. Verify user is authenticated
2. Verify match exists and user is participant
3. Determine if authenticated user is user1 or user2
4. Set `user1_pinned = FALSE` or `user2_pinned = FALSE` accordingly
5. Return success response

---

### 3. Update GET /matches Endpoint

**Endpoint**: `GET /matches`

**Current Response**: Already returns matches with user data

**Required Addition**: Add `is_pinned` field to each match object

**Updated Response Example**:
```json
{
  "success": true,
  "data": {
    "matches": [
      {
        "match_id": "match123",
        "conversation_id": "conv456",
        "user": {
          "user_id": "user789",
          "name": "Jane Doe",
          "age": 28,
          "primary_photo": "https://...",
          "is_verified": true,
          "is_online": false
        },
        "matched_at": "2024-01-15T10:30:00Z",
        "is_active": true,
        "is_pinned": true,  // ← NEW FIELD
        "last_message": {
          "message_id": "msg123",
          "content": "Hey there!",
          "sent_at": "2024-01-15T12:00:00Z",
          "is_from_me": false
        },
        "unread_count": 2
      }
    ],
    "total": 15
  }
}
```

**Implementation Logic**:
1. For each match, determine if authenticated user is user1 or user2
2. If user is user1, return `match.user1_pinned` as `is_pinned`
3. If user is user2, return `match.user2_pinned` as `is_pinned`
4. Ensure `is_pinned` is a boolean (not null)

---

## Frontend Integration Status

✅ **Frontend Implementation Complete**:
- API endpoints configured: `src/config/api.config.ts`
- Service functions created: `src/services/interactions.service.ts`
  - `pinMatch(matchId: string)`
  - `unpinMatch(matchId: string)`
- Context functions added: `src/context/MatchesContext.tsx`
  - Optimistic UI updates
  - Error handling with rollback
- UI integration: `src/screens/chat/MatchesListScreen.tsx`
  - Long-press to pin/unpin
  - Visual pin indicator
  - Sorting (pinned matches at top)
- Type definitions updated: `src/types/index.ts`
  - `ApiMatch.is_pinned: boolean`
  - `Match.isPinned: boolean`

**Behavior**:
- Frontend makes optimistic UI updates (instant feedback)
- If API call fails, UI reverts the change
- Error message shown to user on failure

---

## Testing Requirements

### Manual Testing Checklist

**After Backend Implementation**:

1. **Pin a Conversation**:
   - [ ] Long-press any conversation → Pin
   - [ ] Verify conversation moves to "Pinned" section
   - [ ] Verify pin icon appears next to name
   - [ ] Close and reopen app → Pin persists

2. **Unpin a Conversation**:
   - [ ] Long-press pinned conversation → Unpin
   - [ ] Verify conversation moves to appropriate section
   - [ ] Pin icon removed

3. **Multi-Device Sync**:
   - [ ] Pin conversation on Device A
   - [ ] Login on Device B
   - [ ] Verify conversation is pinned on Device B

4. **Error Handling**:
   - [ ] Test with invalid match ID → 404 error
   - [ ] Test without auth token → 401 error
   - [ ] Test pinning someone else's match → 403 error

5. **Edge Cases**:
   - [ ] Pin multiple conversations (5+) → All show in pinned section
   - [ ] Pin conversation, then unmatch → Pin state should be cleared
   - [ ] Pin conversation with no messages → Should work

---

## Implementation Priority

**Priority**: HIGH (after CRITICAL userId fix)

**Reason**: Pin state is currently local-only and lost on app restart. Users expect this data to persist.

**Dependencies**: None (backend can implement independently)

**Estimated Backend Effort**: 2-3 hours
- Database migration: 15 minutes
- Endpoint implementation: 1.5 hours
- Testing: 1 hour

---

## Questions for Backend Team

1. **Match ID Format**: Confirm match ID format (UUID, ObjectId, etc.)
2. **Rate Limiting**: Should we rate-limit pin/unpin requests? (Suggestion: 10 per minute)
3. **Indexing**: Should we add database index on `user1_pinned` and `user2_pinned` columns?
4. **Analytics**: Should we track pin/unpin events for product analytics?

---

## Contact

Frontend implementation complete by: Claude Sonnet 4.5
Questions: Reference this document or frontend code implementation
