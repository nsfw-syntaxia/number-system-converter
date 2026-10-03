/* ============================================================
   testcases.js — the test matrix from the activity brief.
   Every required base combination, across all four operations,
   plus fractional-value, negative-result, expression-mode
   (precedence/parentheses), and forced-error cases.

   Chain-mode cases need `op`; expression-mode cases set
   `mode: "expr"` and a `formula` instead (variables a, b, c, ...
   map to the inputs in order).

   `sample`, `sampleExpr` and `sampleError` each mark the one
   case used for that Sample Output panel in the Documentation tab.
   ============================================================ */

const TEST_CASES = [
  // --- required base combinations x operations (whole numbers) ---
  { mix: "BIN + OCT + DEC", op: "+", inputs: [[2, "1010"], [8, "17"], [10, "25"]], sample: true },
  { mix: "BIN + DEC + HEX", op: "-", inputs: [[2, "11110"], [10, "9"], [16, "A"]] },
  { mix: "OCT + DEC + HEX", op: "*", inputs: [[8, "12"], [10, "3"], [16, "2"]] },
  { mix: "BIN + OCT + HEX", op: "/", inputs: [[2, "100000"], [8, "4"], [16, "2"]] },
  { mix: "BIN + DEC + HEX", op: "*", inputs: [[2, "101"], [10, "12"], [16, "F"]] },
  { mix: "OCT + DEC + HEX", op: "+", inputs: [[8, "77"], [10, "100"], [16, "FF"]] },
  { mix: "OCT + DEC + HEX", op: "-", inputs: [[8, "200"], [10, "50"], [16, "1A"]] },
  { mix: "BIN + OCT + HEX", op: "+", inputs: [[2, "1101"], [8, "7"], [16, "1F"]] },
  { mix: "BIN + OCT + HEX", op: "*", inputs: [[2, "11"], [8, "11"], [16, "2"]] },

  // --- fractional values ---
  { mix: "BIN + DEC + HEX", op: "+", inputs: [[2, "1010.1"], [10, "2.5"], [16, "1.8"]] },   // 10.5 + 2.5 + 1.5 = 14.5
  { mix: "OCT + DEC + DEC", op: "/", inputs: [[8, "17"], [10, "2"], [10, "2"]] },           // 15 / 2 / 2 = 3.75
  { mix: "DEC + BIN + HEX", op: "-", inputs: [[10, "1"], [2, "0.1"], [16, "0.4"]] },        // 1 - 0.5 - 0.25 = 0.25

  // --- negative result ---
  { mix: "DEC + BIN + HEX", op: "-", inputs: [[10, "5"], [2, "1010"], [16, "0"]] },         // 5 - 10 - 0 = -5

  // --- expression mode: different operators, parentheses, precedence ---
  { mix: "BIN + DEC + HEX + DEC", mode: "expr", formula: "(a + b - c) * d",
    inputs: [[2, "101"], [10, "3"], [16, "2"], [10, "4"]], sampleExpr: true },               // (5+3-2)*4 = 24
  { mix: "DEC + DEC + DEC", mode: "expr", formula: "a + b * c",
    inputs: [[10, "2"], [10, "3"], [10, "4"]] },                                             // 2 + 3*4 = 14 (precedence, no parens)
  { mix: "DEC + DEC + DEC", mode: "expr", formula: "a / (b - c)",
    inputs: [[10, "20"], [10, "8"], [10, "3"]] },                                            // 20 / (8-3) = 4

  // --- arithmetic error handling ---
  { mix: "DEC + DEC + DEC", op: "/", inputs: [[10, "5"], [10, "0"], [10, "2"]], sampleError: true }, // division by zero, Simple chain
  { mix: "DEC + DEC + DEC", mode: "expr", formula: "a / (b - b)",
    inputs: [[10, "9"], [10, "4"], [10, "1"]] },                                             // division by zero, Expression
  { mix: "DEC + DEC + DEC", mode: "expr", formula: "(a + b",
    inputs: [[10, "1"], [10, "2"], [10, "3"]] },                                             // unmatched parenthesis
  { mix: "DEC + DEC + DEC", mode: "expr", formula: "a + e",
    inputs: [[10, "1"], [10, "2"], [10, "3"]] }                                              // unknown variable "e"
];

/* ============================================================
   Complement test data.

   COMPLEMENT_VALUES — single numbers whose 1's and 2's complement is
   shown in all four bases. `width` is the word size in bits.

   COMPLEMENT_CASES — v1 - v2 - v3 ... done with both complements and
   compared against plain subtraction. `width` is "auto" (default) or
   8 / 16 / 32. `sampleComplement` marks the case used for the
   Sample Output panel; the last two cases force an error.
   ============================================================ */

const COMPLEMENT_VALUES = [
  { base: 2,  value: "1010", width: 8 },
  { base: 8,  value: "17",   width: 8 },
  { base: 10, value: "25",   width: 8 },
  { base: 16, value: "7F",   width: 8 },
  { base: 16, value: "FF",   width: 16 },
  { base: 10, value: "0",    width: 8 },
  { base: 10, value: "-5",   width: 8 }
];

const COMPLEMENT_CASES = [
  { mix: "BIN + DEC + HEX", inputs: [[2, "11110"], [10, "9"], [16, "A"]] },                  // 30 - 9 - 10 = 11 (carry every step)
  { mix: "OCT + DEC + HEX", inputs: [[8, "200"], [10, "50"], [16, "1A"]] },                  // 128 - 50 - 26 = 52 (auto grows to 12 bits)
  { mix: "DEC + BIN + HEX", inputs: [[10, "5"], [2, "1010"], [16, "0"]], sampleComplement: true }, // 5 - 10 - 0 = -5 (no carry -> negative)
  { mix: "DEC + BIN + OCT", inputs: [[10, "12"], [2, "1100"], [8, "0"]] },                   // 12 - 12 - 0 = 0 (1's complement shows -0)
  { mix: "DEC + DEC + DEC", inputs: [[10, "3"], [10, "7"], [10, "2"]] },                     // 3 - 7 - 2 = -6
  { mix: "OCT + HEX + BIN", inputs: [[8, "100"], [16, "FF"], [2, "1"]] },                    // 64 - 255 - 1 = -192
  { mix: "DEC + DEC + DEC", inputs: [[10, "100"], [10, "20"], [10, "30"]], width: 8 },       // 100 - 20 - 30 = 50 in a fixed 8-bit word

  // --- forced errors ---
  { mix: "DEC + DEC + DEC", inputs: [[10, "200"], [10, "1"], [10, "1"]], width: 8 },         // 200 does not fit in 8 bits
  { mix: "DEC + DEC + DEC", inputs: [[10, "2.5"], [10, "1"], [10, "1"]] }                    // fractional input
];

/* ============================================================
   BCD test data (Step 5).

   BCD_VALUES — single numbers in 8421 BCD with their 9's and 10's
   complement. `digits` is the word size in decimal digits.

   BCD_CASES — `bcd: "add"` (BCD addition with the +6 correction)
   or `bcd: "sub"` (subtraction by the 9's and 10's complement),
   checked against plain arithmetic. `digits` is "auto" (default)
   or 3 / 4 / 6 / 8. `sampleBcd` marks the case for the Sample
   Output panel; the last cases force errors.
   ============================================================ */

const BCD_VALUES = [
  { base: 2,  value: "1011", digits: 3 },
  { base: 10, value: "25",   digits: 4 },
  { base: 16, value: "FF",   digits: 4 },
  { base: 10, value: "0",    digits: 3 },
  { base: 8,  value: "777",  digits: 4 }
];

const BCD_CASES = [
  // --- subtraction by the 9's and 10's complement ---
  { mix: "BIN + DEC + HEX", bcd: "sub", inputs: [[10, "12"], [10, "30"], [16, "1"]], sampleBcd: true }, // 12 - 30 - 1 = -19
  { mix: "DEC + BIN + OCT", bcd: "sub", inputs: [[10, "200"], [10, "50"], [16, "1A"]] },              // 200 - 50 - 26 = 124
  { mix: "DEC + DEC + DEC", bcd: "sub", inputs: [[10, "300"], [10, "120"], [10, "95"]] },            // 300 - 120 - 95 = 85
  { mix: "DEC + BIN + OCT", bcd: "sub", inputs: [[10, "12"], [2, "1100"], [8, "0"]] },               // 12 - 12 - 0 = 0 (-0 in 9's)

  // --- addition in BCD ---
  { mix: "BIN + DEC + OCT", bcd: "add", inputs: [[2, "1011"], [10, "25"], [8, "17"]] },              // 11 + 25 + 15 = 51
  { mix: "DEC + DEC + DEC", bcd: "add", inputs: [[10, "58"], [10, "47"], [10, "36"]] },              // 58 + 47 + 36 = 141 (carries)
  { mix: "OCT + HEX + DEC", bcd: "add", inputs: [[8, "77"], [16, "A"], [10, "9"]] },                // 63 + 10 + 9 = 82

  // --- forced errors ---
  { mix: "DEC + DEC + DEC", bcd: "add", inputs: [[10, "99"], [10, "1"]], digits: 3 },              // 100 needs 4 digits
  { mix: "DEC + DEC + DEC", bcd: "sub", inputs: [[10, "300"], [10, "1"]], digits: 3 },            // 299 needs 4 digits
  { mix: "DEC + DEC + DEC", bcd: "sub", inputs: [[10, "2.5"], [10, "1"], [10, "1"]] }              // fractional input
];
