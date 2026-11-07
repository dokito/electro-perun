import { useEffect, useRef, useState, type FormEvent } from "react";
import AdminPanel from "./components/AdminPanel";
import logoSvg from "./img/ElectroPerun Logo SVG transparent.svg";
import {
  createEmptyBookingForm,
  DEFAULT_WORKING_TIME_SLOTS,
  getAvailableTimeSlotsForDate,
  hasRequiredBookingFields,
  type BookingFormValues,
} from "./lib/booking";
import {
  loadBookings,
  saveBooking,
  saveAttachment,
  type Booking,
} from "./lib/supabase";
import FileUpload, { type FileUploadRef } from "./components/FileUpload";
import type { UploadedFile } from "./lib/fileUpload";

type Lang = "bg" | "en";

const T = {
  en: {
    nav: {
      services: "Services",
      about: "About",
      booking: "Book Appointment",
    },
    hero: {
      badge: "Licensed Electrical Technician",
      title: "POWERING YOUR HOME & BUSINESS",
      subtitle:
        "Professional electrical installations, repairs, and smart solutions for residential and commercial clients in Sofia and beyond.",
      cta: "Book a Service",
      cta2: "View Services",
    },
    services: {
      title: "OUR SERVICES",
      subtitle:
        "Comprehensive electrical solutions delivered with precision and safety.",
      items: [
        {
          icon: "⚡",
          title: "Electrical Installations",
          desc: "Full wiring and installation for new builds, renovations, and extensions. Compliant with all Bulgarian electrical standards.",
        },
        {
          icon: "🔧",
          title: "Repairs & Troubleshooting",
          desc: "Fast diagnosis and repair of faults, short circuits, tripped breakers, and any electrical malfunction.",
        },
        {
          icon: "🔌",
          title: "Panel & Breaker Upgrades",
          desc: "Replacing outdated panels, upgrading capacity, and installing modern RCD protection systems.",
        },
        {
          icon: "💡",
          title: "Lighting Design & Installation",
          desc: "LED retrofits, architectural lighting, outdoor floodlights, and smart lighting systems.",
        },
        {
          icon: "🏠",
          title: "Smart Home Integration",
          desc: "Installing smart switches, dimmers, EV chargers, solar inverter connections, and home automation wiring.",
        },
        {
          icon: "🔍",
          title: "Safety Inspections",
          desc: "Full wiring inspections, thermal imaging scans, and certification reports for property transactions.",
        },
      ],
    },
    about: {
      title: "ABOUT ME",
      name: "Krasimir Kostadinov",
      role: "Master Electrician · 10+ Years Experience",
      bio1: "I am a licensed master electrician with over 10 years of hands-on experience in residential, commercial, and industrial electrical work. Based in Sofia, I serve clients across the city and surrounding regions.",
      bio2: "Every job is approached with strict safety standards, transparent pricing, and a commitment to clean, reliable workmanship. I carry full liability insurance and all work is warranted.",
      stats: [
        { value: "10+", label: "Years Experience" },
        { value: "600+", label: "Projects Completed" },
        { value: "100%", label: "Licensed & Insured" },
        { value: "4.9★", label: "Client Rating" },
      ],
    },
    booking: {
      title: "BOOK AN APPOINTMENT",
      subtitle:
        "Choose a service, pick a date and time, and I will confirm your slot within 2 hours.",
      form: {
        name: "Full Name",
        phone: "Phone Number",
        email: "Email Address",
        service: "Select Service",
        servicePlaceholder: "-- Choose a service --",
        date: "Preferred Date",
        time: "Preferred Time Slot",
        message: "Additional Notes (optional)",
        submit: "Request Appointment",
        success:
          "Your appointment request has been sent! I will contact you within 2 hours to confirm.",
        required: "Please fill in all required fields.",
        unavailable: "No available time slots for this date.",
      },
      services: [
        "Electrical Installation",
        "Repairs & Troubleshooting",
        "Panel / Breaker Upgrade",
        "Lighting Installation",
        "Smart Home Integration",
        "Safety Inspection",
        "Other",
      ],
      timeSlots: DEFAULT_WORKING_TIME_SLOTS,
    },
    footer: {
      tagline: "Licensed · Insured · Available 7 days a week",
      rights: "All rights reserved.",
    },
  },
  bg: {
    nav: {
      services: "Услуги",
      about: "За мен",
      booking: "Запази час",
    },
    hero: {
      badge: "Лицензиран електротехник",
      title: "ЗАХРАНВАНЕ НА ВАШИЯ ДОМ И БИЗНЕС",
      subtitle:
        "Професионален монтаж, ремонт и интелигентни решения за жилищни и търговски обекти в София и региона.",
      cta: "Запази час",
      cta2: "Разгледай услугите",
    },
    services: {
      title: "НАШИТЕ УСЛУГИ",
      subtitle:
        "Пълен набор от електро услуги, изпълнени с точност и безопасност.",
      items: [
        {
          icon: "⚡",
          title: "Електроинсталации",
          desc: "Пълно окабеляване и монтаж за нови сгради, ремонти и разширения. Съответствие с всички български стандарти.",
        },
        {
          icon: "🔧",
          title: "Ремонт и диагностика",
          desc: "Бърза диагностика и отстраняване на повреди, къси съединения, изгорели предпазители и всякакви електрически неизправности.",
        },
        {
          icon: "🔌",
          title: "Смяна на табло и предпазители",
          desc: "Подмяна на остарели табла, увеличаване на капацитет и монтаж на съвременни дефектнотокови защити.",
        },
        {
          icon: "💡",
          title: "Осветление",
          desc: "LED осветление, архитектурно осветление, прожектори за спот и интелигентни системи за осветление.",
        },
        {
          icon: "🏠",
          title: "Умен дом",
          desc: "Монтаж на смарт ключове, димери, зарядни за електромобили, свързване на соларни инвертори и автоматизация.",
        },
        {
          icon: "🔍",
          title: "Проверки и сертификация",
          desc: "Пълна инспекция на инсталацията, термографски сканирания и доклади за сертификация при покупко-продажба.",
        },
      ],
    },
    about: {
      title: "ЗА МЕН",
      name: "Красимир Костадинов",
      role: "Майстор електротехник · 10+ години опит",
      bio1: "Аз съм лицензиран майстор електротехник с над 10 години практически опит в жилищни, търговски и промишлени обекти. Базиран в София, обслужвам клиенти от цял град и региона.",
      bio2: "Всяка работа се извършва при строги стандарти за безопасност, прозрачни цени и ангажимент за чисто и надеждно изпълнение. Работя с пълна застраховка и давам гаранция за извършените работи.",
      stats: [
        { value: "10+", label: "Години опит" },
        { value: "600+", label: "Завършени проекта" },
        { value: "100%", label: "Лицензиран и застрахован" },
        { value: "4.9★", label: "Оценка от клиенти" },
      ],
    },
    booking: {
      title: "ЗАПАЗИ ЧАС",
      subtitle:
        "Изберете услуга, дата и час — ще потвърдя слота ви в рамките на 2 часа.",
      form: {
        name: "Три имена",
        phone: "Телефонен номер",
        email: "Имейл адрес",
        service: "Изберете услуга",
        servicePlaceholder: "-- Изберете услуга --",
        date: "Предпочитана дата",
        time: "Предпочитан час",
        message: "Допълнителна информация (по желание)",
        submit: "Заявка за час",
        success:
          "Вашата заявка е изпратена! Ще се свържа с вас в рамките на 2 часа за потвърждение.",
        required: "Моля, попълнете всички задължителни полета.",
        unavailable: "Няма свободни часове за тази дата.",
      },
      services: [
        "Електроинсталация",
        "Ремонт и диагностика",
        "Смяна на табло",
        "Монтаж на осветление",
        "Умен дом",
        "Проверка и сертификация",
        "Друго",
      ],
      timeSlots: DEFAULT_WORKING_TIME_SLOTS,
    },
    footer: {
      tagline: "Лицензиран · Застрахован · Наличен 7 дни в седмицата",
      rights: "Всички права запазени.",
    },
  },
};

export default function App() {
  const [lang, setLang] = useState<Lang>("bg");
  const [selectedTime, setSelectedTime] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<BookingFormValues>(createEmptyBookingForm());
  const [isAdmin, setIsAdmin] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const fileUploadRef = useRef<FileUploadRef>(null);

  useEffect(() => {
    const check = () => setIsAdmin(window.location.hash === "#admin");
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, []);

  useEffect(() => {
    let mounted = true;

    loadBookings().then((data) => {
      if (mounted) setBookings(data);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const t = T[lang];
  const today = new Date().toISOString().split("T")[0];
  const availableTimeSlots = form.date
    ? getAvailableTimeSlotsForDate(form.date, bookings)
    : DEFAULT_WORKING_TIME_SLOTS;

  useEffect(() => {
    if (
      form.date &&
      selectedTime &&
      !availableTimeSlots.includes(selectedTime)
    ) {
      setSelectedTime("");
    }
  }, [availableTimeSlots, form.date, selectedTime]);

  function resetForm() {
    setForm(createEmptyBookingForm());
    setSelectedTime("");
  }

  // Handle file uploads
  const handleFilesUpload = async (files: UploadedFile[]) => {
    setUploadedFiles(files);
    console.log(`${files.length} file(s) uploaded successfully`);
  };

  const handleFileUploadError = (msg: string) => {
    console.error("File upload error:", msg);
    setError(true);
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!hasRequiredBookingFields(form, selectedTime)) {
      setError(true);
      return;
    }

    if (!availableTimeSlots.includes(selectedTime)) {
      setError(true);
      return;
    }

    setError(false);
    setIsSubmitting(true);

    const booking: Booking = {
      id: Math.random().toString(36).slice(2, 10),
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      service: form.service,
      date: form.date,
      time: selectedTime,
      message: form.message.trim(),
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    try {
      // 1. Save booking first
      const result = await saveBooking(booking);
      if (!result) {
        setError(true);
        setIsSubmitting(false);
        return;
      }

      // 2. Upload files with real booking ID (if any were selected)
      let uploadedFilesAfterBooking: UploadedFile[] = [];
      if (fileUploadRef.current) {
        uploadedFilesAfterBooking = await fileUploadRef.current.uploadFiles(
          result.id,
        );
      }

      // 3. Link uploaded files to booking (if any)
      if (uploadedFilesAfterBooking.length > 0) {
        await Promise.all(
          uploadedFilesAfterBooking.map((f) =>
            saveAttachment({
              id: f.id,
              booking_id: result.id,
              file_name: f.fileName,
              file_size: f.fileSize,
              file_type: f.fileType,
              storage_path: `bookings/${result.id}/${f.id}`,
              url: f.url,
            }),
          ),
        );
      }

      // 4. Clear form and files
      fileUploadRef.current?.clearSelected();
      setUploadedFiles([]);
      setSubmitted(true);
      setBookings((current) => [result, ...current]);
    } catch (err) {
      console.error("Error submitting booking:", err);
      setError(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Electrician",
    name: "ElektroTehnik",
    description:
      "Professional electrical installation, repair, lighting, panel upgrade and smart home services in Sofia, Bulgaria.",
    url: "https://www.elektrotehnik.bg/",
    telephone: "+359 88 000 0000",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Sofia",
      addressLocality: "Sofia",
      addressRegion: "Sofia City Province",
      postalCode: "1000",
      addressCountry: "BG",
    },
    areaServed: [
      "Sofia",
      "Sofia City Province",
      "Bulgaria",
      "Plovdiv",
      "Varna",
    ],
    priceRange: "€€",
    openingHours: ["Mo-Su 08:00-22:00"],
    sameAs: ["https://www.facebook.com/", "https://www.instagram.com/"],
    image:
      "https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=1200&h=630&fit=crop&auto=format",
  };

  useEffect(() => {
    const title =
      lang === "en"
        ? "ElektroTehnik | Electrician in Sofia, Bulgaria"
        : "Електротехник София | Електро услуги в България";

    const description =
      lang === "en"
        ? "Professional electrician in Sofia, Bulgaria. Electrical installation, repair, lighting, smart home and panel upgrades for residential and commercial properties."
        : "Професионален електротехник в София, България. Електроинсталации, ремонт, осветление, смарт дом и смяна на табло за жилищни и търговски обекти.";

    const keywords =
      lang === "en"
        ? "electrician Sofia Bulgaria, electrical services Sofia, electrical installation Sofia, electrical repair Sofia, smart home Sofia, panel upgrade Sofia, electrician Bulgaria, electrical contractor Sofia"
        : "електротехник София, електроуслуги София, електроинсталации София, ремонт на електричество София, смяна на табло София, smart home София, електротехник България";

    document.title = title;

    const descriptionMeta = document.querySelector('meta[name="description"]');
    if (descriptionMeta) {
      descriptionMeta.setAttribute("content", description);
    }

    const keywordsMeta = document.querySelector('meta[name="keywords"]');
    if (keywordsMeta) {
      keywordsMeta.setAttribute("content", keywords);
    }

    const canonicalLink =
      document.querySelector('link[rel="canonical"]') ??
      document.createElement("link");

    canonicalLink.setAttribute("rel", "canonical");
    canonicalLink.setAttribute("href", "https://www.elektrotehnik.bg/");

    if (!document.querySelector('link[rel="canonical"]')) {
      document.head.appendChild(canonicalLink);
    }

    document.documentElement.lang = lang === "en" ? "en" : "bg";
  }, [lang]);

  if (isAdmin) {
    return (
      <AdminPanel
        onExit={() => {
          window.location.hash = "";
          setIsAdmin(false);
        }}
      />
    );
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <div className="min-h-full bg-[#060c1a] text-[#c0cfe8]">
        <nav className="fixed top-0 left-0 right-0 z-50 bg-[#060c1a]/90 backdrop-blur-sm border-b border-[#162040]">
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <a href="#">
                <img
                  src={logoSvg}
                  alt="ElectroPerun Logo"
                  className="h-20 w-auto object-contain"
                />
              </a>
            </div>

            <div className="hidden md:flex items-center gap-8">
              {(["services", "about", "booking"] as const).map((key) => (
                <a
                  key={key}
                  href={`#${key}`}
                  className="nav-link text-sm font-medium text-[#8ba0c8] transition-colors duration-200 font-display tracking-wider uppercase"
                >
                  {t.nav[key]}
                </a>
              ))}
            </div>

            <div className="flex items-center gap-2 bg-[#0f1830] rounded p-1">
              {(["en", "bg"] as Lang[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`px-3 py-1 text-xs font-display font-600 tracking-widest uppercase rounded transition-all duration-200 ${
                    lang === l
                      ? "bg-[#f5c518] text-[#060c1a]"
                      : "text-[#8ba0c8] hover:text-white"
                  }`}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </nav>

        <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage:
                "url('https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=1600&h=900&fit=crop&auto=format')",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#060c1a] via-[#060c1a]/85 to-[#060c1a]/40" />

          <div className="relative max-w-6xl mx-auto px-6 py-24">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 bg-[#f5c518]/10 border border-[#f5c518]/30 rounded px-3 py-1.5 mb-6">
                <div className="w-2 h-2 rounded-full bg-[#f5c518] animate-pulse" />
                <span className="text-[#f5c518] text-xs font-display tracking-widest uppercase font-600">
                  {t.hero.badge}
                </span>
              </div>
              <h1 className="font-display font-800 text-5xl md:text-7xl text-white leading-none tracking-tight mb-6">
                {t.hero.title}
              </h1>
              <p className="text-[#8ba0c8] text-lg leading-relaxed mb-10 max-w-xl">
                {t.hero.subtitle}
              </p>
              <div className="flex flex-wrap gap-4">
                <a
                  href="#booking"
                  className="bg-[#f5c518] text-[#060c1a] font-display font-700 text-sm tracking-wider uppercase px-8 py-3 rounded hover:bg-[#e8a000] transition-colors duration-200"
                >
                  {t.hero.cta}
                </a>
                <a
                  href="#services"
                  className="border border-[#3a5080] text-[#c0cfe8] font-display font-600 text-sm tracking-wider uppercase px-8 py-3 rounded hover:border-[#f5c518] hover:text-white transition-colors duration-200"
                >
                  {t.hero.cta2}
                </a>
              </div>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 bg-[#0f1830]/80 backdrop-blur-sm border-t border-[#162040]">
            <div className="max-w-6xl mx-auto px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              {t.about.stats.map((s) => (
                <div key={s.label} className="text-center">
                  <div className="font-display font-700 text-2xl text-[#f5c518]">
                    {s.value}
                  </div>
                  <div className="text-xs text-[#8ba0c8] mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="services" className="py-24 bg-[#0a1022]">
          <div className="max-w-6xl mx-auto px-6">
            <div className="mb-14">
              <div className="w-12 h-1 bg-[#f5c518] mb-4" />
              <h2 className="font-display font-800 text-5xl text-white mb-3">
                {t.services.title}
              </h2>
              <p className="text-[#8ba0c8] text-lg max-w-xl">
                {t.services.subtitle}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {t.services.items.map((service, i) => (
                <div
                  key={i}
                  className="service-card bg-[#0f1830] border border-[#162040] rounded-lg p-6 transition-all duration-250 cursor-default"
                >
                  <div className="w-12 h-12 bg-[#162040] rounded-lg flex items-center justify-center text-2xl mb-4">
                    {service.icon}
                  </div>
                  <h3 className="font-display font-700 text-lg text-white mb-2 tracking-wide">
                    {service.title}
                  </h3>
                  <p className="text-[#8ba0c8] text-sm leading-relaxed">
                    {service.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="about" className="py-24 bg-[#060c1a]">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid md:grid-cols-2 gap-16 items-center">
              <div>
                <div className="w-12 h-1 bg-[#f5c518] mb-4" />
                <h2 className="font-display font-800 text-5xl text-white mb-2">
                  {t.about.title}
                </h2>
                <div className="font-display font-600 text-xl text-[#f5c518] mb-6">
                  {t.about.name}
                  <span className="text-[#3a5080] mx-2">·</span>
                  <span className="text-[#8ba0c8] text-base font-400">
                    {t.about.role}
                  </span>
                </div>
                <p className="text-[#8ba0c8] leading-relaxed mb-4">
                  {t.about.bio1}
                </p>
                <p className="text-[#8ba0c8] leading-relaxed">{t.about.bio2}</p>
                <div className="mt-8 flex flex-wrap gap-3">
                  {["EN 60364", "BDS IEC", "ПБЕЗЕЛ Certified", "ISO 9001"].map(
                    (badge) => (
                      <span
                        key={badge}
                        className="bg-[#0f1830] border border-[#162040] text-[#8ba0c8] text-xs font-display tracking-wider px-3 py-1.5 rounded"
                      >
                        {badge}
                      </span>
                    ),
                  )}
                </div>
              </div>
              <div className="relative">
                <div className="aspect-[4/5] rounded-lg overflow-hidden bg-[#0f1830]">
                  <img
                    src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=750&fit=crop&auto=format"
                    alt="Electrician at work"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute -bottom-4 -left-4 bg-[#f5c518] text-[#060c1a] font-display font-700 px-5 py-3 rounded text-sm tracking-wider">
                  Sofia, Bulgaria
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="booking" className="py-24 bg-[#0a1022]">
          <div className="max-w-6xl mx-auto px-6">
            <div className="mb-12">
              <div className="w-12 h-1 bg-[#f5c518] mb-4" />
              <h2 className="font-display font-800 text-5xl text-white mb-3">
                {t.booking.title}
              </h2>
              <p className="text-[#8ba0c8] text-lg max-w-xl">
                {t.booking.subtitle}
              </p>
            </div>
            {/* (File upload moved into the form below) */}

            {submitted ? (
              <div className="bg-[#0f1830] border border-[#f5c518]/40 rounded-lg p-10 max-w-xl">
                <div className="text-4xl mb-4">✅</div>
                <p className="text-white text-lg font-display font-600 leading-relaxed">
                  {t.booking.form.success}
                </p>
                <button
                  onClick={() => {
                    setSubmitted(false);
                    resetForm();
                  }}
                  className="mt-6 text-[#f5c518] text-sm font-display tracking-wider hover:underline"
                >
                  {lang === "en" ? "← Book another" : "← Нова заявка"}
                </button>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="grid md:grid-cols-2 gap-8"
              >
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-display tracking-widest uppercase text-[#8ba0c8] mb-2">
                      {t.booking.form.name} *
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                      className="w-full bg-[#0f1830] border border-[#162040] rounded px-4 py-3 text-white text-sm transition-colors duration-200"
                      placeholder="Ivan Ivanov"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-display tracking-widest uppercase text-[#8ba0c8] mb-2">
                      {t.booking.form.phone} *
                    </label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) =>
                        setForm({ ...form, phone: e.target.value })
                      }
                      className="w-full bg-[#0f1830] border border-[#162040] rounded px-4 py-3 text-white text-sm transition-colors duration-200"
                      placeholder="+359 88 ..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-display tracking-widest uppercase text-[#8ba0c8] mb-2">
                      {t.booking.form.email}
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                      className="w-full bg-[#0f1830] border border-[#162040] rounded px-4 py-3 text-white text-sm transition-colors duration-200"
                      placeholder="you@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-display tracking-widest uppercase text-[#8ba0c8] mb-2">
                      {t.booking.form.service} *
                    </label>
                    <select
                      value={form.service}
                      onChange={(e) =>
                        setForm({ ...form, service: e.target.value })
                      }
                      className="w-full bg-[#0f1830] border border-[#162040] rounded px-4 py-3 text-white text-sm transition-colors duration-200"
                    >
                      <option value="">
                        {t.booking.form.servicePlaceholder}
                      </option>
                      {t.booking.services.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-display tracking-widest uppercase text-[#8ba0c8] mb-2">
                      {t.booking.form.message}
                    </label>
                    <textarea
                      rows={3}
                      value={form.message}
                      onChange={(e) =>
                        setForm({ ...form, message: e.target.value })
                      }
                      className="w-full bg-[#0f1830] border border-[#162040] rounded px-4 py-3 text-white text-sm resize-none transition-colors duration-200"
                    />
                  </div>
                </div>

                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-display tracking-widest uppercase text-[#8ba0c8] mb-2">
                      {t.booking.form.date} *
                    </label>
                    <input
                      type="date"
                      min={today}
                      value={form.date}
                      onChange={(e) =>
                        setForm({ ...form, date: e.target.value })
                      }
                      className="w-full bg-[#0f1830] border border-[#162040] rounded px-4 py-3 text-white text-sm transition-colors duration-200 [color-scheme:dark]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-display tracking-widest uppercase text-[#8ba0c8] mb-3">
                      {t.booking.form.time} *
                    </label>
                    {form.date && availableTimeSlots.length === 0 ? (
                      <div className="bg-[#0f1830] border border-[#162040] rounded p-4 text-sm text-[#8ba0c8]">
                        {t.booking.form.unavailable}
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {availableTimeSlots.map((slot) => (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setSelectedTime(slot)}
                            className={`time-slot border rounded py-2.5 text-sm font-display font-600 tracking-wider transition-all duration-150 ${
                              selectedTime === slot
                                ? "selected border-[#f5c518]"
                                : "bg-[#0f1830] border-[#162040] text-[#8ba0c8]"
                            }`}
                          >
                            {slot}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {error && (
                    <p className="text-red-400 text-sm font-display">
                      {t.booking.form.required}
                    </p>
                  )}

                  <FileUpload
                    onError={handleFileUploadError}
                    disabled={isSubmitting}
                    ref={fileUploadRef}
                  />

                  <button
                    type="submit"
                    disabled={
                      Boolean(form.date) && availableTimeSlots.length === 0
                    }
                    className="w-full bg-[#f5c518] text-[#060c1a] font-display font-700 text-sm tracking-wider uppercase py-4 rounded hover:bg-[#e8a000] transition-colors duration-200 mt-4 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t.booking.form.submit}
                  </button>

                  <div className="bg-[#0f1830] border border-[#162040] rounded p-4 text-sm text-[#8ba0c8]">
                    <p className="font-display text-white font-600 mb-1">
                      {lang === "en" ? "Contact directly" : "Директна връзка"}
                    </p>
                    <p>📞 +359 88 123 4567</p>
                    <p>✉️ georgi@elektrotehnik.bg</p>
                  </div>
                </div>
              </form>
            )}
          </div>
        </section>

        <footer className="bg-[#060c1a] border-t border-[#162040] py-10">
          <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img
                src={logoSvg}
                alt="ElectroPerun Logo"
                className="h-7 w-auto object-contain"
              />
            </div>
            <p className="text-[#3a5080] text-xs font-display tracking-wider text-center">
              {t.footer.tagline}
            </p>
            <p className="text-[#3a5080] text-xs">
              © {new Date().getFullYear()} · {t.footer.rights}
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
