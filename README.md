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
- Operations run on a **common representation (decimal)**, so mixed-base inputs work.
- Result shown as the **original-value expression** plus the answer in all four bases.
- **Binary place-value strip** for the result, covering integer and fractional bits.
- Values are kept as **exact `BigInt` fractions** (numerator / denominator), so
  conversion and arithmetic never lose precision. Repeating expansions (e.g. `1 ÷ 3`,
  or `0.1`<sub>10</sub> in binary) are shown truncated to 24 places with the exact
  fraction noted.
- Handles **invalid input, empty input, and division by zero**.
- **Step-unlock flow** — *Step 2 (operation)* and *Step 3 (result)* stay locked
  until every input number is valid, then unlock with a small animation.
- Light / dark theme aware, keyboard accessible, responsive.
- **Documentation tab**: requirements, pseudocode, flowchart, test cases, sample output.

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
│   └── styles.css       neubrutalism theme + step-lock styles
└── js/
    ├── rational.js      rat() / ratAdd / ratMul … — exact BigInt fractions
    ├── converter.js     BASES metadata, parseValue(), toBaseParts()  — conversion core
    ├── arithmetic.js    applyOperation() over the four operations
    ├── testcases.js     TEST_CASES — the activity test matrix
    └── app.js           UI rendering, events, step-unlock, init
```

`rational.js`, `converter.js` and `arithmetic.js` contain **no DOM code** — they are
the logic layer and can be reused or unit-tested on their own.

---

## How it works

1. `parseValue(text, base)` validates the digits (integer part and optional fractional
   part around one `.`), then builds an exact rational: the integer digits give the
   numerator, and each fractional digit divides by the base.
2. Every input is now a `{ n, d }` rational — a **common representation**.
3. `applyOperation(values, op)` folds the operator across the values left to right,
   `((v0 op v1) op v2) …`, using exact rational add / subtract / multiply / divide.
   Division by zero throws and is reported.
4. `toBaseParts(value, base)` renders the result back into a base: the integer part by
   repeated division, the fractional part by repeated multiplication (stopping when the
   remainder clears or after 24 digits). Negatives use sign–magnitude form.

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
`1₁₀ − 0.1₂ − 0.4₁₆ = 0.25`) and a negative-result case (`5₁₀ − 1010₂ = -5`).

---

## License

[MIT](LICENSE)
