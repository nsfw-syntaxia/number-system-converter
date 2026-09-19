/* ============================================================
   complement.js — 1's / 2's complements and subtraction by
   complement (no DOM here)
   Depends on: rational.js

   Everything works on a fixed-width binary "word" of w bits:

     pattern      a BigInt in 0 .. 2^w - 1 (the raw bits)
     1's comp.    flip every bit                 = 2^w - 1 - p
     2's comp.    flip every bit, then add 1     = 2^w - p (mod 2^w)

   A pattern is read as a signed value by its top (sign) bit. How a
   negative number is *stored* depends on the system:

     2's complement   -v is stored as 2^w - v
     1's complement   -v is stored as 2^w - 1 - v   (so -0 = all ones)

   Only whole numbers have complements here; fractional inputs are
   reported back to the UI instead of being rounded.
   ============================================================ */

/** Word sizes the user can pick besides "auto". */
const WORD_CHOICES = [8, 16, 32];

/** Auto mode never goes below this many bits. */
const MIN_WORD = 8;

/** Digits per base when a pattern is written out zero-padded to the word size. */
const BITS_PER_DIGIT = { 2: 1, 8: 3, 16: 4 };

/** Number of bits in |x| (at least 1). */
function bitLength(x) {
  if (x < 0n) x = -x;
  return x === 0n ? 1 : x.toString(2).length;
}

const wordMask = (w) => (1n << BigInt(w)) - 1n;

/** Bits needed to hold every value in `ints` as a signed number (magnitude + sign bit). */
function bitsNeeded(ints) {
  return ints.reduce((most, v) => Math.max(most, bitLength(v) + 1), 2);
}

/** Running results of v0 - v1 - v2 - ... (BigInt), first element is v0 itself. */
function chainValues(ints) {
  const running = [ints[0]];
  for (let k = 1; k < ints.length; k++) running.push(running[k - 1] - ints[k]);
  return running;
}

/**
 * Pick the word size for these rational values.
 *   choice = "auto" -> smallest multiple of 4, at least MIN_WORD bits, that holds
 *                      every whole-number input and (when they are all whole)
 *                      every running result of v1 - v2 - v3 ...
 *   choice = 8 | 16 | 32 -> that size, or an Error when the values do not fit.
 */
function complementWidth(values, choice) {
  const whole = values.filter(ratIsInt).map(v => v.n);
  const sized = whole.length === values.length ? whole.concat(chainValues(whole)) : whole;
  const need = bitsNeeded(sized);

  if (choice === "auto") return Math.max(MIN_WORD, Math.ceil(need / 4) * 4);
  if (need > choice) {
    throw new Error(`These values need at least ${need} bits (one is the sign bit), ` +
      `so a ${choice}-bit word is too small — choose a larger word size.`);
  }
  return choice;
}

/** Store the whole number v in a w-bit word using the given system (1 or 2). */
function encodeValue(v, w, system) {
  if (v >= 0n) return v;
  return system === 1 ? wordMask(w) + v : (1n << BigInt(w)) + v;
}

/** Read a w-bit pattern back as a signed number. `negZero` flags 1's complement "-0". */
function decodeValue(p, w, system) {
  if ((p >> BigInt(w - 1)) === 0n) return { value: p, negZero: false };
  const magnitude = system === 1 ? wordMask(w) ^ p : (1n << BigInt(w)) - p;
  return { value: -magnitude, negZero: system === 1 && magnitude === 0n };
}

const onesComplement = (p, w) => wordMask(w) ^ p;
const twosComplement = (p, w) => (onesComplement(p, w) + 1n) & wordMask(w);

/** Complement of a pattern in the requested system (1 or 2). */
const complementOf = (p, w, system) =>
  system === 1 ? onesComplement(p, w) : twosComplement(p, w);

/** The number itself plus its 1's and 2's complement, all as w-bit patterns. */
function complementsOf(v, w) {
  const number = encodeValue(v, w, 2);
  return { number, ones: onesComplement(number, w), twos: twosComplement(number, w) };
}

/** Write a pattern in `base`, zero-padded to the word size (decimal is not padded). */
function formatPattern(p, w, base) {
  const text = p.toString(base).toUpperCase();
  return base === 10 ? text : text.padStart(Math.ceil(w / BITS_PER_DIGIT[base]), "0");
}

/**
 * One subtraction A - B done by adding the complement of B.
 *
 *   1's: add the 1's complement of B; a carry out of the top bit is added
 *        back in (end-around carry). No carry means the result is negative.
 *   2's: add the 2's complement of B; a carry out of the top bit is dropped.
 *        No carry means the result is negative.
 *
 * `pa` / `pb` are patterns already stored in `system`'s form.
 */
function subtractStep(pa, pb, w, system) {
  const negB = complementOf(pb, w, system);
  const raw = pa + negB;
  const carry = raw > wordMask(w);
  const sum = raw & wordMask(w);
  const result = carry && system === 1 ? sum + 1n : sum;
  const { value, negZero } = decodeValue(result, w, system);
  return { pa, pb, negB, sum, carry, endAround: carry && system === 1, result, value, negZero };
}

/**
 * Fold v0 - v1 - v2 ... using subtractStep() at every step.
 * Every step is checked against plain BigInt subtraction, so a word that is
 * too small can never quietly give a wrong answer.
 */
function chainSubtract(ints, w, system) {
  let acc = encodeValue(ints[0], w, system);
  let truth = ints[0];
  const steps = [];

  for (let k = 1; k < ints.length; k++) {
    const before = truth;
    truth -= ints[k];
    const step = subtractStep(acc, encodeValue(ints[k], w, system), w, system);
    if (step.value !== truth) {
      throw new Error(`The ${w}-bit word overflowed at step ${k} — choose a larger word size.`);
    }
    steps.push({ ...step, aValue: before, bValue: ints[k] });
    acc = step.result;
  }

  const last = steps[steps.length - 1];
  return { steps, pattern: acc, value: last.value, negZero: last.negZero };
}

/**
 * v1 - v2 - v3 ... by both complements in a w-bit word.
 * Throws a descriptive Error when a value is not a whole number or does not fit.
 */
function complementSubtraction(values, w) {
  const bad = values.findIndex(v => !ratIsInt(v));
  if (bad !== -1) {
    throw new Error(`Complement subtraction needs whole numbers — input ${bad + 1} has a fractional part.`);
  }
  const ints = values.map(v => v.n);
  return {
    w,
    direct: chainValues(ints)[ints.length - 1],
    ones: chainSubtract(ints, w, 1),
    twos: chainSubtract(ints, w, 2)
  };
}
