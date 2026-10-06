import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";

interface BackgroundSuspensionContextType {
  isSuspended: boolean;
  registerOverlay: (id: string, active: boolean) => void;
  activeOverlays: string[];
}

const BackgroundSuspensionContext = createContext<BackgroundSuspensionContextType>({
  isSuspended: false,
  registerOverlay: () => {},
  activeOverlays: [],
});

const globalActiveOverlays = new Set<string>();
const globalListeners = new Set<(isSuspended: boolean) => void>();

export function isBackgroundSuspendedGlobal(): boolean {
  return globalActiveOverlays.size > 0;
}

export function subscribeBackgroundSuspension(callback: (isSuspended: boolean) => void): () => void {
  globalListeners.add(callback);
  callback(globalActiveOverlays.size > 0);
  return () => {
    globalListeners.delete(callback);
  };
}

export function registerBackgroundOverlay(id: string, active: boolean): void {
  const previousState = globalActiveOverlays.size > 0;
  if (active) {
    globalActiveOverlays.add(id);
  } else {
    globalActiveOverlays.delete(id);
  }
  const newState = globalActiveOverlays.size > 0;

  if (typeof document !== "undefined") {
    document.body.classList.toggle("foreground-overlay-active", newState);
    window.dispatchEvent(new CustomEvent("dd:background-suspension", { detail: { isSuspended: newState, activeOverlays: Array.from(globalActiveOverlays) } }));
  }

  if (previousState !== newState) {
    globalListeners.forEach((listener) => listener(newState));
  }
}

export function BackgroundSuspensionProvider({ children }: { children: React.ReactNode }) {
  const [activeOverlays, setActiveOverlays] = useState<string[]>([]);
  const isSuspended = activeOverlays.length > 0;

  const registerOverlay = useCallback((id: string, active: boolean) => {
    setActiveOverlays((prev) => {
      const set = new Set(prev);
      if (active) {
        set.add(id);
      } else {
        set.delete(id);
      }
      const updated = Array.from(set);
      registerBackgroundOverlay(id, active);
      return updated;
    });
  }, []);

  useEffect(() => {
    document.body.classList.toggle("foreground-overlay-active", isSuspended);
    return () => {
      document.body.classList.remove("foreground-overlay-active");
    };
  }, [isSuspended]);

  return (
    <BackgroundSuspensionContext.Provider value={{ isSuspended, registerOverlay, activeOverlays }}>
      {children}
    </BackgroundSuspensionContext.Provider>
  );
}

export function useBackgroundSuspended(): boolean {
  const context = useContext(BackgroundSuspensionContext);
  const [globalSuspended, setGlobalSuspended] = useState(isBackgroundSuspendedGlobal);

  useEffect(() => {
    return subscribeBackgroundSuspension(setGlobalSuspended);
  }, []);

  return context ? context.isSuspended || globalSuspended : globalSuspended;
}

export function useRegisterOverlaySuspension(id: string, isOpen: boolean): void {
  const context = useContext(BackgroundSuspensionContext);
  const registeredRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      registeredRef.current = true;
      if (context?.registerOverlay) {
        context.registerOverlay(id, true);
      } else {
        registerBackgroundOverlay(id, true);
      }
    } else if (registeredRef.current) {
      registeredRef.current = false;
      if (context?.registerOverlay) {
        context.registerOverlay(id, false);
      } else {
        registerBackgroundOverlay(id, false);
      }
    }

    return () => {
      if (registeredRef.current) {
        registeredRef.current = false;
        if (context?.registerOverlay) {
          context.registerOverlay(id, false);
        } else {
          registerBackgroundOverlay(id, false);
        }
      }
    };
  }, [id, isOpen, context]);
}
