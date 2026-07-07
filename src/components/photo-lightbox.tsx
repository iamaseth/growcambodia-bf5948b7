import { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

export function PhotoLightbox({
  images,
  startIndex = 0,
  onClose,
}: {
  images: string[];
  startIndex?: number;
  onClose: () => void;
}) {
  const [i, setI] = useState(startIndex);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setI((v) => Math.max(0, v - 1));
      if (e.key === "ArrowRight") setI((v) => Math.min(images.length - 1, v + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [images.length, onClose]);

  const swipe = (endX: number) => {
    if (touchStart === null) return;
    const d = endX - touchStart;
    if (d > 50) setI((v) => Math.max(0, v - 1));
    else if (d < -50) setI((v) => Math.min(images.length - 1, v + 1));
    setTouchStart(null);
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center touch-none"
      onClick={onClose}
      onTouchStart={(e) => setTouchStart(e.touches[0].clientX)}
      onTouchEnd={(e) => swipe(e.changedTouches[0].clientX)}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white bg-white/10 hover:bg-white/20 rounded-full p-2 z-10"
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>
      {i > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); setI(i - 1); }}
          className="absolute left-2 md:left-4 text-white bg-white/10 hover:bg-white/20 rounded-full p-2"
          aria-label="Previous"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      {i < images.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); setI(i + 1); }}
          className="absolute right-2 md:right-4 text-white bg-white/10 hover:bg-white/20 rounded-full p-2"
          aria-label="Next"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}
      <img
        src={images[i]}
        alt=""
        className="max-h-[95vh] max-w-[95vw] object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-sm bg-black/40 rounded-full px-3 py-1">
          {i + 1} / {images.length}
        </div>
      )}
    </div>
  );
}
