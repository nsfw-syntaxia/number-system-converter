/* ============================================================
   converter.js — number-system conversion core (no DOM here)
   Depends on: rational.js
   ============================================================ */

/**
 * Metadata for every supported base:
 *  - name  : short code shown in the UI
 *  - label : full human name
 *  - re    : charset for ONE run of digits (checked per part around ".")
 *  - hint  : phrase used in validation messages
 */
const BASES = {
  2:  { name: "BIN", label: "Binary",      re: /^[0-1]*$/,     hint: "digits 0 and 1, with an optional point for a fraction" },
  8:  { name: "OCT", label: "Octal",       re: /^[0-7]*$/,     hint: "digits 0 to 7, with an optional point for a fraction" },
  10: { name: "DEC", label: "Decimal",     re: /^[0-9]*$/,     hint: "digits 0 to 9, with an optional point for a fraction" },
  16: { name: "HEX", label: "Hexadecimal", re: /^[0-9A-F]*$/,  hint: "digits 0 to 9 and A to F, with an optional point for a fraction" }
};

/** Order the bases are always listed in. */
const BASE_ORDER = [2, 8, 10, 16];

/** How many fractional digits to emit before giving up on a repeating expansion. */
const MAX_FRAC_DIGITS = 24;

/** True when `body` (already sign-stripped, upper-cased) is a valid number in `base`. */
function isValidDigits(body, base) {
  if (body === "" || body === ".") return false;
  const parts = body.split(".");
  if (parts.length > 2) return false;                 // more than one point
  if (parts[0] === "" && (parts[1] || "") === "") return false;
  return parts.every(part => BASES[base].re.test(part));
}

/**
 * Parse a user string written in `base` into a rational { n, d }.
 * Accepts an optional leading "-" and an optional fractional part,
 * e.g. "1010.1" (base 2), "3.5" (base 10), "A.8" (base 16), ".4" (base 8).
 *
 * Throws Error("empty") when blank, or a descriptive Error on bad digits.
 */
function parseValue(raw, base) {
  const s = raw.trim();
  if (s === "") throw new Error("empty");

  const negative = s.startsWith("-");
  const body = (negative ? s.slice(1) : s).toUpperCase();

  if (!isValidDigits(body, base)) {
    throw new Error(BASES[base].label + " uses " + BASES[base].hint + ".");
  }

  const [intText, fracText = ""] = body.split(".");
  const B = BigInt(base);

  let intVal = 0n;
  for (const ch of intText) intVal = intVal * B + BigInt(parseInt(ch, base));

  let fracVal = 0n;
  let denom = 1n;
  for (const ch of fracText) {
    fracVal = fracVal * B + BigInt(parseInt(ch, base));
    denom *= B;
  }

  const value = rat(intVal * denom + fracVal, denom);
  return negative ? ratNeg(value) : value;
}

/**
 * Render a rational into `base`, with a fractional part when needed.
 * Returns { text, truncated } — `truncated` is true (and "…" is appended)
 * when the expansion repeats past MAX_FRAC_DIGITS places.
 */
function toBaseParts(value, base) {
  const B = BigInt(base);
  const negative = value.n < 0n;
  const n = negative ? -value.n : value.n;
  const d = value.d;

  const intPart = n / d;
  let rem = n % d;

  let text = intPart.toString(base).toUpperCase();
  let truncated = false;

  if (rem !== 0n) {
    let frac = "";
    for (let i = 0; i < MAX_FRAC_DIGITS; i++) {
      rem *= B;
      frac += (rem / d).toString(base).toUpperCase();
      rem %= d;
      if (rem === 0n) break;
    }
    if (rem !== 0n) truncated = true;
    text += "." + frac;
  }

  return { text: (negative ? "-" : "") + text + (truncated ? "…" : ""), truncated };
}

/** Convenience: just the string form in `base`. */
function toBase(value, base) {
  return toBaseParts(value, base).text;
}
