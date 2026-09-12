import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ZoomIn, ZoomOut, Download } from "lucide-react";
import { useI18n } from "@/lib/i18n";

type Props = {
  open: boolean;
  url: string | null;
  name: string | null;
  onClose: () => void;
};

export function ImageViewer({ open, url, name, onClose }: Props) {
  const { t } = useI18n();
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (open) setScale(1);
  }, [open, url]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "+" || e.key === "=") setScale((s) => Math.min(s + 0.25, 4));
      if (e.key === "-") setScale((s) => Math.max(s - 0.25, 0.5));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const download = async () => {
    if (!url) return;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      const objUrl = URL.createObjectURL(blob);
      a.href = objUrl;
      a.download = name ?? "image";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
    } catch {
      window.open(url, "_blank");
    }
  };

  return (
    <AnimatePresence>
      {open && url && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[200] bg-black/90 flex flex-col"
          onClick={onClose}
        >
          <div
            className="flex items-center justify-between px-4 py-3 border-b border-white/10 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-medium truncate max-w-[60%]">{name ?? ""}</div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setScale((s) => Math.max(s - 0.25, 0.5))}
                className="p-2 rounded-md hover:bg-white/10"
                title={t("image.zoomOut")}
                aria-label={t("image.zoomOut")}
              >
                <ZoomOut className="h-5 w-5" />
              </button>
              <span className="text-xs w-12 text-center">{Math.round(scale * 100)}%</span>
              <button
                onClick={() => setScale((s) => Math.min(s + 0.25, 4))}
                className="p-2 rounded-md hover:bg-white/10"
                title={t("image.zoomIn")}
                aria-label={t("image.zoomIn")}
              >
                <ZoomIn className="h-5 w-5" />
              </button>
              <button
                onClick={download}
                className="p-2 rounded-md hover:bg-white/10"
                title={t("image.download")}
                aria-label={t("image.download")}
              >
                <Download className="h-5 w-5" />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-md hover:bg-white/10"
                title={t("image.close")}
                aria-label={t("image.close")}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div
            className="flex-1 overflow-auto flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.img
              key={url}
              src={url}
              alt={name ?? ""}
              draggable={false}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale, opacity: 1 }}
              transition={{ type: "spring", stiffness: 220, damping: 26 }}
              style={{ maxWidth: "none", transformOrigin: "center" }}
              className="rounded-lg shadow-2xl select-none"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
