import React, { useEffect, useRef, useState } from "react";
import { uploadMenuImage } from "../../services/menuImages";

interface ImageUploaderProps {
  value: string;
  onChange: (url: string) => void;
  onError?: (message: string) => void;
  heightClass?: string;
}

const actionClass =
  "inline-flex items-center gap-1.5 rounded-lg border border-brand-divider bg-white px-3 py-2 " +
  "font-arvo-bold text-sm transition-colors cursor-pointer focus:outline-none " +
  "focus:ring-2 focus:ring-brand-primary disabled:opacity-50 disabled:cursor-not-allowed";

/**
 * Drag-and-drop / click photo uploader with live preview.
 *
 * The controls are ALWAYS rendered. They used to live in a `group-hover`
 * overlay at opacity-0, which made editing an existing photo undiscoverable on
 * desktop and impossible on touch — and completely unusable when the stored URL
 * was dead, because the only target was a broken-image box.
 */
const ImageUploader: React.FC<ImageUploaderProps> = ({
  value,
  onChange,
  onError,
  heightClass = "h-44",
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [broken, setBroken] = useState(false);

  // Give every new URL a fresh chance to load.
  useEffect(() => setBroken(false), [value]);

  const pick = () => inputRef.current?.click();

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      onError?.("Please choose an image file (JPG, PNG, etc).");
      return;
    }
    setUploading(true);
    try {
      onChange(await uploadMenuImage(file));
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Image upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const hasPreview = Boolean(value) && !broken;

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          // Reset so picking the SAME file again still fires a change event.
          e.target.value = "";
        }}
      />

      {hasPreview ? (
        <div
          className={`relative ${heightClass} w-full overflow-hidden rounded-xl border border-brand-divider bg-brand-secondary`}
        >
          <img
            src={value}
            alt="Dish photo preview"
            className="h-full w-full object-cover"
            onError={() => setBroken(true)}
          />
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-brand-primary/30 border-t-brand-primary" />
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={pick}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void handleFile(e.dataTransfer.files?.[0]);
          }}
          className={`w-full ${heightClass} flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-primary ${
            dragging
              ? "border-brand-primary bg-brand-primary/5 text-brand-primary"
              : "border-brand-divider text-brand-text/50 hover:border-brand-primary hover:text-brand-primary"
          }`}
        >
          {uploading ? (
            <>
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-brand-primary/30 border-t-brand-primary" />
              <span className="font-poppins text-sm">Uploading…</span>
            </>
          ) : (
            <>
              <i className="pi pi-camera text-2xl" aria-hidden="true" />
              <span className="font-poppins text-sm">Drag a photo here, or click to choose</span>
            </>
          )}
        </button>
      )}

      {/* Tell the admin WHY there's no preview, and keep the stored value
          recoverable — clearing it is a deliberate click, not a side effect. */}
      {value && broken && (
        <p className="flex items-start gap-1.5 font-poppins text-xs text-amber-700">
          <i className="pi pi-exclamation-triangle mt-0.5 text-[11px]" aria-hidden="true" />
          <span>This dish's saved photo can't be loaded. Upload a new one to replace it.</span>
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={pick}
          disabled={uploading}
          className={`${actionClass} text-brand-text hover:bg-brand-secondary`}
        >
          <i className="pi pi-upload text-xs" aria-hidden="true" />
          {value ? "Change photo" : "Upload photo"}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            disabled={uploading}
            className={`${actionClass} text-red-600 hover:bg-red-50`}
          >
            <i className="pi pi-trash text-xs" aria-hidden="true" />
            Remove
          </button>
        )}
      </div>
    </div>
  );
};

export default ImageUploader;
