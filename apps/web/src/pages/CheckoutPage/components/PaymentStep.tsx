import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload,
  X,
  Image as ImageIcon,
  ArrowLeft,
  Loader2,
  AlertCircle,
  ShieldCheck,
  QrCode,
  CreditCard,
  Check,
} from "lucide-react";
import type { PaymentMethod, PaymentProof } from "../../../types";
import { validatePaymentProof, fileToBase64 } from "../../../utils/validation";
import { loadPayPal, PAYPAL_CLIENT_ID, type PayPalButtonsInstance } from "../../../lib/paypal";

interface Props {
  subtotal: number;
  // ── QR / receipt path ──
  paymentProof: PaymentProof | null;
  onProofChange: (proof: PaymentProof | null) => void;
  /** Submit the QR-paid order (customer transferred in their own bank app). */
  onSubmit: () => void;
  isSubmitting: boolean;
  // ── PayPal path ──
  /** Price + create the order, open a PayPal order, return its id to the SDK. */
  onCreateOrder: () => Promise<string>;
  /** Capture the approved payment; resolves once the order is marked paid. */
  onApprove: () => Promise<void>;
  // ── shared ──
  onBack: () => void;
  // A node, not a string: rejection messages carry a link to /contact.
  error: React.ReactNode;
}

/**
 * The payment step: two ways to pay, one choice.
 *
 *  - "GCash / bank QR" is the free, local default. The customer transfers in
 *    their own app and uploads the receipt; the admin verifies it by eye. This
 *    is the original flow, byte-for-byte in behaviour.
 *  - "PayPal or card" is the verified path: the money is captured against the
 *    server-priced total before any email fires.
 *
 * Both panels stay MOUNTED and toggle with CSS. That is load-bearing for
 * PayPal: its SDK renders into a real DOM node and does not survive that node
 * being unmounted, so hiding beats removing. The SDK itself is only fetched
 * the first time the PayPal tab is opened — QR-only customers never load it.
 */
const PaymentStep: React.FC<Props> = ({
  subtotal,
  paymentProof,
  onProofChange,
  onSubmit,
  isSubmitting,
  onCreateOrder,
  onApprove,
  onBack,
  error,
}) => {
  const [method, setMethod] = useState<PaymentMethod>("qr");

  // ── QR panel state (unchanged from the original PaymentStep) ──
  const [fileError, setFileError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── PayPal panel state ──
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonsRef = useRef<PayPalButtonsInstance | null>(null);
  const [sdkState, setSdkState] = useState<"idle" | "loading" | "ready" | "failed">("idle");
  // True while PayPal has the floor — blocks Back and method switching so the
  // page can't be pulled out from under an open payment window.
  const [paypalBusy, setPaypalBusy] = useState(false);
  const [paypalError, setPaypalError] = useState<string | null>(null);

  // The SDK captures its callbacks when the buttons mount; refs keep the
  // latest handlers reachable without re-mounting the buttons.
  const createRef = useRef(onCreateOrder);
  const approveRef = useRef(onApprove);
  createRef.current = onCreateOrder;
  approveRef.current = onApprove;

  // ── QR: receipt processing ──
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

  // ── PayPal: load the SDK the first time the tab is opened ──
  // startedRef, not sdkState, guards the one-shot: gating on state we set
  // INSIDE the effect re-runs the effect (sdkState is how React knows), and
  // the re-run's cleanup cancelled the very load it had just started — the
  // SDK resolved into a dead closure and the buttons never rendered.
  const startedRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // close() rejects if the buttons never finished rendering; that is fine.
      buttonsRef.current?.close().catch(() => {});
      buttonsRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (method !== "paypal" || startedRef.current) return;
    startedRef.current = true;
    if (!PAYPAL_CLIENT_ID) {
      setSdkState("failed");
      return;
    }
    setSdkState("loading");

    loadPayPal()
      .then((paypal) => {
        if (!mountedRef.current || !containerRef.current) return;

        const buttons = paypal.Buttons({
          style: { layout: "vertical", color: "gold", shape: "pill", label: "pay", height: 48 },

          createOrder: async () => {
            setPaypalError(null);
            setPaypalBusy(true);
            try {
              return await createRef.current();
            } catch (e) {
              // Surface it here as well as rejecting: PayPal swallows the
              // rejection into onError, which carries no useful message.
              setPaypalError(
                e instanceof Error ? e.message : "We couldn't start the payment. Please try again.",
              );
              setPaypalBusy(false);
              throw e;
            }
          },

          onApprove: async () => {
            setPaypalError(null);
            setPaypalBusy(true);
            try {
              await approveRef.current();
            } catch (e) {
              setPaypalError(
                e instanceof Error
                  ? e.message
                  : "Your payment may have gone through but we couldn't confirm it. Please contact us before paying again.",
              );
            } finally {
              setPaypalBusy(false);
            }
          },

          onCancel: () => {
            // Not an error. The order row stays awaiting_payment and the same
            // cart can be paid again without creating a second order.
            setPaypalBusy(false);
            setPaypalError(null);
          },

          onError: (err) => {
            console.error("PayPal button error:", err);
            setPaypalBusy(false);
            // createOrder already wrote a specific message in its own catch;
            // don't overwrite it with this generic one.
            setPaypalError((prev) => prev ?? "Something went wrong with PayPal. Please try again.");
          },
        });

        if (buttons.isEligible && !buttons.isEligible()) {
          setSdkState("failed");
          return;
        }

        buttonsRef.current = buttons;
        buttons
          .render(containerRef.current)
          .then(() => {
            if (mountedRef.current) setSdkState("ready");
          })
          .catch((e) => {
            // A render abort during unmount is expected, not a failure.
            if (!mountedRef.current) return;
            console.error("PayPal buttons failed to render:", e);
            setSdkState("failed");
          });
      })
      .catch((e) => {
        if (!mountedRef.current) return;
        console.error("PayPal SDK failed to load:", e);
        setSdkState("failed");
      });
    // No cleanup here: tab switches only CSS-hide the panel, and the rendered
    // buttons must survive them. Teardown lives in the unmount effect above.
  }, [method]);

  const busy = isSubmitting || paypalBusy;

  const methodCard = (
    m: PaymentMethod,
    icon: React.ReactNode,
    title: string,
    hint: string,
  ) => {
    const active = method === m;
    return (
      <button
        type="button"
        role="radio"
        aria-checked={active}
        disabled={busy}
        onClick={() => setMethod(m)}
        className={`flex-1 flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${
          active
            ? "border-brand-primary bg-brand-primary/5"
            : "border-brand-divider bg-white hover:border-brand-primary/40"
        }`}
      >
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            active ? "bg-brand-primary text-white" : "bg-brand-secondary text-brand-text/50"
          }`}
        >
          {icon}
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 font-poppins text-sm font-semibold text-brand-text">
            {title}
            {active && <Check size={14} className="text-brand-primary shrink-0" />}
          </span>
          <span className="block font-poppins text-xs text-brand-text/50">{hint}</span>
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-6">
      {/* ─── Method chooser ─── */}
      <div role="radiogroup" aria-label="How would you like to pay?" className="flex flex-col sm:flex-row gap-3">
        {methodCard("qr", <QrCode size={19} />, "GCash / bank app", "Scan our QR, upload your receipt")}
        {methodCard("paypal", <CreditCard size={19} />, "PayPal or card", "Pay now, confirmed instantly")}
      </div>

      {/* ─── QR / receipt panel (the original flow, unchanged) ─── */}
      <div className={method === "qr" ? "" : "hidden"}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* QR Section */}
          <div className="text-center">
            <h3 className="font-arvo font-bold text-brand-text text-base mb-3">
              Scan to Pay
            </h3>

            {/* QR Image — the file is a self-contained InstaPay card, so it
                needs no extra card/border chrome of its own. */}
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

            <div className="inline-block bg-brand-primary/10 text-brand-primary font-arvo font-bold text-lg px-4 py-1.5 rounded-full mb-4">
              &#8369;{subtotal}
            </div>

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

          {/* Upload Section */}
          <div>
            <h3 className="font-arvo font-bold text-brand-text text-base mb-1">
              Upload Payment Receipt <span className="text-red-500">*</span>
            </h3>
            <p className="font-poppins text-xs text-brand-text/50 mb-3">
              Required to confirm payment — we attach this to your order.
            </p>

            {paymentProof ? (
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
                  <Loader2 size={32} className="mx-auto text-brand-primary animate-spin mb-2" />
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
                  {isDragOver ? "Drop your screenshot here" : "Drag & drop your screenshot"}
                </p>
                <p className="font-poppins text-xs text-brand-text/40">
                  or click to browse — JPEG, PNG, WebP (max 5MB)
                </p>
              </div>
            )}

            {fileError && (
              <div className="mt-3 flex items-start gap-2 p-3 bg-red-50 rounded-lg">
                <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                <p className="font-poppins text-sm text-red-600">{fileError}</p>
              </div>
            )}
          </div>
        </div>

        {/* Required-receipt hint — explains why "Submit" is disabled */}
        {!paymentProof && !error && (
          <p className="mt-6 flex items-center justify-center gap-1.5 font-poppins text-sm text-brand-text/50 text-center">
            <AlertCircle size={14} className="shrink-0" />
            Upload your payment receipt to enable the order.
          </p>
        )}
      </div>

      {/* ─── PayPal panel ─── */}
      <div className={method === "paypal" ? "" : "hidden"}>
        <div className="mx-auto max-w-md text-center">
          <p className="font-poppins text-sm text-brand-text/50 mb-4">
            Pay with your PayPal balance or any major credit or debit card.
            No PayPal account needed — your order is confirmed the moment the
            payment goes through.
          </p>

          <div className="inline-block bg-brand-primary/10 text-brand-primary font-arvo font-bold text-2xl px-5 py-2 rounded-full mb-6">
            &#8369;{subtotal}
          </div>

          <div className="min-h-[52px]">
            {sdkState === "failed" ? (
              <div
                role="alert"
                className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-left"
              >
                <p className="font-poppins text-sm text-brand-text">
                  {PAYPAL_CLIENT_ID
                    ? "We couldn't load PayPal. Check your connection and refresh, or pay by "
                    : "PayPal isn't switched on yet. Please pay by "}
                  <button
                    type="button"
                    onClick={() => setMethod("qr")}
                    className="underline font-semibold cursor-pointer"
                  >
                    GCash / bank QR
                  </button>{" "}
                  instead.
                </p>
              </div>
            ) : (
              <>
                {(sdkState === "loading" || sdkState === "idle") && (
                  <div className="flex items-center justify-center gap-2 py-4 font-poppins text-sm text-brand-text/50">
                    <Loader2 size={16} className="animate-spin" />
                    Loading secure payment&hellip;
                  </div>
                )}
                {/* Always visible, never display:none — the SDK's render()
                    WAITS for its container to be visible before completing,
                    and completing is what would have unhidden it. An empty
                    div has no height, so nothing shifts while loading. */}
                <div ref={containerRef} />
              </>
            )}
          </div>

          {paypalBusy && (
            <p
              role="status"
              className="mt-4 flex items-center justify-center gap-2 font-poppins text-sm text-brand-text/60"
            >
              <Loader2 size={14} className="animate-spin" />
              Confirming your payment&hellip; please don&rsquo;t close this page.
            </p>
          )}

          <p className="mt-6 flex items-center justify-center gap-1.5 font-poppins text-xs text-brand-text/40">
            <ShieldCheck size={14} className="shrink-0" />
            Your card details go straight to PayPal. This site never sees them.
          </p>
        </div>
      </div>

      {/* Errors from either path (parent submission error or PayPal's own) */}
      {(paypalError || error) && (
        <div role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 p-3">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-500" />
          <p className="font-poppins text-sm text-red-600">
            {method === "paypal" ? paypalError ?? error : error}
          </p>
        </div>
      )}

      {/* Action buttons — Submit only exists on the QR path; PayPal's own
          buttons are the submit on the other. */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className="flex items-center gap-2 px-5 py-3 rounded-xl font-poppins font-medium text-sm border border-brand-divider text-brand-text hover:bg-brand-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowLeft size={16} />
          Back
        </button>
        {method === "qr" && (
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
        )}
      </div>
    </div>
  );
};

export default PaymentStep;
