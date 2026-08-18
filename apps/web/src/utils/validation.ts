// Input sanitization + file validation for checkout flow
// Swap-ready: these utils work for both QR upload and Maya API flows

/** Strip HTML tags, trim, and truncate */
export function sanitizeText(value: string, maxLen = 500): string {
  return value.replace(/<[^>]*>/g, "").trim().slice(0, maxLen);
}

/** Lowercase, trim, and validate email format */
export function sanitizeEmail(value: string): string {
  return value.toLowerCase().trim();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value);
}

// ─── File Validation (QR screenshot proof) ───

const ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
]);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Magic bytes for MIME verification
const MAGIC_BYTES: [string, number[]][] = [
  ["image/jpeg", [0xff, 0xd8, 0xff]],
  ["image/png", [0x89, 0x50, 0x4e, 0x47]],
  // WebP: starts with RIFF....WEBP
  ["image/webp", [0x52, 0x49, 0x46, 0x46]],
];

async function readMagicBytes(file: File): Promise<Uint8Array> {
  const slice = file.slice(0, 12);
  const buf = await slice.arrayBuffer();
  return new Uint8Array(buf);
}

export async function validatePaymentProof(
  file: File
): Promise<{ valid: boolean; error?: string }> {
  if (!ALLOWED_MIMES.has(file.type)) {
    return { valid: false, error: "Only JPEG, PNG, WebP, or HEIC images are accepted." };
  }

  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return { valid: false, error: `File is ${sizeMB}MB. Maximum size is 5MB.` };
  }

  // Magic bytes check (skip for HEIC — no simple signature)
  if (file.type !== "image/heic") {
    const bytes = await readMagicBytes(file);
    const matched = MAGIC_BYTES.some(([, sig]) =>
      sig.every((b, i) => bytes[i] === b)
    );
    if (!matched) {
      return { valid: false, error: "File contents don't match the expected image format." };
    }
    // Extra check for WebP: bytes 8-11 must be "WEBP"
    if (file.type === "image/webp") {
      const webpSig = [0x57, 0x45, 0x42, 0x50];
      const isWebp = webpSig.every((b, i) => bytes[8 + i] === b);
      if (!isWebp) {
        return { valid: false, error: "File contents don't match WebP format." };
      }
    }
  }

  return { valid: true };
}

/** Convert File to data URI (base64) */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Order reference: MM-XXXXXX. Six characters from an unambiguous uppercase
 * alphabet (no 0/O/1/I/L) — short enough to read over the phone, ~900M combos
 * so collisions are a non-issue at this store's volume. The date/time the old
 * MM-YYYYMMDD-HHMM-xxxx format carried is already on the order row; existing
 * refs keep their old format (the DB constraint accepts both).
 */
export function generateSecureOrderRef(): string {
  const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  const arr = new Uint8Array(6);
  crypto.getRandomValues(arr);
  let out = "";
  for (const b of arr) out += alphabet[b % alphabet.length];
  return `MM-${out}`;
}
