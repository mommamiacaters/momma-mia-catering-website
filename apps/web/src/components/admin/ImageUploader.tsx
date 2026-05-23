import React, { useRef, useState } from "react";
import { uploadMenuImage } from "../../services/menuImages";

interface ImageUploaderProps {
  value: string;
  onChange: (url: string) => void;
  onError?: (message: string) => void;
  heightClass?: string;
}

/** Drag-and-drop / click photo uploader with live preview. Uploads to the
 *  menu-images bucket and returns the public URL. */
const ImageUploader: React.FC<ImageUploaderProps> = ({ value, onChange, onError, heightClass = "h-44" }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

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

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {value ? (
        <div className={`relative ${heightClass} w-full rounded-xl overflow-hidden border border-brand-divider group`}>
          <img src={value} alt="Preview" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
            <button type="button" onClick={() => inputRef.current?.click()} className="rounded-lg bg-white px-3 py-1.5 text-sm font-arvo-bold text-brand-text cursor-pointer">
              Change
            </button>
            <button type="button" onClick={() => onChange("")} className="rounded-lg bg-white px-3 py-1.5 text-sm font-arvo-bold text-red-600 cursor-pointer">
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void handleFile(e.dataTransfer.files?.[0]);
          }}
          className={`w-full ${heightClass} rounded-xl border-2 border-dashed border-brand-divider flex flex-col items-center justify-center gap-2 text-brand-text/50 hover:border-brand-primary hover:text-brand-primary transition-colors cursor-pointer`}
        >
          {uploading ? (
            <>
              <div className="w-6 h-6 border-4 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin" />
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
    </>
  );
};

export default ImageUploader;
