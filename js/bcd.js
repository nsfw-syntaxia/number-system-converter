/* ============================================================
   bcd.js — BCD (8421) addition and subtraction by 9's and 10's
   complement (no DOM here)
   Depends on: rational.js

   BCD (binary-coded decimal, 8421): every decimal digit is its own
   4-bit group, e.g. 25 -> 0010 0101.

   SIGNED word (D digits): the leading digit is the sign digit, so every
   value must satisfy |v| < 10^(D-1):
     positive -> leading digit 0        negative -> leading digit 9
   Negative values are held in complement form (10's form for addition,
   9's or 10's form for subtraction), so the sign digit shows the sign.

   UNSIGNED word (D digits): no sign digit. Values are 0 .. 10^D - 1.
   A carry out of the top digit in addition sets the OVERFLOW flag, and
   a negative subtraction result sets the NEGATIVE flag (it cannot be
   held without a sign digit).

   Addition: digit by digit. If a digit sum is greater than 9, add 6
   (0110) to correct it and carry 1 into the next digit.

   Subtraction A - B by adding a complement (digit-wise 9 - d):
     9's  : add the 9's complement of B. A carry out of the top digit
            is added back (end-around carry). No carry = negative.
     10's : add the 10's complement of B (9's complement + 1).
            A carry out of the top digit is dropped. No carry = negative.
   ============================================================ */

/** Word sizes (in decimal digits) the user can pick besides "auto". */
const BCD_DIGIT_CHOICES = [3, 4, 6, 8];

/** Auto mode never goes below this many digits (signed words). */
const BCD_MIN_DIGITS = 2;

const pow10 = (k) => 10n ** BigInt(k);
const nines = (D) => pow10(D) - 1n;
const modPos = (x, m) => ((x % m) + m) % m;

/** Number of decimal digits in a non-negative BigInt. */
const decimalDigits = (x) => x.toString().length;

/**
 * Check the inputs and choose the word size D.
 *  signed   : "auto" = smallest size that holds every running sum and
 *             difference plus a sign digit; a fixed size must hold them too.
 *  unsigned : no sign digit and no negative inputs. "auto" = the size that holds
 *             every value and running sum; a fixed size must hold the inputs.
 *             Overflow of sums is flagged, not an error.
 */
function bcdWidth(values, choice, signed = true) {
  values.forEach((v, i) => {
    if (!ratIsInt(v)) throw new Error(`BCD needs whole numbers — input ${i + 1} has a fractional part.`);
    if (!signed && v.n < 0n) {
      throw new Error(`Unsigned BCD needs non-negative numbers — input ${i + 1} is negative. ` +
        `Switch to signed BCD to use negative inputs.`);
    }
  });

  // one word serves both operations, so include the running sums (and differences when signed)
  let worst = 0n, sum = 0n, diff = 0n;
  values.forEach((v, k) => {
    sum += v.n;
    diff = k === 0 ? v.n : diff - v.n;
    const candidates = signed ? [v.n, sum, diff] : [v.n, sum];
    for (const r of candidates) {
      const mag = r < 0n ? -r : r;
      if (mag > worst) worst = mag;
    }
  });

  if (signed) {
    const need = decimalDigits(worst) + 1;      // +1 reserves the sign digit
    if (choice === "auto") return Math.max(BCD_MIN_DIGITS, need);
    if (need > choice) {
      throw new Error(`These values need at least ${need} digits (one is the sign digit), ` +
        `so a ${choice}-digit word is too small — choose a larger word size.`);
    }
    return choice;
  }

  const inputNeed = Math.max(...values.map(v => decimalDigits(v.n)));
  if (choice === "auto") return Math.max(1, decimalDigits(worst));
  if (inputNeed > choice) {
    throw new Error(`An input needs ${inputNeed} digits, so a ${choice}-digit word is too small — ` +
      `choose a larger word size.`);
  }
  return choice;
}

/** The D decimal digits of a residue p (0 .. 10^D - 1), most significant first. */
const digitsOf = (p, D) => p.toString().padStart(D, "0").split("").map(Number);

/** 8421 groups of a residue, e.g. 25 with D = 3 -> "0000 0010 0101". */
const bcdString = (p, D) => digitsOf(p, D).map(d => d.toString(2).padStart(4, "0")).join(" ");

/** Packed BCD: two digits per byte; signed words end with a sign nibble (C = +, D = -). */
function packedString(n, signed = true, negative = false) {
  const m = n < 0n ? -n : n;
  let digits = m.toString();
  const nibbleCount = digits.length + (signed ? 1 : 0);
  if (nibbleCount % 2 === 1) digits = "0" + digits;
  const nibbles = digits + (signed ? (negative ? "D" : "C") : "");
  return nibbles.match(/.{2}/g).join(" ");
}

/** 9's complement: every digit becomes 9 - d (valid for any residue). */
const complement9 = (v, D) => nines(D) - v;

/** 10's complement: the 9's complement plus 1 (mod 10^D). */
const complement10 = (v, D) => (pow10(D) - v) % pow10(D);

/**
 * Residue used for an operand. Negative values (signed words only) are held in
 * 10's form for addition and in 9's or 10's form for subtraction.
 */
function encodeOperand(v, D, method) {
  if (v >= 0n) return v;
  return method === 9 ? nines(D) + v : pow10(D) + v;
}

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

/** One subtraction A - B by adding the 9's or 10's complement of B (residues). */
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
 * Read a D-digit residue back as a signed number (signed words).
 * Leading digit 9 means negative; the magnitude is its 9's (or 10's) complement.
 */
function bcdDecode(r, D, method) {
  if (r / pow10(D - 1) !== 9n) return { value: r, negZero: false };
  const mag = method === 9 ? nines(D) - r : pow10(D) - r;
  return { value: -mag, negZero: method === 9 && mag === 0n };
}

/**
 * v1 - v2 - v3 ... by the 9's or 10's complement, left to right.
 * Signed: every step is decoded and checked against plain subtraction.
 * Unsigned: every step is checked modulo the word, and a negative result sets `negative`.
 */
function bcdChainSubtract(ints, D, method, signed = true) {
  const M = method === 9 ? nines(D) : pow10(D);
  let acc = encodeOperand(ints[0], D, method), truth = ints[0];
  const steps = [];
  for (let k = 1; k < ints.length; k++) {
    const b = encodeOperand(ints[k], D, method);
    const step = bcdSubtractStep(acc, b, D, method);
    const next = truth - ints[k];
    let value = next, negZero = false;
    if (signed) {
      const d = bcdDecode(step.result, D, method);
      if (d.value !== next) {
        throw new Error(`The ${D}-digit word overflowed at step ${k} — choose a larger word size.`);
      }
      negZero = d.negZero;
    } else if (modPos(step.result - next, M) !== 0n) {
      throw new Error(`The ${D}-digit word overflowed at step ${k} — choose a larger word size.`);
    }
    steps.push({ ...step, aValue: truth, bValue: ints[k], value, negZero });
    acc = step.result;
    truth = next;
  }
  const last = steps[steps.length - 1];
  return { steps, pattern: acc, value: truth, negZero: last ? last.negZero : false, negative: truth < 0n };
}

/**
 * v1 + v2 + v3 ... in BCD, left to right.
 * Signed: a result that does not fit throws. Unsigned: a carry out of the top digit sets `overflow`
 * on that step (the word keeps the low D digits).
 */
function bcdChainAdd(ints, D, signed = true) {
  const M = pow10(D);
  let acc = encodeOperand(ints[0], D, 10), truth = ints[0];
  const steps = [];
  let overflow = false;
  for (let k = 1; k < ints.length; k++) {
    const b = encodeOperand(ints[k], D, 10);
    const add = bcdAdd(acc, b, D);             // carry out of the top digit is dropped (mod 10^D)
    const next = truth + ints[k];
    let stepOverflow = false;
    if (signed) {
      const d = bcdDecode(add.sum, D, 10);
      if (d.value !== next) {
        throw new Error(`The ${D}-digit word overflowed at step ${k} — choose a larger word size.`);
      }
    } else {
      if (modPos(add.sum - next, M) !== 0n) {
        throw new Error(`The ${D}-digit word overflowed at step ${k} — choose a larger word size.`);
      }
      stepOverflow = next >= M;
      overflow = overflow || stepOverflow;
    }
    steps.push({ a: acc, b, add, aValue: truth, bValue: ints[k], result: add.sum, value: next, overflow: stepOverflow });
    acc = add.sum;
    truth = next;
  }
  return { steps, pattern: acc, value: truth, overflow };
}
