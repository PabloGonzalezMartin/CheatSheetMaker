"use client";
import { useEffect } from "react";
import { createPortal } from "react-dom";

interface Props {
  src: string;
  onClose: () => void;
}

export function ImageLightbox({ src, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return createPortal(
    <div className="img-lightbox-backdrop" onClick={onClose}>
      <img
        src={src}
        className="img-lightbox-img"
        alt="Zoomed"
        onClick={(e) => e.stopPropagation()}
      />
    </div>,
    document.body
  );
}
