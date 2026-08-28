/* ============================================================
   testcases.js — the test matrix from the activity brief.
   Every required base combination, across all four operations,
   plus fractional-value and negative-result cases.

   `sample: true` marks the case used for the Sample Output panel.
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
  { mix: "DEC + BIN + HEX", op: "-", inputs: [[10, "5"], [2, "1010"], [16, "0"]] }          // 5 - 10 - 0 = -5
];
