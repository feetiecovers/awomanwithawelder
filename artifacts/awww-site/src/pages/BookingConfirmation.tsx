import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Calendar, Clock3, MapPin, Phone, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import mainLogo from "@assets/Logo_-_Main_Logo_1782352742134.png";
import { ParticleBackground } from "@/components/ParticleBackground";
import { BrandOrbs } from "@/components/BrandOrbs";
import { SmokeEffect } from "@/components/SmokeEffect";
import {
  clearBookingConfirmation,
  loadBookingConfirmation,
  type BookingConfirmationData,
} from "@/lib/bookingConfirmation";

function formatCurrency(value: number) {
  return `NZ$${value.toFixed(2)}`;
}

export default function BookingConfirmation() {
  const [, setLocation] = useLocation();
  const [booking, setBooking] = useState<BookingConfirmationData | null>(null);

  useEffect(() => {
    setBooking(loadBookingConfirmation());
  }, []);

  const handleReturnHome = () => {
    clearBookingConfirmation();
    setLocation("/");
  };

  if (!booking) {
    return (
      <div className="relative w-full min-h-[100dvh] bg-[#0a0a0f] overflow-hidden text-foreground selection:bg-primary/30">
        <ParticleBackground />
        <BrandOrbs />
        <SmokeEffect />
        <div className="relative z-10 min-h-[100dvh] flex items-center justify-center p-6">
          <div className="w-full max-w-xl rounded-3xl border border-primary/20 bg-[#080d14]/95 p-8 text-center shadow-[0_0_60px_rgba(26,157,224,0.18),0_8px_40px_rgba(0,0,0,0.8)]">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary/70">Booking Confirmation</p>
            <h1 className="mt-4 font-mono text-2xl font-bold uppercase tracking-[0.14em] text-primary">
              No booking details found
            </h1>
            <p className="mt-4 text-sm text-muted-foreground">
              Return to the homepage and submit a service booking to see the confirmation details here.
            </p>
            <Button
              onClick={handleReturnHome}
              className="mt-6 font-mono uppercase tracking-widest text-xs"
            >
              Back to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full min-h-[100dvh] bg-[#0a0a0f] overflow-hidden text-foreground selection:bg-primary/30">
      <ParticleBackground />
      <BrandOrbs />
      <SmokeEffect />

      <div className="relative z-10 min-h-[100dvh] p-4 sm:p-6 lg:p-10">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 pb-6">
          <button
            onClick={handleReturnHome}
            className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-[#080d14]/85 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.22em] text-primary transition-colors hover:border-primary/50 hover:bg-primary/10"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Home
          </button>
          <img src={mainLogo} alt="A Woman With a Welder" className="h-12 w-auto opacity-90" />
        </div>

        <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[28px] border border-primary/20 bg-[#080d14]/95 p-6 shadow-[0_0_60px_rgba(26,157,224,0.18),0_8px_40px_rgba(0,0,0,0.8)] sm:p-8"
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-primary/70">Booking Received</p>
            <h1 className="mt-4 font-mono text-3xl font-bold uppercase tracking-[0.12em] text-primary sm:text-4xl">
              We have received your booking
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
              We&apos;ll be in touch within 4-6 hours to confirm availability, review your notes, and lock in the next step.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-primary/60">Service</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{booking.serviceName}</p>
                {booking.serviceDescription && (
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{booking.serviceDescription}</p>
                )}
              </div>
              <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-primary/60">Preferred Booking Date</p>
                <div className="mt-2 flex items-center gap-2 text-foreground">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span className="text-lg font-semibold">{booking.bookingDate}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-primary/15 bg-[#0d1520]/80 p-5">
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-primary" />
                <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-primary/60">What happens next</p>
              </div>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                Your request is queued for review now. We&apos;ll contact you within 4-6 hours using the details below to confirm timing, scope, and any final pricing adjustments.
              </p>
            </div>
          </motion.section>

          <motion.aside
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="space-y-6"
          >
            <div className="rounded-[28px] border border-primary/20 bg-[#080d14]/95 p-6 shadow-[0_0_60px_rgba(26,157,224,0.18),0_8px_40px_rgba(0,0,0,0.8)]">
              <div className="flex items-center gap-2">
                <ReceiptText className="h-4 w-4 text-primary" />
                <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-primary/60">Estimated Cost</p>
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Service estimate excl. GST</span>
                  <span>{formatCurrency(booking.subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>GST</span>
                  <span>{formatCurrency(booking.gst)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-primary/15 pt-3 font-semibold text-foreground">
                  <span>Estimated total</span>
                  <span className="text-primary">{formatCurrency(booking.total)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-primary/20 bg-[#080d14]/95 p-6 shadow-[0_0_60px_rgba(26,157,224,0.18),0_8px_40px_rgba(0,0,0,0.8)]">
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-primary/60">Contact Details</p>
              <div className="mt-4 space-y-4 text-sm text-muted-foreground">
                <div>
                  <p className="font-semibold text-foreground">{booking.fullName}</p>
                  <p>{booking.email}</p>
                </div>
                <div className="flex items-start gap-2">
                  <Phone className="mt-0.5 h-4 w-4 text-primary" />
                  <span>{booking.phone}</span>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                  <span>{booking.address}</span>
                </div>
                {booking.notes && (
                  <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                    <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-primary/60">Notes / Requests</p>
                    <p className="mt-2 whitespace-pre-wrap leading-6">{booking.notes}</p>
                  </div>
                )}
              </div>
            </div>
          </motion.aside>
        </div>
      </div>
    </div>
  );
}
