# Supabase Setup Guide

This guide walks you through setting up Supabase for your ElektroTehnik booking system.

## 1. Create a Supabase Account

1. Go to [supabase.com](https://supabase.com)
2. Click "Start Your Project"
3. Sign up with email or GitHub
4. Create a new organization & project

## 2. Get Your Credentials

1. In your Supabase dashboard, go to **Settings** → **API**
2. Copy:
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon public` key → `VITE_SUPABASE_ANON_KEY`

## 3. Create Tables

In **SQL Editor**, run this SQL to create the required tables:

```sql
-- Bookings table
CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  service TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Enable real-time for bookings
ALTER TABLE bookings REPLICA IDENTITY FULL;

-- Offers table
CREATE TABLE offers (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  price TEXT,
  active BOOLEAN DEFAULT TRUE,
  items JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Enable real-time for offers
ALTER TABLE offers REPLICA IDENTITY FULL;

-- Create indexes for better performance
CREATE INDEX idx_bookings_created_at ON bookings(created_at DESC);
CREATE INDEX idx_offers_active ON offers(active);
```

## 4. Add Your Credentials

1. Create a `.env` file in your project root (same level as `package.json`):

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

2. Add `.env` to `.gitignore` to avoid exposing credentials

## 5. Start Your Dev Server

```bash
npm run dev
```

The app will now use Supabase!

## 6. Admin Authentication (Optional)

The admin panel still uses a hardcoded password. To secure it with Supabase Auth:

1. In Supabase → **Authentication** → **Settings**
2. Enable Email Provider
3. Update the admin login logic in `src/App.tsx`

## 7. Common Issues

**"Missing Supabase environment variables"**

- Make sure `.env` file exists
- Check you copied the credentials correctly
- Restart your dev server after adding `.env`

**"Table not found" error**

- Make sure you ran the SQL setup scripts
- Check table names match exactly (case-sensitive)

**Real-time not working**

- Ensure `REPLICA IDENTITY FULL` is set for both tables
- Check your Supabase plan allows real-time (free tier is limited)

## 8. Database Schema

### Bookings Table

- **id**: Unique identifier (string)
- **name**: Customer name
- **phone**: Contact phone
- **email**: Contact email (optional)
- **service**: Service type selected
- **date**: Preferred date (YYYY-MM-DD)
- **time**: Preferred time slot
- **message**: Additional notes (optional)
- **status**: pending, confirmed, completed, or cancelled
- **created_at**: Timestamp of submission

### Offers Table

- **id**: Unique identifier (string)
- **title**: Offer name
- **description**: Offer details
- **price**: Price string (e.g., "150 BGN")
- **active**: Whether to show on website
- **items**: JSON array of offer items
- **created_at**: Timestamp of creation
