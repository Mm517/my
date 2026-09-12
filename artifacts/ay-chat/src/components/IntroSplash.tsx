import { useEffect, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";

const STORAGE_KEY = "ay-chat:intro-seen";

export function IntroSplash({ children }: { children: ReactNode }) {
  const [show, setShow] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.sessionStorage.getItem(STORAGE_KEY) !== "1";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => {
      try {
        window.sessionStorage.setItem(STORAGE_KEY, "1");
      } catch {
        /* ignore */
      }
      setShow(false);
    }, 2200);
    return () => clearTimeout(t);
  }, [show]);

  return (
    <>
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            key="intro"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.45, ease: "easeInOut" } }}
            className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
            style={{
              background:
                "radial-gradient(circle at 30% 30%, hsl(173 80% 22%) 0%, hsl(222 47% 8%) 60%, hsl(222 47% 5%) 100%)",
            }}
          >
            <motion.div
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
              style={{
                backgroundImage:
                  "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
                backgroundSize: "26px 26px",
              }}
            />

            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="absolute rounded-full border-2 border-teal-300/40"
                initial={{ width: 80, height: 80, opacity: 0.6, scale: 0.6 }}
                animate={{
                  width: 80,
                  height: 80,
                  opacity: 0,
                  scale: 5 + i * 1.6,
                }}
                transition={{
                  duration: 2.0,
                  delay: 0.15 + i * 0.25,
                  ease: "easeOut",
                }}
              />
            ))}

            <motion.div
              initial={{ scale: 0.6, opacity: 0, rotate: -8 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{
                duration: 0.7,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="relative flex flex-col items-center"
            >
              <motion.div
                className="relative flex h-28 w-28 items-center justify-center rounded-3xl text-4xl font-black text-slate-900 shadow-2xl"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(173 80% 70%) 0%, hsl(173 80% 45%) 100%)",
                  boxShadow: "0 0 60px hsl(173 80% 50% / 0.55), 0 25px 50px rgba(0,0,0,.55)",
                }}
                animate={{
                  boxShadow: [
                    "0 0 50px hsl(173 80% 50% / 0.4), 0 25px 50px rgba(0,0,0,.55)",
                    "0 0 90px hsl(173 80% 60% / 0.7), 0 25px 50px rgba(0,0,0,.55)",
                    "0 0 50px hsl(173 80% 50% / 0.4), 0 25px 50px rgba(0,0,0,.55)",
                  ],
                }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                AY
                <motion.span
                  className="absolute inset-0 rounded-3xl"
                  style={{
                    background:
                      "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.5) 50%, transparent 70%)",
                  }}
                  initial={{ x: "-120%" }}
                  animate={{ x: "120%" }}
                  transition={{ duration: 1.2, ease: "easeInOut", delay: 0.4 }}
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.5 }}
                className="mt-6 text-center"
              >
                <div className="text-2xl font-bold text-white tracking-tight">
                  Abdallah Yahia Chat
                </div>
                <div className="mt-1 text-sm text-teal-200/80">
                  A safe community for serious students
                </div>
              </motion.div>

              <motion.div
                className="mt-7 h-0.5 w-40 overflow-hidden rounded-full bg-white/10"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
              >
                <motion.div
                  className="h-full bg-teal-300"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 1.2, delay: 0.7, ease: "easeInOut" }}
                />
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
