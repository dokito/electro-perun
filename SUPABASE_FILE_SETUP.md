## Setting Up File Attachments in Supabase

### Step 1: Create Storage Bucket

1. Go to your Supabase dashboard
2. Navigate to **Storage** (left sidebar)
3. Click **Create a new bucket**
4. Name it: `booking-attachments`
5. Keep it **Private** (access controlled)
6. Click **Create**

### Step 2: Run SQL to Create Attachments Table

Go to **SQL Editor** and run this:

```sql
-- Create attachments table
CREATE TABLE booking_attachments (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  uploaded_at TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);

-- Create index for faster queries
CREATE INDEX idx_booking_attachments_booking_id ON booking_attachments(booking_id);

-- Enable real-time for attachments
ALTER TABLE booking_attachments REPLICA IDENTITY FULL;
```

### Step 3: Configure Storage Policy

In your Supabase dashboard:

1. Go to **Storage** → **booking-attachments**
2. Click **Policies** (top right)
3. Click **New Policy** → **From Template** → **Enable insert for authenticated users**
4. Click **Review**
5. Under "Authenticated users can insert into storage.objects" - modify the policy to:

```sql
POLICY "Enable insert for authenticated users"
ON storage.objects
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'booking-attachments'
);
```

6. For reading files (admin panel):

```sql
POLICY "Allow public access to booking attachments"
ON storage.objects
AS PERMISSIVE
FOR SELECT
TO public
USING (
  bucket_id = 'booking-attachments'
);
```

### Step 4: Update Your Booking Schema (Optional)

If you want to track attachments count directly on bookings:

```sql
ALTER TABLE bookings ADD COLUMN attachments_count INTEGER DEFAULT 0;
ALTER TABLE bookings ADD COLUMN has_attachments BOOLEAN DEFAULT FALSE;
```

### File Compression Details

**Images:**

- Automatically resized to max 2048px width/height
- Compressed to ≤2MB
- Supported: JPEG, PNG, WebP
- Typical compression: 50-80% size reduction

**PDFs & Documents:**

- No automatic compression (client-side compression is complex)
- Limited to 10MB per file
- Supported: PDF, Word (.doc, .docx)
- Users should compress before upload

**Total Limits:**

- 10MB per file
- 50MB total per booking
- Prevents storage bloat and ensures quick uploads
