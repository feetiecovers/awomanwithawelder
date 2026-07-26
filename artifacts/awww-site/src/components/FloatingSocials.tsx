import React from "react";
import { motion } from "framer-motion";

interface SocialItem {
  id: string;
  name: string;
  url: string;
  positionClasses: string;
  delay: number;
  duration: number;
  glowColor: string;
  hoverGlow: string;
  icon: React.ReactNode;
}

const SOCIALS: SocialItem[] = [
  {
    id: "facebook",
    name: "Facebook",
    url: "https://www.facebook.com/awomanwithawelder",
    positionClasses: "top-[12%] right-[7%] sm:top-[14%] sm:right-[12%]",
    delay: 0.2,
    duration: 6.5,
    glowColor: "rgba(24, 119, 242, 0.55)",
    hoverGlow: "rgba(24, 119, 242, 0.95)",
    icon: (
      <div className="w-full h-full rounded-full bg-[#1877F2] flex items-center justify-center text-white p-2.5 shadow-lg">
        <svg className="w-full h-full fill-current" viewBox="0 0 24 24">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      </div>
    ),
  },
  {
    id: "instagram",
    name: "Instagram",
    url: "https://www.instagram.com/awomanwithawelder",
    positionClasses: "top-[76%] left-[6%] sm:top-[72%] sm:left-[10%]",
    delay: 0.8,
    duration: 7.2,
    glowColor: "rgba(228, 64, 95, 0.6)",
    hoverGlow: "rgba(228, 64, 95, 1.0)",
    icon: (
      <div
        className="w-full h-full rounded-2xl flex items-center justify-center text-white p-2.5 shadow-lg"
        style={{
          background: "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
        }}
      >
        <svg className="w-full h-full fill-current" viewBox="0 0 24 24">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
        </svg>
      </div>
    ),
  },
  {
    id: "youtube",
    name: "YouTube",
    url: "https://www.youtube.com/awomanwithawelder",
    positionClasses: "top-[22%] left-[7%] sm:top-[25%] sm:left-[12%]",
    delay: 1.4,
    duration: 8.0,
    glowColor: "rgba(255, 0, 0, 0.6)",
    hoverGlow: "rgba(255, 0, 0, 1.0)",
    icon: (
      <div className="w-full h-full rounded-2xl bg-[#FF0000] flex items-center justify-center text-white p-2.5 shadow-lg">
        <svg className="w-full h-full fill-current" viewBox="0 0 24 24">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      </div>
    ),
  },
];

export function FloatingSocials() {
  return (
    <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
      {SOCIALS.map((social) => (
        <motion.a
          key={social.id}
          href={social.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Visit ${social.name}`}
          data-testid={`social-${social.id}`}
          className={`absolute pointer-events-auto block transition-all duration-300 group ${social.positionClasses}`}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: social.delay, type: "spring" }}
        >
          <motion.div
            animate={{
              y: [-8, 8, -8],
              x: [-5, 5, -5],
              rotate: [-3, 3, -3],
            }}
            transition={{
              duration: social.duration,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            whileHover={{ scale: 1.22 }}
            whileTap={{ scale: 0.92 }}
            className="w-11 h-11 sm:w-13 sm:h-13 flex items-center justify-center transition-all duration-300"
            style={{
              filter: `drop-shadow(0 0 14px ${social.glowColor})`,
            }}
          >
            {social.icon}
          </motion.div>
        </motion.a>
      ))}
    </div>
  );
}
