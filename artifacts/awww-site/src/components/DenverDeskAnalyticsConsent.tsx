import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  getAnalyticsConsent,
  initialiseDenverDeskAnalytics,
  isDenverDeskAnalyticsConfigured,
  setAnalyticsConsent,
  trackDenverDeskEvent,
} from "@/lib/denversDeskAnalytics";

export default function DenverDeskAnalyticsConsent() {
  const [location] = useLocation();
  const [consent, setConsent] = useState(() => getAnalyticsConsent());
  const configured = isDenverDeskAnalyticsConfigured();

  useEffect(() => {
    if (configured && consent === "granted") {
      initialiseDenverDeskAnalytics();
    }
  }, [configured, consent]);

  useEffect(() => {
    if (configured && consent === "granted") {
      void trackDenverDeskEvent("page_view");
    }
  }, [configured, consent, location]);

  if (!configured || consent) {
    return null;
  }

  const choose = (value: "granted" | "denied") => {
    setAnalyticsConsent(value);
    setConsent(value);
  };

  return (
    <section
      className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-xl rounded-2xl border border-primary/30 bg-[#080d14]/95 backdrop-blur-xl p-4 shadow-[0_0_50px_rgba(26,157,224,0.25)] sm:p-5"
      aria-label="Analytics privacy choice"
    >
      <p className="font-mono text-sm font-semibold text-primary uppercase tracking-wider">
        Help us understand how the site is used
      </p>
      <p className="mt-1 text-xs text-foreground/75 leading-relaxed">
        With your permission, A Woman With a Welder uses privacy-focused, first-party analytics powered by Denver's Desk.
        It does not track passwords, credit card numbers, or sensitive information.
      </p>
      <div className="mt-3.5 flex flex-wrap gap-2.5">
        <button
          type="button"
          onClick={() => choose("granted")}
          className="rounded-full bg-primary px-4 py-1.5 font-mono text-xs font-bold text-primary-foreground shadow-[0_0_15px_rgba(26,157,224,0.6)] hover:bg-primary/90 transition-all cursor-pointer"
        >
          Allow analytics
        </button>
        <button
          type="button"
          onClick={() => choose("denied")}
          className="rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 font-mono text-xs text-primary/80 hover:bg-primary/15 transition-all cursor-pointer"
        >
          No thanks
        </button>
      </div>
    </section>
  );
}
