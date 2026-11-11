import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Check your .env file.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled";

/* ─── Authentication ──────────────────────────────────────── */

export async function signInWithEmail(email: string, password: string) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return { user: data.user, session: data.session, error: null };
  } catch (err) {
    console.error("Error signing in:", err);
    return { user: null, session: null, error: err };
  }
}

export async function signUpWithEmail(email: string, password: string) {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;
    return { user: data.user, session: data.session, error: null };
  } catch (err) {
    console.error("Error signing up:", err);
    return { user: null, session: null, error: err };
  }
}

export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { error: null };
  } catch (err) {
    console.error("Error signing out:", err);
    return { error: err };
  }
}

export async function getCurrentUser() {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return { user: data.user, error: null };
  } catch (err) {
    console.error("Error getting user:", err);
    return { user: null, error: err };
  }
}

export function onAuthStateChange(callback: (user: any) => void) {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });

  return () => subscription?.unsubscribe();
}

export interface OfferItem {
  id: string;
  text: string;
}

const normalizeBooking = (row: any): Booking => ({
  ...row,
  message: row.message ?? "",
  createdAt: row.createdAt ?? row.created_at ?? new Date().toISOString(),
  attachmentsCount:
    row.attachmentsCount ??
    row.attachments_count ??
    row.attachments?.length ??
    0,
  hasAttachments:
    row.hasAttachments ??
    row.has_attachments ??
    !!(
      row.attachmentsCount ??
      row.attachments_count ??
      row.attachments?.length ??
      0
    ),
});

const normalizeOffer = (row: any): Offer => {
  const rawItems = (() => {
    if (Array.isArray(row.items)) return row.items;
    if (typeof row.items === "string") {
      try {
        const parsed = JSON.parse(row.items);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    if (row.items && typeof row.items === "object") {
      return Object.values(row.items);
    }
    return [];
  })();

  return {
    ...row,
    description: row.description ?? "",
    price: row.price ?? "",
    active: row.active ?? true,
    createdAt: row.createdAt ?? row.created_at ?? new Date().toISOString(),
    items: rawItems.map((item: any, index: number) => ({
      id: item?.id ?? `item-${index}`,
      text: item?.text ?? item,
    })),
  };
};

export interface Booking {
  id: string;
  name: string;
  phone: string;
  email: string;
  service: string;
  date: string;
  time: string;
  message?: string;
  status: BookingStatus;
  createdAt: string;
  attachmentsCount?: number;
  hasAttachments?: boolean;
}

export interface Offer {
  id: string;
  title: string;
  description: string;
  price: string;
  active: boolean;
  items: OfferItem[];
  createdAt?: string;
}

/* ─── Bookings ────────────────────────────────────────────── */

export async function loadBookings(): Promise<Booking[]> {
  try {
    const { data, error } = await supabase.from("bookings").select("*");

    if (error) throw error;
    return (data ?? [])
      .map(normalizeBooking)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  } catch (err) {
    console.error("Error loading bookings:", err);
    return [];
  }
}

export async function saveBooking(booking: Booking): Promise<Booking | null> {
  try {
    const { createdAt, ...bookingWithoutDate } = booking;
    const row = {
      ...bookingWithoutDate,
      created_at: createdAt,
    };
    const { data, error } = await supabase
      .from("bookings")
      .insert([row])
      .select()
      .single();

    if (error) throw error;
    return data ? normalizeBooking(data) : null;
  } catch (err) {
    console.error("Error saving booking:", err);
    return null;
  }
}

export async function updateBooking(
  id: string,
  updates: Partial<Booking>,
): Promise<Booking | null> {
  try {
    const { createdAt, ...updatesWithoutDate } = updates;
    const row = {
      ...updatesWithoutDate,
      ...(createdAt ? { created_at: createdAt } : {}),
    };
    const { data, error } = await supabase
      .from("bookings")
      .update(row)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data ? normalizeBooking(data) : null;
  } catch (err) {
    console.error("Error updating booking:", err);
    return null;
  }
}

export async function deleteBookingPermanently(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("bookings").delete().eq("id", id);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error("Error deleting booking:", err);
    return false;
  }
}

export function subscribeToBookings(
  callback: (bookings: Booking[]) => void,
): () => void {
  const channel = supabase
    .channel("bookings_changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "bookings" },
      () => {
        loadBookings().then(callback);
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/* ─── Offers ──────────────────────────────────────────────── */

export async function loadOffers(): Promise<Offer[]> {
  try {
    const { data, error } = await supabase.from("offers").select("*");

    if (error) throw error;
    return (data ?? []).map(normalizeOffer).sort((a, b) => {
      const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
      const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
      return bTime - aTime;
    });
  } catch (err) {
    console.error("Error loading offers:", err);
    return [];
  }
}

export async function saveOffer(offer: Offer): Promise<Offer | null> {
  try {
    const { createdAt, ...offerWithoutDate } = offer;
    const row = {
      ...offerWithoutDate,
      items: Array.isArray(offer.items) ? offer.items : [],
      created_at: createdAt || new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from("offers")
      .insert([row])
      .select()
      .single();

    if (error) throw error;
    return data ? normalizeOffer(data) : null;
  } catch (err) {
    console.error("Error saving offer:", err);
    return null;
  }
}

export async function updateOffer(
  id: string,
  updates: Partial<Offer>,
): Promise<Offer | null> {
  try {
    const { createdAt, ...updatesWithoutDate } = updates;
    const row = {
      ...updatesWithoutDate,
      ...(createdAt && { created_at: createdAt }),
      items: updates.items ?? undefined,
    };
    const { data, error } = await supabase
      .from("offers")
      .update(row)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data ? normalizeOffer(data) : null;
  } catch (err) {
    console.error("Error updating offer:", err);
    return null;
  }
}

export async function deleteOffer(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("offers").delete().eq("id", id);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error("Error deleting offer:", err);
    return false;
  }
}

export function subscribeToOffers(
  callback: (offers: Offer[]) => void,
): () => void {
  const channel = supabase
    .channel("offers_changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "offers" },
      () => {
        loadOffers().then(callback);
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/* ─── File Attachments ────────────────────────────────────── */

export interface BookingAttachment {
  id: string;
  booking_id: string;
  file_name: string;
  file_size: number;
  file_type: string;
  storage_path: string;
  url: string;
  uploaded_at: string;
}

export async function saveAttachment(
  attachment: Omit<BookingAttachment, "uploaded_at">,
): Promise<BookingAttachment | null> {
  try {
    const { data, error } = await supabase
      .from("booking_attachments")
      .insert([attachment])
      .select()
      .single();

    if (error) throw error;

    // Update booking's attachments_count and has_attachments
    try {
      const bookingId = attachment.booking_id;
      // Count attachments for booking
      const { data: list } = await supabase
        .from("booking_attachments")
        .select("id", { count: "exact" })
        .eq("booking_id", bookingId);

      const count = Array.isArray(list) ? list.length : 0;

      await supabase
        .from("bookings")
        .update({ attachments_count: count, has_attachments: count > 0 })
        .eq("id", bookingId);
    } catch (e) {
      // Non-fatal: log and continue
      console.error("Error updating booking attachment count:", e);
    }

    return data ?? null;
  } catch (err) {
    console.error("Error saving attachment:", err);
    return null;
  }
}

export async function loadAttachmentsForBooking(
  bookingId: string,
): Promise<BookingAttachment[]> {
  try {
    const { data, error } = await supabase
      .from("booking_attachments")
      .select("*")
      .eq("booking_id", bookingId)
      .order("uploaded_at", { ascending: false });

    if (error) throw error;
    return data ?? [];
  } catch (err) {
    console.error("Error loading attachments:", err);
    return [];
  }
}

export async function deleteAttachment(attachmentId: string): Promise<boolean> {
  try {
    // Delete and return deleted row to find booking_id
    const { data: deleted, error } = await supabase
      .from("booking_attachments")
      .delete()
      .eq("id", attachmentId)
      .select()
      .single();

    if (error) throw error;

    try {
      const bookingId = deleted?.booking_id;
      if (bookingId) {
        const { data: list } = await supabase
          .from("booking_attachments")
          .select("id")
          .eq("booking_id", bookingId);

        const count = Array.isArray(list) ? list.length : 0;
        await supabase
          .from("bookings")
          .update({ attachments_count: count, has_attachments: count > 0 })
          .eq("id", bookingId);
      }
    } catch (e) {
      console.error("Error updating booking attachment count after delete:", e);
    }

    return true;
  } catch (err) {
    console.error("Error deleting attachment:", err);
    return false;
  }
}

/**
 * Create a signed URL for a storage object (useful for private buckets)
 */
export async function createSignedUrl(
  bucketId: string,
  path: string,
  expiresIn = 60 * 60,
): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from(bucketId)
      .createSignedUrl(path, expiresIn);

    if (error) throw error;
    return data?.signedUrl ?? null;
  } catch (err) {
    console.error("Error creating signed URL:", err);
    return null;
  }
}

/* ─── Business Schedule ───────────────────────────────────── */

export interface BusinessSchedule {
  id: string;
  schedule_data: Record<string, string[]>;
  updated_at?: string;
}

export async function loadBusinessSchedule(): Promise<
  Record<string, string[]>
> {
  try {
    const { data, error } = await supabase
      .from("business_schedule")
      .select("schedule_data")
      .maybeSingle();

    if (error && error.code !== "PGRST116") throw error;

    if (!data?.schedule_data || typeof data.schedule_data !== "object") {
      return {};
    }

    return data.schedule_data as Record<string, string[]>;
  } catch (err) {
    console.error("Error loading business schedule:", err);
    return {};
  }
}

export async function saveBusinessSchedule(
  schedule: Record<string, string[]>,
): Promise<boolean> {
  try {
    const payload = {
      id: "default",
      schedule_data: schedule,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("business_schedule")
      .upsert(payload, { onConflict: "id" });

    if (error) throw error;
    return true;
  } catch (err) {
    console.error("Error saving business schedule:", err);
    return false;
  }
}
