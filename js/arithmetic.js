/* ============================================================
   arithmetic.js — operations on the converted values
   Depends on: rational.js
   ============================================================ */

/** Display symbol for each operation key. */
const OP_SYMBOL = { "+": "+", "-": "−", "*": "×", "/": "÷" };

/** Operation key -> rational function. */
const OP_FN = { "+": ratAdd, "-": ratSub, "*": ratMul, "/": ratDiv };

/**
 * Apply `operator` to an array of rationals, left to right:
 *   ((v0 op v1) op v2) op ...
 *
 * Returns a single rational { n, d }. Throws on division by zero.
 */
function applyOperation(values, operator) {
  const fn = OP_FN[operator];
  let acc = values[0];
  for (let k = 1; k < values.length; k++) {
    acc = fn(acc, values[k]);
  }
  return acc;
}
