import React, { useState, useRef, useCallback } from "react";
import { Upload, X, Image as ImageIcon, ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import type { PaymentProof } from "../../../types";
import { validatePaymentProof, fileToBase64 } from "../../../utils/validation";

// ─── Swap point: Replace this component with MayaPaymentStep when merchant account is ready ───

interface Props {
  subtotal: number;
  paymentProof: PaymentProof | null;
  onProofChange: (proof: PaymentProof | null) => void;
  onBack: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  error: string | null;
}

const PaymentStep: React.FC<Props> = ({
  subtotal,
  paymentProof,
  onProofChange,
  onBack,
  onSubmit,
  isSubmitting,
  error,
}) => {
  const [fileError, setFileError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    async (file: File) => {
      setFileError(null);
      setIsProcessing(true);
      try {
        const result = await validatePaymentProof(file);
        if (!result.valid) {
          setFileError(result.error || "Invalid file.");
          return;
        }
        const base64 = await fileToBase64(file);
        onProofChange({
          base64,
          mimeType: file.type,
          fileName: file.name,
          fileSize: file.size,
        });
      } catch {
        setFileError("Failed to read file. Please try again.");
      } finally {
        setIsProcessing(false);
      }
    },
    [onProofChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // Reset so same file can be re-selected
    e.target.value = "";
  };

  const removeProof = () => {
    onProofChange(null);
    setFileError(null);
  };

  return (
    <div className="space-y-6">
      {/* Two-column layout: QR | Upload — stacks on mobile */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ─── QR Section ─── */}
        <div className="text-center">
          <h3 className="font-arvo font-bold text-brand-text text-base mb-3">
            Scan to Pay
          </h3>

          {/* QR Image — the file is a self-contained InstaPay card, so it needs
              no extra card/border chrome of its own. */}
          <div className="mx-auto mb-3 w-full max-w-[260px]">
            <img
              src="/images/momma_mia_qr_code_payment.jpg"
              alt="Momma Mia InstaPay payment QR code (BPI)"
              className="w-full h-auto rounded-xl shadow-sm"
              onError={(e) => {
                // Graceful fallback if the QR image is missing
                (e.target as HTMLImageElement).style.display = "none";
                (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
              }}
            />
            <div className="hidden aspect-square w-full flex flex-col items-center justify-center bg-brand-secondary rounded-xl px-4 text-center">
              <p className="font-poppins text-xs text-brand-text/40">
                QR code image not found.
                <br />
                Add momma_mia_qr_code_payment.jpg to public/images/
              </p>
            </div>
          </div>

          {/* Amount badge */}
          <div className="inline-block bg-brand-primary/10 text-brand-primary font-arvo font-bold text-lg px-4 py-1.5 rounded-full mb-4">
            &#8369;{subtotal}
          </div>

          {/* Instructions */}
          <ol className="text-left space-y-2 font-poppins text-sm text-brand-text/70 max-w-xs mx-auto">
            <li className="flex gap-2">
              <span className="shrink-0 w-5 h-5 rounded-full bg-brand-primary text-white text-xs flex items-center justify-center font-semibold">
                1
              </span>
              Open GCash, Maya, or your bank app
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-5 h-5 rounded-full bg-brand-primary text-white text-xs flex items-center justify-center font-semibold">
                2
              </span>
              Scan the QR code and pay &#8369;{subtotal}
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-5 h-5 rounded-full bg-brand-primary text-white text-xs flex items-center justify-center font-semibold">
                3
              </span>
              Screenshot your payment receipt
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-5 h-5 rounded-full bg-brand-primary text-white text-xs flex items-center justify-center font-semibold">
                4
              </span>
              Upload the receipt below
            </li>
          </ol>
        </div>

        {/* ─── Upload Section ─── */}
        <div>
          <h3 className="font-arvo font-bold text-brand-text text-base mb-1">
            Upload Payment Receipt <span className="text-red-500">*</span>
          </h3>
          <p className="font-poppins text-xs text-brand-text/50 mb-3">
            Required to confirm payment — we attach this to your order.
          </p>

          {paymentProof ? (
            /* Preview */
            <div className="border-2 border-green-300 bg-green-50 rounded-xl p-4 text-center">
              <img
                src={paymentProof.base64}
                alt="Payment receipt preview"
                className="max-h-48 mx-auto rounded-lg mb-3 shadow-sm"
              />
              <p className="font-poppins text-sm text-brand-text truncate mb-1">
                {paymentProof.fileName}
              </p>
              <p className="font-poppins text-xs text-brand-text/40 mb-3">
                {(paymentProof.fileSize / 1024).toFixed(0)} KB
              </p>
              <button
                type="button"
                onClick={removeProof}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-poppins font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
              >
                <X size={14} />
                Remove
              </button>
            </div>
          ) : (
            /* Drop zone */
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                isDragOver
                  ? "border-brand-primary bg-brand-primary/5 scale-[1.01]"
                  : "border-brand-divider hover:border-brand-primary/50 hover:bg-brand-secondary/50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic"
                onChange={handleFileSelect}
                className="hidden"
              />

              {isProcessing ? (
                <Loader2
                  size={32}
                  className="mx-auto text-brand-primary animate-spin mb-2"
                />
              ) : (
                <div className="mx-auto w-12 h-12 rounded-full bg-brand-secondary flex items-center justify-center mb-3">
                  {isDragOver ? (
                    <ImageIcon size={24} className="text-brand-primary" />
                  ) : (
                    <Upload size={24} className="text-brand-text/30" />
                  )}
                </div>
              )}

              <p className="font-poppins text-sm font-medium text-brand-text mb-1">
                {isDragOver
                  ? "Drop your screenshot here"
                  : "Drag & drop your screenshot"}
              </p>
              <p className="font-poppins text-xs text-brand-text/40">
                or click to browse — JPEG, PNG, WebP (max 5MB)
              </p>
            </div>
          )}

          {/* File error */}
          {fileError && (
            <div className="mt-3 flex items-start gap-2 p-3 bg-red-50 rounded-lg">
              <AlertCircle
                size={16}
                className="text-red-500 shrink-0 mt-0.5"
              />
              <p className="font-poppins text-sm text-red-600">{fileError}</p>
            </div>
          )}
        </div>
      </div>

      {/* Submission error */}
      {error && (
        <p className="text-red-500 font-poppins text-sm text-center">
          {error}
        </p>
      )}

      {/* Required-receipt hint — explains why "Submit" is disabled */}
      {!paymentProof && !error && (
        <p className="flex items-center justify-center gap-1.5 font-poppins text-sm text-brand-text/50 text-center">
          <AlertCircle size={14} className="shrink-0" />
          Upload your payment receipt to enable the order.
        </p>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className="flex items-center gap-2 px-5 py-3 rounded-xl font-poppins font-medium text-sm border border-brand-divider text-brand-text hover:bg-brand-secondary transition-colors disabled:opacity-50"
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!paymentProof || isSubmitting}
          className="flex-1 flex items-center justify-center gap-2.5 py-3 rounded-xl font-poppins font-semibold text-sm bg-gradient-to-r from-brand-primary to-brand-accent text-white shadow-lg shadow-brand-primary/25 hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-lg"
        >
          {isSubmitting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Submitting...
            </>
          ) : (
            <>Submit Order &middot; &#8369;{subtotal}</>
          )}
        </button>
      </div>
    </div>
  );
};

export default PaymentStep;
