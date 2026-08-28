/* ============================================================
   rational.js — exact rational numbers backed by BigInt

   Every value in the app is stored as a reduced fraction { n, d }
   with d > 0, so binary/octal/decimal/hex fractions and division
   stay exact instead of drifting through floating point.
   ============================================================ */

/** Greatest common divisor of two BigInts (always non-negative). */
function bgcd(a, b) {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) { const t = b; b = a % b; a = t; }
  return a;
}

/** Build a reduced rational n / d. Throws when d === 0. */
function rat(n, d = 1n) {
  n = BigInt(n);
  d = BigInt(d);
  if (d === 0n) throw new Error("rational with zero denominator");
  if (d < 0n) { n = -n; d = -d; }
  const g = bgcd(n, d) || 1n;
  return { n: n / g, d: d / g };
}

const ratAdd = (a, b) => rat(a.n * b.d + b.n * a.d, a.d * b.d);
const ratSub = (a, b) => rat(a.n * b.d - b.n * a.d, a.d * b.d);
const ratMul = (a, b) => rat(a.n * b.n, a.d * b.d);
const ratDiv = (a, b) => {
  if (b.n === 0n) throw new Error("Division by zero is undefined — change the divisor.");
  return rat(a.n * b.d, a.d * b.n);
};

const ratNeg   = (a) => ({ n: -a.n, d: a.d });
const ratIsInt = (a) => a.d === 1n;
