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
- **Live validation** against the digit set of each selected base.
- Every valid input is shown converted to **all four bases**.
- Operations run on a **common decimal representation**, so mixed-base inputs work.
- Result shown as the **original-value expression** plus the answer in all four bases.
- **Binary place-value strip** for the result.
- **Division** reports integer quotient + remainder and the exact decimal value.
- Handles **invalid input, empty input, and division by zero**.
- **Step-unlock flow** — *Step 2 (operation)* and *Step 3 (result)* stay locked
  until every input number is valid, then unlock with a small animation.
- Arbitrary-precision integer maths via **BigInt** (large binary/hex stay exact).
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
    ├── converter.js     BASES metadata, parseValue(), toBase()   — conversion core
    ├── arithmetic.js    applyOperation() and helpers             — the four operations
    ├── testcases.js     TEST_CASES — the activity test matrix
    └── app.js           UI rendering, events, step-unlock, init
```

`converter.js` and `arithmetic.js` contain **no DOM code** — they are the logic layer
and can be reused or unit-tested on their own.

---

## How the conversion works

1. `parseValue(text, base)` validates the digits and parses the string to a `BigInt`
   (via the `0b` / `0o` / `0x` prefixes, or plain decimal). A leading `-` is allowed.
2. All inputs are now `BigInt` values — a **common representation**.
3. `applyOperation(values, op)` folds the operator across the values left to right:
   `((v0 op v1) op v2) …`. Division keeps the integer quotient and flags any remainder.
4. `toBase(value, base)` renders the result back into each base
   (`BigInt.prototype.toString(radix)`), negative numbers in sign–magnitude form.

---

## Test cases

Covered in the **Documentation → Test cases** table (press **Try** to load one):

| Base mix              | Operations tested        |
| --------------------- | ------------------------ |
| Binary + Octal + Decimal      | addition, division       |
| Binary + Decimal + Hexadecimal | subtraction, multiplication |
| Octal + Decimal + Hexadecimal  | multiplication, addition, subtraction |
| Binary + Octal + Hexadecimal   | division, addition, multiplication |

Plus a division-with-remainder case and a negative-result (subtraction) case.

---

## License

[MIT](LICENSE)
