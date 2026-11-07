## File Attachments Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                          │
│                   (FileUpload Component)                        │
│  - Drag & drop zone                                             │
│  - File selection dialog                                        │
│  - Real-time progress tracking                                  │
│  - Error messages                                               │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
           ┌─────────────┐
           │  Browser    │ (client-side)
           │ Compression │
           │  (Images)   │
           └────┬────────┘
                │
    ┌───────────┴──────────────┐
    │                          │
    ▼ Original Size            ▼ Compressed Size
   (5MB)                       (800KB)
    │                          │
    ├──────────────────────────┤
    │ File Validation          │
    │ - Type check             │
    │ - Size limit (10MB)      │
    │ - Total limit (50MB)     │
    └────────┬─────────────────┘
             │
             ▼
   ┌──────────────────────────────────┐
   │  Supabase Storage Upload         │
   │  (src/lib/fileUpload.ts)         │
   │  uploadFileToSupabase()          │
   └────────┬─────────────────────────┘
            │
            ▼
   ┌──────────────────────────────────┐
   │  Supabase Storage Bucket         │
   │  "booking-attachments"           │
   │  /bookings/{id}/{file.uuid}      │
   └────────┬─────────────────────────┘
            │
     ┌──────┴──────┐
     │             │
     ▼             ▼
   File        Public URL
   Binary      (for access)
     │             │
     └──────┬──────┘
            │
            ▼
   ┌──────────────────────────────────┐
   │  Database Record                 │
   │  booking_attachments table       │
   │  (src/lib/supabase.ts)           │
   │  saveAttachment()                │
   └──────────────────────────────────┘
```

## Component File Structure

```
src/
├── components/
│   └── FileUpload.tsx          ← Complete UI component
│       ├── Drag & drop
│       ├── File browser
│       ├── Progress tracking
│       └── Validation feedback
│
├── lib/
│   ├── fileUpload.ts           ← Utilities for file handling
│   │   ├── validateFile()
│   │   ├── compressImage()
│   │   ├── prepareFile()
│   │   ├── uploadFileToSupabase()
│   │   ├── deleteFileFromSupabase()
│   │   └── Helper functions
│   │
│   ├── supabase.ts             ← Database integration
│   │   ├── saveAttachment()        (NEW)
│   │   ├── loadAttachmentsForBooking() (NEW)
│   │   ├── deleteAttachment()      (NEW)
│   │   └── [existing functions]
│   │
│   └── booking.ts              ← Form types
│       └── BookingFormValues   ← Updated type
│
└── App.tsx                      ← Add <FileUpload /> here
```

## Data Flow Diagram

```
1. USER SELECTS FILE
   ↓
2. FILE VALIDATION
   - Type check
   - Size check (10MB max)
   - Total check (50MB max)
   ↓
3. COMPRESSION (for images only)
   - browser-image-compression
   - Max 2MB, 2048px
   - Savings: 50-80%
   ↓
4. UPLOAD TO SUPABASE
   - POST to storage bucket
   - Returns public URL
   ↓
5. LINK TO BOOKING
   - Create DB record in booking_attachments
   - Store metadata (name, size, type, URL)
   ↓
6. DISPLAY IN ADMIN
   - Load attachments for booking
   - Show with links
```

## File Compression Savings Example

```
SCENARIO: Photography Business with 100 Bookings

WITHOUT COMPRESSION:
├── Booking 1: Customer sends 10MB photo
├── Booking 2: Customer sends 10MB photo
├── Booking 3: Customer sends 10MB photo
├─ ...
└── Booking 100: 10MB photo
────────────────────────────
Total Storage: ~1GB
Monthly Cost: FREE (under 1GB limit)

WITH COMPRESSION:
├── Booking 1: Photo compressed 10MB → 1.5MB
├── Booking 2: Photo compressed 10MB → 1.5MB
├── Booking 3: Photo compressed 10MB → 1.5MB
├─ ...
└── Booking 100: 1.5MB
────────────────────────────
Total Storage: ~150MB
Monthly Cost: FREE (under 1GB limit)
SAVINGS: 850MB storage, potential future cost reduction
```

## Image Compression Details

```
BROWSER-IMAGE-COMPRESSION LIBRARY

Input:  ┌─────────────────────┐
        │ Large Image File    │
        │ 5000×3000px         │
        │ 8MB                 │
        └────────┬────────────┘
                 │
                 ├→ Quality Reduction
                 ├→ Width/Height Resize (2048px max)
                 ├→ Format Optimization
                 └→ Progressive JPEG

Output: ┌─────────────────────┐
        │ Optimized Image     │
        │ 2000×1200px         │
        │ 1.2MB               │
        └─────────────────────┘

COMPRESSION RATIO: ~85% smaller
TIME: 1-15 seconds (depends on image size)
QUALITY: Still looks great at 2048px max
```

## Security Model

```
AUTHENTICATION:
├── Upload: Requires auth token
│   └── Only logged-in users (or public via policy)
│
└── Download: Public or restricted
    └── Anyone can view with URL (or restricted)

STORAGE STRUCTURE:
bookings/
├── booking-001/
│   ├── file-1-uuid.jpg
│   ├── file-2-uuid.pdf
│   └── file-3-uuid.docx
├── booking-002/
│   ├── file-1-uuid.jpg
│   └── file-2-uuid.pdf
└── booking-003/
    └── file-1-uuid.jpg

ISOLATION:
- Each booking has own folder
- Prevents file name collisions
- Easy to delete with CASCADE
- Clear ownership
```

## Database Schema

```
booking_attachments (NEW TABLE)
├── id: TEXT (primary key, e.g., "1731234567890-abc123")
├── booking_id: TEXT (foreign key → bookings.id)
├── file_name: TEXT (original filename)
├── file_size: INTEGER (bytes)
├── file_type: TEXT (MIME type)
├── storage_path: TEXT (path in bucket)
├── url: TEXT (public access URL)
└── uploaded_at: TIMESTAMP (ISO 8601)

EXAMPLE ROW:
{
  id: "1731234567890-abc123",
  booking_id: "booking-001",
  file_name: "electrical_issue.jpg",
  file_size: 1500000,
  file_type: "image/jpeg",
  storage_path: "bookings/booking-001/1731234567890-abc123.jpg",
  url: "https://[project].supabase.co/storage/v1/object/...",
  uploaded_at: "2024-11-10T14:30:22Z"
}

INDICES:
- idx_booking_attachments_booking_id
  └── For fast lookups of attachments by booking

CONSTRAINTS:
- Foreign key CASCADE
  └── When booking deleted, attachments deleted too
```

## Performance Characteristics

```
IMAGE COMPRESSION
├── Small (< 2MB): ~1-2 seconds
├── Medium (2-5MB): ~3-5 seconds
└── Large (5-10MB): ~8-15 seconds

UPLOAD
├── Small (< 2MB): ~1-2 seconds
├── Medium (2-10MB): ~2-10 seconds
└── Large (10-50MB): ~10-30 seconds

(Times vary based on network speed)

DATABASE OPERATIONS
├── Save attachment: ~5-10ms
├── Load attachments: ~5-20ms (per booking)
└── Delete attachment: ~5-10ms
```

## Error Handling Flowchart

```
FILE SELECTED
    ↓
┌─────────────────────┐
│ Validate file type? │
└────┬────────────────┘
     │
   NO├─→ Show error: "File type not allowed"
     │   └─→ User selects different file
     │
   YES
     ↓
┌──────────────────────┐
│ File ≤ 10MB?         │
└────┬─────────────────┘
     │
   NO├─→ Show error: "File too large"
     │   └─→ User removes file
     │
   YES
     ↓
┌──────────────────────┐
│ Total ≤ 50MB?        │
└────┬─────────────────┘
     │
   NO├─→ Show error: "Total size exceeds limit"
     │   └─→ User removes previous files
     │
   YES
     ↓
┌──────────────────────┐
│ Is image?            │
└────┬─────────────────┘
     │
    YES├─→ Compress image
     │   └─→ Continue
     │
    NO
     │
     ↓
┌──────────────────────┐
│ Upload to Supabase   │
└────┬─────────────────┘
     │
    NO├─→ Show error: "Upload failed"
     │   └─→ User retries
     │
   YES
     ↓
  SUCCESS: File added to list
```

## Next Steps Checklist

- [ ] Run `pnpm install`
- [ ] Create Supabase storage bucket
- [ ] Run database migration SQL
- [ ] Configure storage policies
- [ ] Add FileUpload component to your form
- [ ] Test with sample images
- [ ] Test with PDFs
- [ ] Test with slow network (DevTools throttling)
- [ ] Configure admin panel to display files
- [ ] Deploy to production
