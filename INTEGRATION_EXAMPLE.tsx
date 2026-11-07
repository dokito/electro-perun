// Example Integration: Adding File Attachments to Your Booking Form
// This shows where and how to add the FileUpload component to App.tsx

import { useState, type FormEvent } from "react";
import FileUpload from "./components/FileUpload";
import { saveBooking, saveAttachment } from "./lib/supabase";
import {
  createEmptyBookingForm,
  hasRequiredBookingFields,
  type BookingFormValues,
} from "./lib/booking";
import type { UploadedFile } from "./lib/fileUpload";

// In your booking form section of App.tsx:

export function BookingFormExample() {
  const [formValues, setFormValues] = useState<BookingFormValues>(
    createEmptyBookingForm(),
  );
  const [selectedTime, setSelectedTime] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Handle file uploads
  const handleFilesUpload = async (files: UploadedFile[]) => {
    setUploadedFiles(files);
    console.log(`${files.length} file(s) uploaded successfully`);

    // Create attachment records in database
    // (optional - only if you want to track attachments in DB)
    // for (const file of files) {
    //   await saveAttachment({
    //     id: file.id,
    //     booking_id: "pending", // Will be set after booking is created
    //     file_name: file.fileName,
    //     file_size: file.fileSize,
    //     file_type: file.fileType,
    //     storage_path: `bookings/pending/${file.id}`,
    //     url: file.url,
    //   });
    // }
  };

  // Handle file upload errors
  const handleFileUploadError = (error: string) => {
    setErrorMessage(error);
  };

  // Handle form submission
  const handleFormSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!hasRequiredBookingFields(formValues, selectedTime)) {
      setErrorMessage("Please fill in all required fields.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      // Create the booking
      const booking = await saveBooking({
        id: `booking-${Date.now()}`,
        name: formValues.name,
        phone: formValues.phone,
        email: formValues.email,
        service: formValues.service,
        date: formValues.date,
        time: selectedTime,
        message: formValues.message,
        status: "pending",
        createdAt: new Date().toISOString(),
      });

      if (!booking) {
        throw new Error("Failed to create booking");
      }

      // Link uploaded files to the booking
      for (const file of uploadedFiles) {
        const saved = await saveAttachment({
          id: file.id,
          booking_id: booking.id,
          file_name: file.fileName,
          file_size: file.fileSize,
          file_type: file.fileType,
          storage_path: `bookings/${booking.id}/${file.id}`,
          url: file.url,
        });

        if (!saved) {
          console.warn(`Failed to link attachment ${file.fileName}`);
        }
      }

      setSuccessMessage(
        `Your appointment request has been sent with ${uploadedFiles.length} attachment(s)! I will contact you within 2 hours to confirm.`,
      );

      // Reset form
      setFormValues(createEmptyBookingForm());
      setSelectedTime("");
      setUploadedFiles([]);
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Failed to submit booking";
      setErrorMessage(errorMsg);
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleFormSubmit} className="space-y-4 max-w-2xl mx-auto">
      {/* Existing form fields */}
      <div>
        <label className="block text-sm font-medium mb-1">Full Name</label>
        <input
          type="text"
          value={formValues.name}
          onChange={(e) =>
            setFormValues((prev) => ({ ...prev, name: e.target.value }))
          }
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Phone</label>
        <input
          type="tel"
          value={formValues.phone}
          onChange={(e) =>
            setFormValues((prev) => ({ ...prev, phone: e.target.value }))
          }
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Email</label>
        <input
          type="email"
          value={formValues.email}
          onChange={(e) =>
            setFormValues((prev) => ({ ...prev, email: e.target.value }))
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Service</label>
        <select
          value={formValues.service}
          onChange={(e) =>
            setFormValues((prev) => ({ ...prev, service: e.target.value }))
          }
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        >
          <option value="">-- Choose a service --</option>
          <option value="Installation">Electrical Installation</option>
          <option value="Repair">Repairs & Troubleshooting</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Additional Notes
        </label>
        <textarea
          value={formValues.message}
          onChange={(e) =>
            setFormValues((prev) => ({ ...prev, message: e.target.value }))
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          rows={4}
        />
      </div>

      {/* FILE UPLOAD COMPONENT - NEW! */}
      <FileUpload
        bookingId="pending" // Temporary ID, will be replaced with actual booking ID
        onFilesUpload={handleFilesUpload}
        onError={handleFileUploadError}
        disabled={isSubmitting}
      />

      {/* Messages */}
      {errorMessage && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="p-3 rounded-lg bg-green-50 text-green-700 text-sm">
          {successMessage}
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? "Submitting..." : "Request Appointment"}
      </button>
    </form>
  );
}

// Tips:
// 1. The FileUpload component handles all compression automatically
// 2. Images will be compressed before upload (50-80% size reduction)
// 3. Users can drag-and-drop files or browse manually
// 4. All files are optional - booking works without attachments
// 5. Progress tracking shows compression and upload status
// 6. Uploaded files are linked to the booking in the database
