"use client";
import { useRef, useState } from "react";
import { api, withImageToken } from "@/lib/api";
import type { ImageData } from "@/types/cheatsheet";

interface Props {
  image: ImageData | null;
  cheatsheetId: string | undefined;
  onChange: (image: ImageData | null) => void;
}

export function ImageUploadArea({ image, cheatsheetId, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [draggingWidth, setDraggingWidth] = useState<number | null>(null);

  const handleFile = async (file: File) => {
    if (!cheatsheetId) {
      alert("Save the cheatsheet first before uploading images.");
      return;
    }
    if (!file.type.startsWith("image/")) return;
    if (file.size > 10 * 1024 * 1024) { alert("Max 10MB"); return; }

    // Show local preview immediately
    const localUrl = URL.createObjectURL(file);
    setLocalPreview(localUrl);
    setUploading(true);

    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.uploadFile<{ url: string }>(`/api/cheatsheet/${cheatsheetId}/image`, fd);
      onChange({ src: res.url, widthPercent: 100 });
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      URL.revokeObjectURL(localUrl);
      setLocalPreview(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // Showing an uploaded image
  if (image) {
    const displayWidth = draggingWidth ?? image.widthPercent ?? 100;
    return (
      <div
        className="w-full"
        onPointerDown={(e) => e.stopPropagation()}
        onDragStart={(e) => e.stopPropagation()}
        draggable={false}
      >
        {/* Fixed-height container keeps slider from jumping as image width changes */}
        <div className="w-full h-36 bg-gray-50 rounded border flex items-center justify-start overflow-hidden px-2">
          <img
            src={withImageToken(image.src)}
            alt="Section image"
            draggable={false}
            style={{ width: `${displayWidth}%`, maxHeight: "8.5rem" }}
            className="object-contain rounded"
          />
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-xs text-gray-500">Width:</span>
          <input
            type="range"
            min={10}
            max={100}
            value={displayWidth}
            onChange={(e) => setDraggingWidth(Number(e.target.value))}
            onPointerUp={(e) => {
              const v = Number((e.target as HTMLInputElement).value);
              setDraggingWidth(null);
              onChange({ ...image, widthPercent: v });
            }}
            className="flex-1 accent-primary cursor-pointer"
          />
          <span className="text-xs text-gray-500 w-8 text-right">{displayWidth}%</span>
          <button
            onClick={() => onChange(null)}
            className="text-xs text-red-400 hover:text-red-600"
          >✕</button>
        </div>
      </div>
    );
  }

  // Uploading with local preview
  if (localPreview) {
    return (
      <div className="relative inline-block w-full">
        <img
          src={localPreview}
          alt="Uploading…"
          className="max-h-48 rounded border object-contain opacity-60"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="bg-black/50 text-white text-xs px-2 py-1 rounded">Uploading…</span>
        </div>
      </div>
    );
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onClick={() => inputRef.current?.click()}
      className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
      <span className="text-xs text-gray-400">📷 Click or drag to upload image</span>
    </div>
  );
}
