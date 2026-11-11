import { useEffect, useState, type FormEvent } from "react";
import {
  ALL_DAY_BLOCK,
  DEFAULT_WORKING_TIME_SLOTS,
  addDaysToDate,
  copyBlockedDayToDate,
  generateCalendarDays,
  getDayScheduleSummary,
  loadBlockedTimeSlots,
  saveBlockedTimeSlots,
  setDateRangeBlocked,
  type DayScheduleMap,
} from "../lib/booking";
import {
  loadBookings,
  loadOffers,
  saveOffer,
  updateOffer,
  deleteOffer,
  subscribeToBookings,
  subscribeToOffers,
  signInWithEmail,
  signOut as supabaseSignOut,
  getCurrentUser,
  onAuthStateChange,
  type Booking,
  type BookingStatus,
  loadAttachmentsForBooking,
  deleteAttachment,
  createSignedUrl,
  deleteBookingPermanently,
  type Offer,
  type OfferItem,
  updateBooking,
  type BookingAttachment,
  loadBusinessSchedule,
  saveBusinessSchedule,
} from "../lib/supabase";
import { formatFileSize, getFileIcon } from "../lib/fileUpload";
import { deleteFileFromStorage } from "../lib/storageUtils";

const STATUS_COLORS: Record<BookingStatus, string> = {
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  confirmed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  completed: "bg-green-500/20 text-green-400 border-green-500/30",
  cancelled: "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function AdminPanel({ onExit }: { onExit: () => void }) {
  const [authed, setAuthed] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [tab, setTab] = useState<"bookings" | "offers" | "items" | "schedule">(
    "bookings",
  );
  const [loading, setLoading] = useState(true);

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [attachmentsMap, setAttachmentsMap] = useState<
    Record<string, BookingAttachment[]>
  >({});
  const [attachmentsLoading, setAttachmentsLoading] = useState<
    Record<string, boolean>
  >({});
  const [offers, setOffers] = useState<Offer[]>([]);
  const [selectedOffer, setSelectedOffer] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<DayScheduleMap>({});
  const [selectedScheduleDate, setSelectedScheduleDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [rangeStartDate, setRangeStartDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [rangeEndDate, setRangeEndDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [copyTargetDate, setCopyTargetDate] = useState(
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  );

  const [offerForm, setOfferForm] = useState({
    title: "",
    description: "",
    price: "",
    active: true,
  });
  const [newItemText, setNewItemText] = useState("");
  const [editingOffer, setEditingOffer] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { user } = await getCurrentUser();
      if (user) setAuthed(true);
    };
    checkAuth();

    const unsubscribe = onAuthStateChange((user) => {
      setAuthed(!!user);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!authed) return;

    const initData = async () => {
      setLoading(true);
      const [bookingsData, offersData, sharedSchedule] = await Promise.all([
        loadBookings(),
        loadOffers(),
        loadBusinessSchedule(),
      ]);
      setBookings(bookingsData);
      setOffers(offersData);
      const localSchedule = loadBlockedTimeSlots();
      setSchedule(
        Object.keys(sharedSchedule).length > 0 ? sharedSchedule : localSchedule,
      );
      setLoading(false);
    };

    initData();

    const unsubBookings = subscribeToBookings(setBookings);
    const unsubOffers = subscribeToOffers(setOffers);

    return () => {
      unsubBookings();
      unsubOffers();
    };
  }, [authed]);

  const selectedSummary = getDayScheduleSummary(
    selectedScheduleDate,
    bookings,
    schedule,
  );
  const calendarDates = generateCalendarDays(30);

  function toggleBlockedSlot(date: string, slot: string) {
    setSchedule((current) => {
      const currentSlots = current[date] ?? [];
      const nextSlots = currentSlots.includes(slot)
        ? currentSlots.filter((currentSlot) => currentSlot !== slot)
        : [...currentSlots, slot];

      const updated = { ...current };
      if (nextSlots.length > 0) {
        updated[date] = nextSlots;
      } else {
        delete updated[date];
      }

      saveBlockedTimeSlots(updated);
      void saveBusinessSchedule(updated);
      return updated;
    });
  }

  function toggleFullDayBlock(date: string) {
    setSchedule((current) => {
      const updated = { ...current };
      const currentSlots = updated[date] ?? [];
      const isBlocked = currentSlots.includes(ALL_DAY_BLOCK);

      if (isBlocked) {
        delete updated[date];
      } else {
        updated[date] = [ALL_DAY_BLOCK];
      }

      saveBlockedTimeSlots(updated);
      void saveBusinessSchedule(updated);
      return updated;
    });
  }

  function blockDateRange(startDate: string, endDate: string) {
    if (!startDate || !endDate) return;

    setSchedule((current) => {
      const updated = setDateRangeBlocked(current, startDate, endDate);
      saveBlockedTimeSlots(updated);
      void saveBusinessSchedule(updated);
      return updated;
    });
  }

  function copyBlockedSchedule(sourceDate: string, targetDate: string) {
    if (!sourceDate || !targetDate) return;

    setSchedule((current) => {
      const updated = copyBlockedDayToDate(current, sourceDate, targetDate);
      saveBlockedTimeSlots(updated);
      void saveBusinessSchedule(updated);
      return updated;
    });
  }

  function resetDaySchedule(date: string) {
    setSchedule((current) => {
      const updated = { ...current };
      delete updated[date];
      saveBlockedTimeSlots(updated);
      void saveBusinessSchedule(updated);
      return updated;
    });
  }

  function resetAllSchedule() {
    setSchedule((current) => {
      const updated = {};
      saveBlockedTimeSlots(updated);
      void saveBusinessSchedule(updated);
      return updated;
    });
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");

    const { error } = await signInWithEmail(email, password);
    if (error) {
      setAuthError(
        error instanceof Error
          ? error.message
          : "Failed to sign in. Check your email and password.",
      );
    } else {
      setEmail("");
      setPassword("");
    }
    setAuthLoading(false);
  }

  async function handleLogout() {
    await supabaseSignOut();
    setAuthed(false);
    onExit();
  }

  async function updateBookingStatus(id: string, status: BookingStatus) {
    const updated = await updateBooking(id, { status });
    if (updated) {
      setBookings((current) =>
        current.map((booking) =>
          booking.id === id ? { ...booking, ...updated } : booking,
        ),
      );
    }
  }

  async function deleteBooking(id: string) {
    if (!confirm("Delete this booking permanently?")) return;

    try {
      console.log("[deleteBooking] Starting deletion for booking:", id);

      // 1. Load attachments for this booking
      const attachments = await loadAttachmentsForBooking(id);
      console.log("[deleteBooking] Found attachments:", attachments);

      // 2. Delete files from storage
      if (attachments.length > 0) {
        console.log("[deleteBooking] Deleting files from storage...");
        await Promise.all(
          attachments.map((att) => {
            console.log("[deleteBooking] Deleting file:", att.storage_path);
            return deleteFileFromStorage(
              "booking-attachments",
              att.storage_path,
            );
          }),
        );
      }

      // 3. Delete booking from database (cascades to attachments)
      console.log("[deleteBooking] Deleting booking from database...");
      const ok = await deleteBookingPermanently(id);
      if (ok) {
        setBookings((current) => current.filter((b) => b.id !== id));
        // Also clean up attachments map
        setAttachmentsMap((m) => {
          const newMap = { ...m };
          delete newMap[id];
          return newMap;
        });
        console.log("[deleteBooking] Booking deleted successfully");
      }
    } catch (err) {
      console.error("[deleteBooking] Error:", err);
      alert("Error deleting booking. Please try again.");
    }
  }

  async function createOffer() {
    if (!offerForm.title.trim()) return;
    const newOffer: Offer = {
      id: Math.random().toString(36).slice(2, 10),
      title: offerForm.title,
      description: offerForm.description,
      price: offerForm.price,
      active: offerForm.active,
      items: [],
      createdAt: new Date().toISOString(),
    };
    const created = await saveOffer(newOffer);
    if (created) {
      setOffers([...offers, created]);
      setOfferForm({ title: "", description: "", price: "", active: true });
    }
  }

  async function saveOfferEdit(id: string) {
    const updated = await updateOffer(id, {
      title: offerForm.title,
      description: offerForm.description,
      price: offerForm.price,
      active: offerForm.active,
    });
    if (updated) {
      setOffers(offers.map((o) => (o.id === id ? updated : o)));
      setEditingOffer(null);
    }
  }

  function startEditOffer(offer: Offer) {
    setEditingOffer(offer.id);
    setOfferForm({
      title: offer.title,
      description: offer.description,
      price: offer.price,
      active: offer.active,
    });
  }

  async function deleteOfferFn(id: string) {
    const deleted = await deleteOffer(id);
    if (deleted) {
      setOffers(offers.filter((o) => o.id !== id));
      if (selectedOffer === id) setSelectedOffer(null);
    }
  }

  async function toggleOfferActive(id: string) {
    const offer = offers.find((o) => o.id === id);
    if (offer) {
      const updated = await updateOffer(id, { active: !offer.active });
      if (updated) {
        setOffers(offers.map((o) => (o.id === id ? updated : o)));
      }
    }
  }

  async function addItem(offerId: string) {
    if (!newItemText.trim()) return;
    const offer = offers.find((o) => o.id === offerId);
    if (offer) {
      const newItem: OfferItem = {
        id: Math.random().toString(36).slice(2, 10),
        text: newItemText.trim(),
      };
      const updated = await updateOffer(offerId, {
        items: [...offer.items, newItem],
      });
      if (updated) {
        setOffers(offers.map((o) => (o.id === offerId ? updated : o)));
        setNewItemText("");
      }
    }
  }

  async function removeItem(offerId: string, itemId: string) {
    const offer = offers.find((o) => o.id === offerId);
    if (offer) {
      const updated = await updateOffer(offerId, {
        items: offer.items.filter((i) => i.id !== itemId),
      });
      if (updated) {
        setOffers(offers.map((o) => (o.id === offerId ? updated : o)));
      }
    }
  }

  const currentOffer = offers.find((o) => o.id === selectedOffer) ?? null;
  const pendingCount = bookings.filter((b) => b.status === "pending").length;

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#060c1a] flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-9 h-9 bg-[#f5c518] rounded flex items-center justify-center">
              <span className="text-[#060c1a] font-bold font-display text-base">
                E
              </span>
            </div>
            <span className="font-display font-700 text-xl text-white">
              Admin · ElektroTehnik
            </span>
          </div>

          <form
            onSubmit={handleLogin}
            className="bg-[#0f1830] border border-[#162040] rounded-lg p-8 space-y-5"
          >
            <h2 className="font-display font-700 text-2xl text-white">
              SIGN IN
            </h2>
            <div>
              <label className="block text-xs font-display tracking-widest uppercase text-[#8ba0c8] mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#162040] border border-[#1e2d55] rounded px-4 py-3 text-white text-sm"
                placeholder="admin@example.com"
                disabled={authLoading}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-display tracking-widest uppercase text-[#8ba0c8] mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#162040] border border-[#1e2d55] rounded px-4 py-3 text-white text-sm"
                placeholder="••••••••••••"
                disabled={authLoading}
              />
              {authError && (
                <p className="text-red-400 text-xs mt-2 font-display">
                  {authError}
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={authLoading}
              className="w-full bg-[#f5c518] text-[#060c1a] font-display font-700 text-sm tracking-wider uppercase py-3 rounded hover:bg-[#e8a000] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {authLoading ? "Signing in..." : "Enter Admin"}
            </button>
          </form>

          <button
            onClick={onExit}
            className="mt-6 text-[#3a5080] text-xs hover:text-[#8ba0c8] transition-colors font-display tracking-wider"
          >
            ← Back to site
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060c1a] text-[#c0cfe8]">
      <nav className="bg-[#0a1022] border-b border-[#162040] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-[#f5c518] rounded flex items-center justify-center">
            <span className="text-[#060c1a] font-bold font-display text-xs">
              E
            </span>
          </div>
          <span className="font-display font-700 text-white">
            ElektroTehnik
          </span>
          <span className="text-[#3a5080] font-display text-xs tracking-widest ml-1">
            / ADMIN
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleLogout}
            className="text-[#8ba0c8] text-xs font-display tracking-wider hover:text-red-400 transition-colors"
          >
            Log out
          </button>
          <span className="text-[#3a5080]">•</span>
          <button
            onClick={onExit}
            className="text-[#8ba0c8] text-xs font-display tracking-wider hover:text-white transition-colors"
          >
            ← Back to site
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex gap-1 bg-[#0a1022] border border-[#162040] rounded-lg p-1 mb-8 w-fit">
          {[
            { key: "bookings", label: "Bookings", badge: pendingCount },
            { key: "offers", label: "Offers" },
            { key: "items", label: "Offer Items" },
            { key: "schedule", label: "Schedule" },
          ].map((tabItem) => (
            <button
              key={tabItem.key}
              onClick={() =>
                setTab(
                  tabItem.key as "bookings" | "offers" | "items" | "schedule",
                )
              }
              className={`flex items-center gap-2 px-5 py-2 rounded font-display font-600 text-sm tracking-wider uppercase transition-all ${
                tab === tabItem.key
                  ? "bg-[#f5c518] text-[#060c1a]"
                  : "text-[#8ba0c8] hover:text-white"
              }`}
            >
              {tabItem.label}
              {typeof tabItem.badge === "number" && tabItem.badge > 0 && (
                <span
                  className={`text-xs rounded-full px-1.5 py-0.5 font-700 ${
                    tab === tabItem.key
                      ? "bg-[#060c1a]/20 text-[#060c1a]"
                      : "bg-yellow-500/20 text-yellow-400"
                  }`}
                >
                  {tabItem.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === "bookings" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display font-800 text-3xl text-white">
                BOOKINGS
              </h2>
              <span className="text-[#8ba0c8] text-sm">
                {bookings.length} total
              </span>
            </div>

            {bookings.length === 0 ? (
              <div className="bg-[#0f1830] border border-[#162040] rounded-lg p-12 text-center">
                <p className="text-[#3a5080] font-display text-lg">
                  No bookings yet.
                </p>
                <p className="text-[#3a5080] text-sm mt-1">
                  Submissions from the booking form appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {[...bookings].reverse().map((b) => (
                  <div
                    key={b.id}
                    className="bg-[#0f1830] border border-[#162040] rounded-lg p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-display font-700 text-white text-lg">
                            {b.name}
                          </span>
                          <span
                            className={`text-xs border rounded px-2 py-0.5 font-display tracking-wider uppercase ${STATUS_COLORS[b.status]}`}
                          >
                            {b.status}
                          </span>
                        </div>
                        <div className="text-sm text-[#8ba0c8] space-y-0.5">
                          <p>
                            📞 {b.phone}
                            {b.email && ` · ✉️ ${b.email}`}
                          </p>
                          <p>
                            🔧 {b.service} · 📅 {b.date} at {b.time}
                          </p>
                          {b.message && (
                            <p className="italic text-[#3a5080]">
                              "{b.message}"
                            </p>
                          )}
                        </div>
                        <p className="text-xs text-[#3a5080] mt-2">
                          Received: {new Date(b.createdAt).toLocaleString()}
                        </p>
                        {/* Attachments preview */}
                        {((b as any).attachmentsCount ??
                          (b as any).hasAttachments) && (
                          <div className="mt-3">
                            <button
                              onClick={async () => {
                                // toggle load attachments
                                if (attachmentsMap[b.id]) {
                                  setAttachmentsMap((m) => {
                                    const copy = { ...m };
                                    delete copy[b.id];
                                    return copy;
                                  });
                                  return;
                                }

                                setAttachmentsLoading((l) => ({
                                  ...l,
                                  [b.id]: true,
                                }));
                                try {
                                  const files = await loadAttachmentsForBooking(
                                    b.id,
                                  );
                                  // For private buckets, create signed URLs for each file
                                  const signed = await Promise.all(
                                    files.map(async (att) => {
                                      try {
                                        // Normalize storage path: strip accidental leading bucket prefix
                                        const path = att.storage_path.replace(
                                          /^booking-attachments\//,
                                          "",
                                        );
                                        const url = await createSignedUrl(
                                          "booking-attachments",
                                          path,
                                          60 * 60,
                                        );
                                        return { ...att, url: url ?? att.url };
                                      } catch (err) {
                                        return att;
                                      }
                                    }),
                                  );

                                  setAttachmentsMap((m) => ({
                                    ...m,
                                    [b.id]: signed,
                                  }));
                                } catch (err) {
                                  console.error(
                                    "Failed loading attachments:",
                                    err,
                                  );
                                } finally {
                                  setAttachmentsLoading((l) => ({
                                    ...l,
                                    [b.id]: false,
                                  }));
                                }
                              }}
                              className="text-xs font-display tracking-wider uppercase bg-[#162040] hover:bg-[#1e2d55] text-[#8ba0c8] hover:text-white border border-[#1e2d55] px-3 py-1.5 rounded transition-colors"
                            >
                              {attachmentsMap[b.id]
                                ? "Hide attachments"
                                : attachmentsLoading[b.id]
                                  ? "Loading..."
                                  : `Attachments (${(b as any).attachmentsCount ?? "?"})`}
                            </button>

                            {attachmentsMap[b.id] && (
                              <div className="mt-3 space-y-2">
                                {attachmentsMap[b.id].length === 0 ? (
                                  <div className="text-xs text-[#3a5080]">
                                    No attachments found.
                                  </div>
                                ) : (
                                  attachmentsMap[b.id].map((att) => (
                                    <div
                                      key={att.id}
                                      className="flex items-center justify-between gap-3 bg-[#081122] border border-[#0f1b36] rounded px-3 py-2"
                                    >
                                      <div className="flex items-center gap-3 min-w-0">
                                        <span className="text-lg">
                                          {getFileIcon(att.file_type)}
                                        </span>
                                        <a
                                          href={att.url}
                                          target="_blank"
                                          rel="noreferrer noopener"
                                          className="truncate text-sm text-blue-300 hover:underline"
                                        >
                                          {att.file_name}
                                        </a>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={async () => {
                                            if (!confirm("Delete attachment?"))
                                              return;
                                            console.log(
                                              "[deleteAttachment] Deleting file:",
                                              att.storage_path,
                                            );
                                            // Delete from Storage first
                                            const storageDeleteOk =
                                              await deleteFileFromStorage(
                                                "booking-attachments",
                                                att.storage_path,
                                              );
                                            console.log(
                                              "[deleteAttachment] Storage delete result:",
                                              storageDeleteOk,
                                            );

                                            // Then delete DB record
                                            const dbDeleteOk =
                                              await deleteAttachment(att.id);
                                            console.log(
                                              "[deleteAttachment] DB delete result:",
                                              dbDeleteOk,
                                            );

                                            if (dbDeleteOk) {
                                              setAttachmentsMap((m) => ({
                                                ...m,
                                                [b.id]:
                                                  m[b.id]?.filter(
                                                    (x) => x.id !== att.id,
                                                  ) ?? [],
                                              }));
                                              // refresh bookings list counts
                                              const updated =
                                                await loadBookings();
                                              setBookings(updated);
                                            }
                                          }}
                                          className="text-xs text-red-400 hover:text-red-300"
                                        >
                                          Delete
                                        </button>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {(
                          [
                            "pending",
                            "confirmed",
                            "completed",
                            "cancelled",
                          ] as BookingStatus[]
                        )
                          .filter((s) => s !== b.status)
                          .map((s) => (
                            <button
                              key={s}
                              onClick={() => updateBookingStatus(b.id, s)}
                              className="text-xs font-display tracking-wider uppercase bg-[#162040] hover:bg-[#1e2d55] text-[#8ba0c8] hover:text-white border border-[#1e2d55] px-3 py-1.5 rounded transition-colors"
                            >
                              → {s}
                            </button>
                          ))}
                        <button
                          onClick={() => deleteBooking(b.id)}
                          className="text-xs font-display tracking-wider uppercase bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/30 px-3 py-1.5 rounded transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "schedule" && (
          <div>
            <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
              <div>
                <h2 className="font-display font-800 text-3xl text-white">
                  SCHEDULE
                </h2>
                <p className="text-[#8ba0c8] text-sm mt-1">
                  Working hours: 08:00 - 22:00. Block dates or individual slots.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-display tracking-wider uppercase text-[#8ba0c8]">
                <span className="inline-flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500" />{" "}
                  Available
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" />{" "}
                  Blocked
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />{" "}
                  Booked
                </span>
              </div>
            </div>

            <div className="grid xl:grid-cols-[1.4fr,1fr] gap-6">
              <div className="bg-[#0f1830] border border-[#162040] rounded-lg p-6">
                <div className="flex items-center justify-between gap-3 mb-5">
                  <div>
                    <p className="text-xs font-display tracking-widest uppercase text-[#8ba0c8] mb-1">
                      Selected date
                    </p>
                    <input
                      type="date"
                      value={selectedScheduleDate}
                      onChange={(e) => setSelectedScheduleDate(e.target.value)}
                      className="bg-[#162040] border border-[#1e2d55] rounded px-4 py-2 text-white text-sm [color-scheme:dark]"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => toggleFullDayBlock(selectedScheduleDate)}
                      className="text-xs font-display tracking-wider uppercase bg-[#162040] hover:bg-[#1e2d55] text-[#8ba0c8] hover:text-white border border-[#1e2d55] px-3 py-2 rounded transition-colors"
                    >
                      {selectedSummary.blocked.length ===
                      DEFAULT_WORKING_TIME_SLOTS.length
                        ? "Unblock day"
                        : "Block full day"}
                    </button>
                    <button
                      type="button"
                      onClick={() => resetDaySchedule(selectedScheduleDate)}
                      className="text-xs font-display tracking-wider uppercase bg-[#162040] hover:bg-[#1e2d55] text-[#8ba0c8] hover:text-white border border-[#1e2d55] px-3 py-2 rounded transition-colors"
                    >
                      Reset day
                    </button>
                  </div>
                </div>

                <div className="space-y-4 mb-6">
                  <div className="rounded border border-[#162040] bg-[#0a1022] p-4">
                    <p className="text-xs font-display tracking-widest uppercase text-[#8ba0c8] mb-3">
                      Block a period
                    </p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <label className="space-y-1 text-xs font-display tracking-wider uppercase text-[#8ba0c8]">
                        <span>From</span>
                        <input
                          type="date"
                          value={rangeStartDate}
                          onChange={(e) => setRangeStartDate(e.target.value)}
                          className="w-full bg-[#162040] border border-[#1e2d55] rounded px-3 py-2 text-white text-sm [color-scheme:dark]"
                        />
                      </label>
                      <label className="space-y-1 text-xs font-display tracking-wider uppercase text-[#8ba0c8]">
                        <span>To</span>
                        <input
                          type="date"
                          value={rangeEndDate}
                          onChange={(e) => setRangeEndDate(e.target.value)}
                          className="w-full bg-[#162040] border border-[#1e2d55] rounded px-3 py-2 text-white text-sm [color-scheme:dark]"
                        />
                      </label>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          blockDateRange(rangeStartDate, rangeEndDate)
                        }
                        className="text-xs font-display tracking-wider uppercase bg-[#f5c518] hover:bg-[#ffd84d] text-[#060c1a] font-700 px-3 py-2 rounded transition-colors"
                      >
                        Block range
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setSchedule((current) => {
                            const updated = { ...current };
                            const allDates = new Set(Object.keys(updated));
                            Array.from(allDates).forEach((date) => {
                              delete updated[date];
                            });
                            saveBlockedTimeSlots(updated);
                            return updated;
                          })
                        }
                        className="text-xs font-display tracking-wider uppercase bg-[#162040] hover:bg-[#1e2d55] text-[#8ba0c8] hover:text-white border border-[#1e2d55] px-3 py-2 rounded transition-colors"
                      >
                        Clear all
                      </button>
                    </div>
                  </div>

                  <div className="rounded border border-[#162040] bg-[#0a1022] p-4">
                    <p className="text-xs font-display tracking-widest uppercase text-[#8ba0c8] mb-3">
                      Copy blocked hours
                    </p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <label className="space-y-1 text-xs font-display tracking-wider uppercase text-[#8ba0c8]">
                        <span>Source day</span>
                        <input
                          type="date"
                          value={selectedScheduleDate}
                          onChange={(e) =>
                            setSelectedScheduleDate(e.target.value)
                          }
                          className="w-full bg-[#162040] border border-[#1e2d55] rounded px-3 py-2 text-white text-sm [color-scheme:dark]"
                        />
                      </label>
                      <label className="space-y-1 text-xs font-display tracking-wider uppercase text-[#8ba0c8]">
                        <span>Copy to</span>
                        <input
                          type="date"
                          value={copyTargetDate}
                          onChange={(e) => setCopyTargetDate(e.target.value)}
                          className="w-full bg-[#162040] border border-[#1e2d55] rounded px-3 py-2 text-white text-sm [color-scheme:dark]"
                        />
                      </label>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          copyBlockedSchedule(
                            selectedScheduleDate,
                            copyTargetDate,
                          )
                        }
                        className="text-xs font-display tracking-wider uppercase bg-[#162040] hover:bg-[#1e2d55] text-[#8ba0c8] hover:text-white border border-[#1e2d55] px-3 py-2 rounded transition-colors"
                      >
                        Copy blocked day
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setCopyTargetDate(
                            addDaysToDate(selectedScheduleDate, 1),
                          )
                        }
                        className="text-xs font-display tracking-wider uppercase bg-[#162040] hover:bg-[#1e2d55] text-[#8ba0c8] hover:text-white border border-[#1e2d55] px-3 py-2 rounded transition-colors"
                      >
                        Use next day
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {DEFAULT_WORKING_TIME_SLOTS.map((slot) => {
                    const isBlocked = selectedSummary.blocked.includes(slot);
                    const isBooked = selectedSummary.booked.includes(slot);

                    return (
                      <button
                        key={slot}
                        type="button"
                        disabled={isBooked}
                        onClick={() =>
                          toggleBlockedSlot(selectedScheduleDate, slot)
                        }
                        className={`rounded border px-3 py-2 text-sm font-display font-600 transition-all ${
                          isBooked
                            ? "bg-blue-500/10 border-blue-500/30 text-blue-300 cursor-not-allowed"
                            : isBlocked
                              ? "bg-red-500/10 border-red-500/30 text-red-300 hover:bg-red-500/20"
                              : "bg-[#162040] border-[#1e2d55] text-[#c0cfe8] hover:border-[#f5c518] hover:text-white"
                        }`}
                      >
                        {isBooked
                          ? `${slot} · Booked`
                          : isBlocked
                            ? `${slot} · Blocked`
                            : slot}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="bg-[#0f1830] border border-[#162040] rounded-lg p-6">
                <h3 className="font-display font-700 text-lg text-white mb-4">
                  Availability calendar
                </h3>
                <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-display tracking-wider uppercase text-[#8ba0c8] mb-2">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                    (day) => (
                      <div key={day}>{day}</div>
                    ),
                  )}
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {calendarDates.map((date) => {
                    const summary = getDayScheduleSummary(
                      date,
                      bookings,
                      schedule,
                    );
                    const isSelected = date === selectedScheduleDate;
                    const totalBusy =
                      summary.blocked.length + summary.booked.length;

                    return (
                      <button
                        key={date}
                        type="button"
                        onClick={() => setSelectedScheduleDate(date)}
                        className={`min-h-[86px] rounded border p-2 text-left transition-all ${
                          isSelected
                            ? "border-[#f5c518] bg-[#f5c518]/10"
                            : "border-[#162040] bg-[#162040] hover:border-[#3a5080]"
                        } ${
                          summary.blocked.length > 0
                            ? "text-red-200"
                            : summary.booked.length > 0
                              ? "text-blue-200"
                              : "text-green-200"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-display text-xs font-700">
                            {new Date(`${date}T00:00:00`).getDate()}
                          </span>
                          {totalBusy > 0 && (
                            <span className="text-[10px] px-1 py-0.5 rounded-full bg-[#0a1022] text-[#c0cfe8]">
                              {totalBusy}
                            </span>
                          )}
                        </div>
                        <div className="space-y-1 text-[10px]">
                          {summary.blocked.length > 0 && (
                            <div className="text-red-300">
                              Blocked: {summary.blocked.length}
                            </div>
                          )}
                          {summary.booked.length > 0 && (
                            <div className="text-blue-300">
                              Booked: {summary.booked.length}
                            </div>
                          )}
                          {summary.available.length > 0 && (
                            <div className="text-green-300">
                              Open: {summary.available.length}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "offers" && (
          <div>
            <h2 className="font-display font-800 text-3xl text-white mb-6">
              OFFERS
            </h2>

            <div className="bg-[#0f1830] border border-[#162040] rounded-lg p-6 mb-6">
              <h3 className="font-display font-700 text-sm tracking-widest uppercase text-[#f5c518] mb-4">
                {editingOffer ? "Edit Offer" : "New Offer"}
              </h3>
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-display tracking-widest uppercase text-[#8ba0c8] mb-2">
                    Title *
                  </label>
                  <input
                    value={offerForm.title}
                    onChange={(e) =>
                      setOfferForm({ ...offerForm, title: e.target.value })
                    }
                    className="w-full bg-[#162040] border border-[#1e2d55] rounded px-4 py-2.5 text-white text-sm"
                    placeholder="Summer Package"
                  />
                </div>
                <div>
                  <label className="block text-xs font-display tracking-widest uppercase text-[#8ba0c8] mb-2">
                    Price
                  </label>
                  <input
                    value={offerForm.price}
                    onChange={(e) =>
                      setOfferForm({ ...offerForm, price: e.target.value })
                    }
                    className="w-full bg-[#162040] border border-[#1e2d55] rounded px-4 py-2.5 text-white text-sm"
                    placeholder="150 BGN"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-display tracking-widest uppercase text-[#8ba0c8] mb-2">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={offerForm.description}
                    onChange={(e) =>
                      setOfferForm({
                        ...offerForm,
                        description: e.target.value,
                      })
                    }
                    className="w-full bg-[#162040] border border-[#1e2d55] rounded px-4 py-2.5 text-white text-sm resize-none"
                    placeholder="Full inspection + panel check included..."
                  />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={offerForm.active}
                    onChange={(e) =>
                      setOfferForm({ ...offerForm, active: e.target.checked })
                    }
                    className="w-4 h-4 accent-[#f5c518]"
                  />
                  <span className="text-sm text-[#8ba0c8] font-display">
                    Active (visible on site)
                  </span>
                </label>

                <div className="flex gap-2 ml-auto">
                  {editingOffer && (
                    <button
                      onClick={() => {
                        setEditingOffer(null);
                        setOfferForm({
                          title: "",
                          description: "",
                          price: "",
                          active: true,
                        });
                      }}
                      className="px-4 py-2 text-sm font-display tracking-wider text-[#8ba0c8] hover:text-white border border-[#162040] rounded transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    onClick={() =>
                      editingOffer ? saveOfferEdit(editingOffer) : createOffer()
                    }
                    className="px-5 py-2 bg-[#f5c518] text-[#060c1a] font-display font-700 text-sm tracking-wider uppercase rounded hover:bg-[#e8a000] transition-colors"
                  >
                    {editingOffer ? "Save Changes" : "Create Offer"}
                  </button>
                </div>
              </div>
            </div>

            {offers.length === 0 ? (
              <div className="bg-[#0f1830] border border-[#162040] rounded-lg p-10 text-center">
                <p className="text-[#3a5080] font-display text-lg">
                  No offers yet.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {offers.map((offer) => (
                  <div
                    key={offer.id}
                    className="bg-[#0f1830] border border-[#162040] rounded-lg p-5 flex items-center justify-between gap-4 flex-wrap"
                  >
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="font-display font-700 text-white text-lg">
                          {offer.title}
                        </span>
                        {offer.price && (
                          <span className="text-[#f5c518] font-display font-600">
                            {offer.price}
                          </span>
                        )}
                        <span
                          className={`text-xs border rounded px-2 py-0.5 font-display tracking-wider uppercase ${offer.active ? "border-green-500/30 text-green-400 bg-green-500/10" : "border-[#1e2d55] text-[#3a5080] bg-[#162040]"}`}
                        >
                          {offer.active ? "Active" : "Inactive"}
                        </span>
                      </div>
                      {offer.description && (
                        <p className="text-[#8ba0c8] text-sm mt-1">
                          {offer.description}
                        </p>
                      )}
                      <p className="text-[#3a5080] text-xs mt-1">
                        {offer.items.length} item
                        {offer.items.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleOfferActive(offer.id)}
                        className="text-xs font-display tracking-wider uppercase bg-[#162040] hover:bg-[#1e2d55] text-[#8ba0c8] hover:text-white border border-[#1e2d55] px-3 py-1.5 rounded transition-colors"
                      >
                        {offer.active ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() => {
                          setTab("items");
                          setSelectedOffer(offer.id);
                        }}
                        className="text-xs font-display tracking-wider uppercase bg-[#162040] hover:bg-[#1e2d55] text-[#8ba0c8] hover:text-white border border-[#1e2d55] px-3 py-1.5 rounded transition-colors"
                      >
                        Edit Items
                      </button>
                      <button
                        onClick={() => startEditOffer(offer)}
                        className="text-xs font-display tracking-wider uppercase bg-[#162040] hover:bg-[#1e2d55] text-[#8ba0c8] hover:text-white border border-[#1e2d55] px-3 py-1.5 rounded transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteOfferFn(offer.id)}
                        className="text-xs font-display tracking-wider uppercase bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/30 px-3 py-1.5 rounded transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "items" && (
          <div>
            <h2 className="font-display font-800 text-3xl text-white mb-6">
              OFFER ITEMS
            </h2>

            {offers.length === 0 ? (
              <div className="bg-[#0f1830] border border-[#162040] rounded-lg p-10 text-center">
                <p className="text-[#3a5080] font-display text-lg">
                  Create an offer first.
                </p>
                <button
                  onClick={() => setTab("offers")}
                  className="mt-4 text-[#f5c518] text-sm font-display tracking-wider hover:underline"
                >
                  → Go to Offers
                </button>
              </div>
            ) : (
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <p className="text-xs font-display tracking-widest uppercase text-[#8ba0c8] mb-3">
                    Select Offer
                  </p>
                  {offers.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => setSelectedOffer(o.id)}
                      className={`w-full text-left px-4 py-3 rounded-lg border text-sm font-display font-600 transition-all ${
                        selectedOffer === o.id
                          ? "bg-[#f5c518]/10 border-[#f5c518]/40 text-white"
                          : "bg-[#0f1830] border-[#162040] text-[#8ba0c8] hover:border-[#3a5080]"
                      }`}
                    >
                      {o.title}
                      <span className="block text-xs font-400 text-[#3a5080] mt-0.5">
                        {o.items.length} items
                      </span>
                    </button>
                  ))}
                </div>

                <div className="md:col-span-2">
                  {!currentOffer ? (
                    <div className="bg-[#0f1830] border border-[#162040] rounded-lg p-10 text-center h-full flex items-center justify-center">
                      <p className="text-[#3a5080] font-display">
                        Select an offer to manage its items.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-[#0f1830] border border-[#162040] rounded-lg p-6">
                      <div className="flex items-center justify-between mb-5">
                        <div>
                          <h3 className="font-display font-700 text-white text-xl">
                            {currentOffer.title}
                          </h3>
                          {currentOffer.price && (
                            <span className="text-[#f5c518] font-display text-sm">
                              {currentOffer.price}
                            </span>
                          )}
                        </div>
                        <span className="text-[#3a5080] text-xs">
                          {currentOffer.items.length} items
                        </span>
                      </div>

                      <div className="flex gap-2 mb-5">
                        <input
                          value={newItemText}
                          onChange={(e) => setNewItemText(e.target.value)}
                          onKeyDown={(e) =>
                            e.key === "Enter" &&
                            (e.preventDefault(), addItem(currentOffer.id))
                          }
                          className="flex-1 bg-[#162040] border border-[#1e2d55] rounded px-4 py-2.5 text-white text-sm"
                          placeholder="e.g. Panel inspection included"
                        />
                        <button
                          onClick={() => addItem(currentOffer.id)}
                          className="px-4 py-2.5 bg-[#f5c518] text-[#060c1a] font-display font-700 text-sm rounded hover:bg-[#e8a000] transition-colors"
                        >
                          Add
                        </button>
                      </div>

                      {currentOffer.items.length === 0 ? (
                        <p className="text-[#3a5080] text-sm text-center py-6">
                          No items yet. Add what this offer includes.
                        </p>
                      ) : (
                        <ul className="space-y-2">
                          {currentOffer.items.map((item) => (
                            <li
                              key={item.id}
                              className="flex items-center justify-between gap-3 bg-[#162040] border border-[#1e2d55] rounded px-4 py-3"
                            >
                              <span className="flex items-center gap-2 text-sm text-[#c0cfe8]">
                                <span className="text-[#f5c518]">✓</span>
                                {item.text}
                              </span>
                              <button
                                onClick={() =>
                                  removeItem(currentOffer.id, item.id)
                                }
                                className="text-[#3a5080] hover:text-red-400 transition-colors text-lg leading-none"
                                title="Remove item"
                              >
                                ×
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
