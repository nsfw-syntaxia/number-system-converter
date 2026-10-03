/* ============================================================
   bcd.js — BCD (8421) addition and subtraction by 9's and 10's
   complement (no DOM here)
   Depends on: rational.js

   BCD (binary-coded decimal, 8421): every decimal digit is its own
   4-bit group, e.g. 25 -> 0010 0101.

   A word holds D decimal digits. The leading digit is the sign digit,
   so every value must satisfy |v| < 10^(D-1):
     positive -> leading digit 0        negative -> leading digit 9

   Addition: add digit by digit. If a digit sum is greater than 9, add 6
   (0110) to correct it and carry 1 into the next digit.

   Subtraction A - B by adding a complement:
     9's  : add the 9's complement of B (every digit 9 - d).
            A carry out of the top digit is added back (end-around carry).
            No carry means the result is negative.
     10's : add the 10's complement of B (9's complement + 1).
            A carry out of the top digit is dropped.
            No carry means the result is negative.
   ============================================================ */

/** Word sizes (in decimal digits) the user can pick besides "auto". */
const BCD_DIGIT_CHOICES = [3, 4, 6, 8];

/** Auto mode never goes below this many digits. */
const BCD_MIN_DIGITS = 2;

const pow10 = (k) => 10n ** BigInt(k);
const nines = (D) => pow10(D) - 1n;

/** Number of decimal digits in a non-negative BigInt. */
const decimalDigits = (x) => x.toString().length;

/**
 * Check the inputs are whole, non-negative numbers and choose the word size D.
 * "auto" = smallest size that holds every running sum and difference plus a sign digit.
 * A fixed size must hold them too, or an Error is thrown.
 */
function bcdWidth(values, choice) {
  values.forEach((v, i) => {
    if (!ratIsInt(v)) throw new Error(`BCD needs whole numbers — input ${i + 1} has a fractional part.`);
    if (v.n < 0n) throw new Error(`BCD needs non-negative numbers — input ${i + 1} is negative.`);
  });

  // one word serves both operations, so include running sums and differences
  let worst = 0n, sum = 0n, diff = 0n;
  values.forEach((v, k) => {
    sum += v.n;
    diff = k === 0 ? v.n : diff - v.n;
    for (const r of [v.n, sum, diff]) {
      const mag = r < 0n ? -r : r;
      if (mag > worst) worst = mag;
    }
  });

  const need = decimalDigits(worst) + 1;          // +1 reserves the sign digit
  if (choice === "auto") return Math.max(BCD_MIN_DIGITS, need);
  if (need > choice) {
    throw new Error(`These values need at least ${need} digits (one is the sign digit), ` +
      `so a ${choice}-digit word is too small — choose a larger word size.`);
  }
  return choice;
}

/** The D decimal digits of a residue p (0 .. 10^D - 1), most significant first. */
const digitsOf = (p, D) => p.toString().padStart(D, "0").split("").map(Number);

/** 8421 groups of a residue, e.g. 25 with D = 3 -> "0000 0010 0101". */
const bcdString = (p, D) => digitsOf(p, D).map(d => d.toString(2).padStart(4, "0")).join(" ");

/** 9's complement: every digit becomes 9 - d. */
const complement9 = (v, D) => nines(D) - v;

/** 10's complement: the 9's complement plus 1 (mod 10^D). */
const complement10 = (v, D) => (pow10(D) - v) % pow10(D);

/**
 * BCD addition of two residues a + b, digit by digit with the +6 correction.
 * Returns the columns (most significant first), the sum digits and the carry out of the top digit.
 */
function bcdAdd(a, b, D) {
  const A = digitsOf(a, D), B = digitsOf(b, D);
  const cols = [];
  let carry = 0;
  for (let i = D - 1; i >= 0; i--) {
    const raw = A[i] + B[i] + carry;          // plain binary-style digit sum (0 .. 19)
    const corrected = raw > 9;                 // needs +6 (0110) and a carry
    const digit = corrected ? raw - 10 : raw;
    cols.unshift({ a: A[i], b: B[i], cin: carry, raw, corrected, digit });
    carry = corrected ? 1 : 0;
  }
  const sum = BigInt(cols.map(c => c.digit).join(""));
  return { cols, sum, carry };
}

/** One subtraction A - B by adding the 9's or 10's complement of B. */
function bcdSubtractStep(acc, b, D, method) {
  const negB = method === 9 ? complement9(b, D) : complement10(b, D);
  const add = bcdAdd(acc, negB, D);
  let result = add.sum, endAround = null;
  if (method === 9 && add.carry) {          // end-around carry
    endAround = bcdAdd(result, 1n, D);
    result = endAround.sum;
  }
  return { acc, b, negB, add, endAround, result };
}

/**
 * Read a D-digit residue back as a signed number.
 * Leading digit 9 means negative; the magnitude is its 9's (or 10's) complement.
 */
function bcdDecode(r, D, method) {
  if (r / pow10(D - 1) !== 9n) return { value: r, negZero: false };
  const mag = method === 9 ? nines(D) - r : pow10(D) - r;
  return { value: -mag, negZero: method === 9 && mag === 0n };
}

/**
 * v1 - v2 - v3 ... by the 9's or 10's complement, left to right.
 * Every step is checked against plain subtraction, so an undersized word is reported.
 */
function bcdChainSubtract(ints, D, method) {
  let acc = ints[0], truth = ints[0];
  const steps = [];
  for (let k = 1; k < ints.length; k++) {
    const step = bcdSubtractStep(acc, ints[k], D, method);
    const next = truth - ints[k];
    const { value, negZero } = bcdDecode(step.result, D, method);
    if (value !== next) {
      throw new Error(`The ${D}-digit word overflowed at step ${k} — choose a larger word size.`);
    }
    steps.push({ ...step, aValue: truth, bValue: ints[k], value, negZero });
    acc = step.result;
    truth = next;
  }
  const last = steps[steps.length - 1];
  return { steps, pattern: acc, value: truth, negZero: last ? last.negZero : false };
}

/** v1 + v2 + v3 ... in BCD, left to right. */
function bcdChainAdd(ints, D) {
  let acc = ints[0], truth = ints[0];
  const steps = [];
  for (let k = 1; k < ints.length; k++) {
    const add = bcdAdd(acc, ints[k], D);
    const next = truth + ints[k];
    if (add.carry || add.sum !== next) {
      throw new Error(`The ${D}-digit word overflowed at step ${k} — choose a larger word size.`);
    }
    steps.push({ a: acc, b: ints[k], add, aValue: truth, bValue: ints[k], result: add.sum, value: next });
    acc = add.sum;
    truth = next;
  }
  return { steps, pattern: acc, value: truth };
}
