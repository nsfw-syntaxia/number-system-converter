# Radix Workbench

**Number System Converter and Arithmetic Calculator** — a single-page web app that
converts numbers between **binary, octal, decimal, and hexadecimal**, then performs
**addition, subtraction, multiplication, or division** across three or more inputs
that may each be written in a different base.

Built for the *System Development Activity: Number System Converter and Arithmetic
Calculator*.

---

## Features

- **3–8 input numbers**, count chosen by the user.
- Per-input **base selector** (Base 2 / 8 / 10 / 16).
- **Fractional values** allowed after a point — `1010.1`<sub>2</sub>, `3.5`<sub>10</sub>,
  `A.8`<sub>16</sub>, `.101`<sub>2</sub> — and negative values with a leading `-`.
- **Live validation** against the digit set of each selected base.
- Every valid input is shown converted to **all four bases**.
- **Two operation modes**:
  - **Simple chain** — pick one operator (+, −, ×, ÷) and it runs left to right across
    the inputs: `((v1 op v2) op v3) …`.
  - **Expression** — type a free-form formula that mixes **different operators and
    parentheses**, e.g. `(a + b - c) * d`, where `a, b, c, …` are the inputs in order.
    A small recursive-descent parser applies standard **operator precedence** (× and ÷
    before + and −) and **left-to-right associativity**, with parentheses overriding both.
- Operations run on a **common representation (decimal)**, so mixed-base inputs work.
- Result shown as the **original-value expression** plus the answer in all four bases.
- **1's and 2's complement** of every whole-number input, written in all four bases, in a
  fixed-width word (**Auto**, 8, 16, or 32 bits).
- **Subtraction using complements** — `v1 − v2 − v3 …` worked out step by step by adding the
  complement of each subtrahend: the **1's complement** method (end-around carry) and the
  **2's complement** method (carry dropped), with negative results recognised by the sign bit
  and every step checked against plain subtraction.
- **BCD (8421) addition and subtraction** — signed or unsigned words (Auto or 3/4/6/8 digits),
  addition with the +6 correction, subtraction by the 9's and 10's complement, OVERFLOW and
  NEGATIVE flags for unsigned words, typed BCD entry, and packed BCD / binary display.
- **Export PDF** — one click on the Documentation tab lays the report out for A4 (cover page with
  name / course / section, one section per page, no table row, figure, chart or code line split
  across pages) and opens the print dialog; choose **Save as PDF**.
- **Binary place-value strip** for the result, covering integer and fractional bits.
- Values are kept as **exact `BigInt` fractions** (numerator / denominator), so
  conversion and arithmetic never lose precision. Repeating expansions (e.g. `1 ÷ 3`,
  or `0.1`<sub>10</sub> in binary) are shown truncated to 24 places with the exact
  fraction noted.
- **Arithmetic error handling** — invalid input, empty input, division by zero (chain
  or expression), unmatched parentheses, missing operators, and unknown variables are
  all caught and shown inline; the calculation just doesn't run until it's fixed.
- **Step-unlock flow** — *Step 2 (operation)*, *Step 3 (result)* and *Step 4 (complements)* stay locked
  until every input number is valid, then unlock with a small animation.
- Light / dark theme aware, keyboard accessible, responsive.
- **Documentation tab**: requirements (incl. error handling), pseudocode (chain +
  expression evaluation, complements), flowcharts, program implementation notes with
  calculator screenshots, test cases, and four sample outputs.

---

## Run it

No build step, no dependencies to install.

**Option A — open directly**
Open `index.html` in a browser.

**Option B — local server** (recommended, needed for the Mermaid flowchart to load)

```bash
# any static server works, e.g.
python -m http.server 8000
# then visit http://localhost:8000
```

**Option C — GitHub Pages**
Repo *Settings → Pages → Deploy from branch → `main` / root*. The app will be live at
`https://nsfw-syntaxia.github.io/number-system-converter/`.

---

## Project structure

```
number-system-converter/
├── index.html          markup only
├── css/
│   └── styles.css       neubrutalism theme, step-lock styles, @media print (PDF export)
├── img/                 calculator screenshots used in the documentation / PDF
├── tools/
│   └── capture-screenshots.mjs   dev-only: regenerates img/ (needs puppeteer-core)
└── js/
    ├── rational.js      rat() / ratAdd / ratMul … — exact BigInt fractions
    ├── converter.js     BASES metadata, parseValue(), toBaseParts()  — conversion core
    ├── arithmetic.js    applyOperation() over the four operations — Simple chain mode
    ├── expression.js    tokenizeFormula() / parseFormulaTokens() / evaluateFormulaAst()
    │                    — recursive-descent parser for Expression mode (precedence,
    │                    associativity, parentheses, error handling)
    ├── complement.js    1's / 2's complement, word size, subtraction by complement
    ├── testcases.js     TEST_CASES + COMPLEMENT_VALUES / COMPLEMENT_CASES (test matrices)
    └── app.js           UI rendering, events, step-unlock, init
```

`rational.js`, `converter.js`, `arithmetic.js`, `expression.js` and `complement.js` contain **no DOM
code** — they are the logic layer and can be reused or unit-tested on their own.

---

## How it works

1. `parseValue(text, base)` validates the digits (integer part and optional fractional
   part around one `.`), then builds an exact rational: the integer digits give the
   numerator, and each fractional digit divides by the base.
2. Every input is now a `{ n, d }` rational — a **common representation**.
3. **Simple chain** — `applyOperation(values, op)` folds the operator across the values
   left to right, `((v0 op v1) op v2) …`, using exact rational add / subtract / multiply
   / divide. Division by zero throws and is reported.
   **Expression** — `tokenizeFormula(text)` turns the formula into tokens,
   `parseFormulaTokens(tokens)` parses them with a recursive-descent grammar
   (`expr → term → factor → primary`) that gives × and ÷ higher precedence than + and −
   and makes same-precedence operators left-associative, and `evaluateFormulaAst(ast, values)`
   walks the resulting tree. Every stage throws a descriptive `Error` on a problem
   (bad character, unmatched parenthesis, missing operator, unknown variable, ÷0).
4. `toBaseParts(value, base)` renders the result back into a base: the integer part by
   repeated division, the fractional part by repeated multiplication (stopping when the
   remainder clears or after 24 digits). Negatives use sign–magnitude form.

5. **Complements** — `complementWidth()` picks the word size `w`; a value is stored as a `w`-bit
   pattern; the **1's complement** flips every bit and the **2's complement** adds 1 to that.
   `subtractStep()` does one subtraction by adding the complement of the subtrahend — with the
   1's method a carry out of the top bit is added back (end-around carry), with the 2's method
   it is dropped; no carry means the result is negative (sign bit 1). Whole numbers only.

---

## Regenerating the screenshots

```bash
npm install --no-save puppeteer-core
node tools/capture-screenshots.mjs      # rewrites img/*.png
```

---

## Test cases

Covered in the **Documentation → Test cases** table (press **Try** to load one):

| Base mix                       | Operations tested                     |
| ------------------------------ | ------------------------------------- |
| Binary + Octal + Decimal       | addition                              |
| Binary + Decimal + Hexadecimal | subtraction, multiplication, addition  |
| Octal + Decimal + Hexadecimal  | multiplication, addition, subtraction |
| Binary + Octal + Hexadecimal   | division, addition, multiplication    |

Plus fractional cases (`1010.1₂ + 2.5₁₀ + 1.8₁₆`, `17₈ ÷ 2₁₀ ÷ 2₁₀ = 3.75`,
`1₁₀ − 0.1₂ − 0.4₁₆ = 0.25`), a negative-result case (`5₁₀ − 1010₂ = -5`), **expression**
cases (`(a + b - c) * d`, `a + b * c` to show precedence with no parentheses, `a / (b - c)`),
and forced **arithmetic-error** cases (division by zero in both modes, an unmatched
parenthesis, and an undefined variable).

Complement tests: seven single numbers (C01–C07) with their 1's and 2's complement in all four
bases, and nine subtraction cases (S01–S09) covering carries at every step, a negative result,
a 1's-complement `-0`, auto-growing word size, a fixed 8-bit word, and two forced errors
(value too large for the word, fractional input).

---

## License

[MIT](LICENSE)
 