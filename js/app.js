/* ============================================================
   app.js — UI layer: rendering, events, step-unlock, init
   Depends on: rational.js, converter.js, arithmetic.js, expression.js,
               complement.js, testcases.js
   ============================================================ */

const MIN_INPUTS = 3;
const MAX_INPUTS = 8;

/* ---- program state ---- */
let state = [
  { base: 2,  raw: "" },
  { base: 8,  raw: "" },
  { base: 10, raw: "" }
];
let op = "+";
let mode = "chain";     // "chain" (Step 2 operation buttons) or "expr" (free-form formula)
let wordChoice = "auto"; // Step 4 word size: "auto" | 8 | 16 | 32

/* ---- cached DOM ---- */
const inputList   = document.getElementById("inputList");
const resultBody  = document.getElementById("resultBody");
const opsEl       = document.getElementById("ops");
const opBlock     = document.getElementById("step-op");
const resultBlock = document.getElementById("step-result");
const modeChainEl = document.getElementById("modeChain");
const modeExprEl  = document.getElementById("modeExpr");
const exprInput   = document.getElementById("exprInput");
const exprMsg     = document.getElementById("exprMsg");
const compBlock   = document.getElementById("step-comp");
const compBody    = document.getElementById("compBody");
const wordInfo    = document.getElementById("wordInfo");

/* ============================================================
   Step 1 — input rows
   ============================================================ */
function buildRows() {
  inputList.innerHTML = "";

  state.forEach((item, i) => {
    const row = document.createElement("div");
    row.className = "row";
    row.dataset.index = i;
    row.dataset.state = "empty";

    const seg = BASE_ORDER.map(b =>
      `<button type="button" data-base="${b}" aria-pressed="${item.base === b}">
         ${BASES[b].name}<span class="n">base ${b}</span>
       </button>`).join("");

    row.innerHTML = `
      <div class="idx">${String(i + 1).padStart(2, "0")}</div>
      <div class="body">
        <div class="controls">
          <div class="seg" role="group" aria-label="Base for input ${i + 1}">${seg}</div>
          <div class="field">
            <input type="text" spellcheck="false" autocomplete="off"
                   aria-label="Value for input ${i + 1}"
                   placeholder="enter a ${BASES[item.base].label.toLowerCase()} value" value="${item.raw}">
          </div>
        </div>
        <div class="msg" aria-live="polite"></div>
        <div class="chips"></div>
      </div>`;

    row.querySelectorAll(".seg button").forEach(btn => {
      btn.addEventListener("click", () => {
        state[i].base = Number(btn.dataset.base);
        row.querySelectorAll(".seg button").forEach(b =>
          b.setAttribute("aria-pressed", b === btn));
        row.querySelector("input").placeholder =
          "enter a " + BASES[state[i].base].label.toLowerCase() + " value";
        refreshRow(i);
        renderVarLegend();
        refreshResult();
      });
    });

    const input = row.querySelector("input");
    input.addEventListener("input", () => {
      state[i].raw = input.value;
      refreshRow(i);
      refreshResult();
    });

    inputList.appendChild(row);
    refreshRow(i);
  });

  renderVarLegend();
}

/** Legend shown in Expression mode: which letter maps to which input. */
function renderVarLegend() {
  const legend = document.getElementById("varLegend");
  if (!legend) return;
  legend.innerHTML = state.map((s, i) => {
    const letter = String.fromCharCode(97 + i);
    return `<div class="var-chip"><span class="letter">${letter}</span><span class="src">Input ${i + 1} &middot; ${BASES[s.base].name}</span></div>`;
  }).join("");
}

function emptyChips() {
  return BASE_ORDER.map(b =>
    `<div class="chip empty"><div class="lab">${BASES[b].name}</div><div class="val">&mdash;</div></div>`).join("");
}

/** Classify a single input without throwing. */
function inputStatus(item) {
  if (item.raw.trim() === "") return "empty";
  try { parseValue(item.raw, item.base); return "valid"; }
  catch (e) { return "invalid"; }
}

/** Update one row: state class, message, and its four conversion chips. */
function refreshRow(i) {
  const row = inputList.querySelector(`.row[data-index="${i}"]`);
  if (!row) return;

  const msg = row.querySelector(".msg");
  const chips = row.querySelector(".chips");
  const item = state[i];

  if (item.raw.trim() === "") {
    row.dataset.state = "empty";
    msg.className = "msg";
    msg.textContent = "";
    chips.innerHTML = emptyChips();
    return;
  }

  try {
    const value = parseValue(item.raw, item.base);
    row.dataset.state = "valid";
    msg.className = "msg ok";
    msg.innerHTML =
      `Valid ${BASES[item.base].label} &middot; ` +
      `<span class="tag">${toBase(value, 10)}<sub>10</sub></span> in decimal`;

    chips.innerHTML = BASE_ORDER.map(b => {
      const active = b === item.base;
      return `<div class="chip${active ? " act" : ""}">
        <div class="lab">${BASES[b].name}${active ? " &middot; input" : ""}</div>
        <div class="val">${toBase(value, b)}<sub>${b}</sub></div>
      </div>`;
    }).join("");
  } catch (err) {
    row.dataset.state = "invalid";
    chips.innerHTML = emptyChips();
    if (err.message === "empty") {
      row.dataset.state = "empty";
      msg.className = "msg";
      msg.textContent = "";
      return;
    }
    msg.className = "msg err";
    msg.textContent = err.message;
  }
}

/* ============================================================
   Step unlocking — Steps 2, 3 and 4 stay locked until every
   input number is present and valid.
   ============================================================ */
function updateLocks() {
  const ready = state.filter(it => inputStatus(it) === "valid").length;
  const total = state.length;
  const allReady = ready === total;

  document.getElementById("opLockSub").textContent =
    allReady ? "Unlocked" : `${ready} of ${total} numbers ready`;
  document.getElementById("resultLockSub").textContent =
    allReady ? "Unlocked" : "Finish Step 1 to unlock";
  document.getElementById("compLockSub").textContent =
    allReady ? "Unlocked" : "Finish Step 1 to unlock";

  [opBlock, resultBlock, compBlock].forEach(block => {
    const wasLocked = block.classList.contains("locked");
    block.classList.toggle("locked", !allReady);
    if (wasLocked && allReady) {
      block.classList.add("unlocking");
      setTimeout(() => block.classList.remove("unlocking"), 550);
    }
  });

  opsEl.querySelectorAll("button").forEach(b => { b.disabled = !allReady; });
  opsEl.toggleAttribute("inert", !allReady);
}

/* ============================================================
   Step 3 — result
   ============================================================ */
function exprFromOriginals() {
  return state.map((s, idx) => {
    const raw = s.raw.trim().toUpperCase() || "?";
    const piece = `${raw}<sub>${s.base}</sub>`;
    return idx === 0 ? piece : `<span class="op-sym">${OP_SYMBOL[op]}</span>${piece}`;
  }).join(" ");
}

/** Binary place-value strip for the result, including fractional bits. */
function placeValueBlock(value) {
  const info = toBaseParts(value, 2);
  const negative = info.text.startsWith("-");

  let body = negative ? info.text.slice(1) : info.text;
  const truncated = body.endsWith("…");
  if (truncated) body = body.slice(0, -1);

  const [intBits, fracBits = ""] = body.split(".");
  const cells = [];

  if (negative) {
    cells.push(`<div class="bit sign"><span class="b">&minus;</span><span class="p">sign</span></div>`);
  }

  intBits.split("").forEach((bit, idx) => {
    const power = intBits.length - 1 - idx;
    const place = (1n << BigInt(power)).toString();
    cells.push(`<div class="bit ${bit === "1" ? "on" : ""}"><span class="b">${bit}</span><span class="p">${place}</span></div>`);
  });

  if (fracBits) {
    cells.push(`<div class="bit dot"><span class="b">.</span><span class="p"></span></div>`);
    fracBits.split("").forEach((bit, idx) => {
      const denom = (1n << BigInt(idx + 1)).toString();
      cells.push(`<div class="bit ${bit === "1" ? "on" : ""}"><span class="b">${bit}</span><span class="p">1/${denom}</span></div>`);
    });
  }

  if (truncated) {
    cells.push(`<div class="bit more"><span class="b">&hellip;</span><span class="p"></span></div>`);
  }

  return `<div class="pv">
    <h3>Binary place values &mdash; result</h3>
    <div class="pv-strip">${cells.join("")}</div>
  </div>`;
}

/** Build the result-grid + note + place-value markup shared by both modes. */
function buildResultHTML(exprLineHTML, decimalLineHTML, result) {
  let anyTruncated = false;
  const cards = BASE_ORDER.map(b => {
    const info = toBaseParts(result, b);
    if (info.truncated) anyTruncated = true;
    return `<div class="rcard ${b === 10 ? "dec" : ""}">
      <div class="lab">${BASES[b].label} <b>base ${b}</b></div>
      <div class="big">${info.text}<sub>${b}</sub></div>
      ${info.truncated ? `<div class="sublabel">repeating &mdash; shown to ${MAX_FRAC_DIGITS} places</div>` : ""}
    </div>`;
  }).join("");

  const note = anyTruncated
    ? `<div class="note">One or more of these results is a repeating fraction and is shown
       truncated to ${MAX_FRAC_DIGITS} places. Internally the value is kept as the exact
       fraction <strong>${result.n}/${result.d}</strong>.</div>`
    : "";

  return `
    <div class="expr">${exprLineHTML} <span class="op-sym">=</span> ${toBase(result, 10)}<sub>10</sub></div>
    <div class="expr secondary">common representation (decimal): ${decimalLineHTML} = ${toBase(result, 10)}</div>
    <div class="result-grid">${cards}</div>
    ${note}
    ${placeValueBlock(result)}`;
}

/** letter (a, b, c, ...) -> the raw text + base of that input row, for display. */
function originalPieceForVar(name) {
  const idx = name.charCodeAt(0) - 97;
  const s = state[idx];
  if (!s) return `${name}?`;
  const raw = s.raw.trim().toUpperCase() || "?";
  return `${raw}<sub>${s.base}</sub>`;
}

function refreshResult() {
  document.getElementById("factCount").textContent = state.length;
  document.getElementById("countLabel").textContent = state.length + " inputs";
  updateLocks();

  // gather + validate every input
  const values = [];
  let problem = null;
  for (let i = 0; i < state.length; i++) {
    try {
      values.push(parseValue(state[i].raw, state[i].base));
    } catch (err) {
      problem = err.message === "empty"
        ? "Enter all " + state.length + " input numbers to see a result."
        : "Fix the highlighted input" + (state.length > 1 ? "s" : "") + " above to see a result.";
      break;
    }
  }

  refreshComplements(problem ? null : values);

  if (problem) {
    const exprLine = mode === "expr"
      ? renderFormulaHTMLSafe()
      : exprFromOriginals();
    resultBody.innerHTML = `
      <div class="expr">${exprLine} <span class="op-sym">=</span> ?</div>
      <div class="note bad">${problem}</div>`;
    return;
  }

  if (mode === "expr") {
    refreshExpressionResult(values);
    return;
  }

  let result;
  try {
    result = applyOperation(values, op);
  } catch (err) {
    resultBody.innerHTML = `
      <div class="expr">${exprFromOriginals()} <span class="op-sym">=</span> ?</div>
      <div class="note bad">${err.message}</div>`;
    return;
  }

  const decimalExpr = values
    .map((v, idx) => idx === 0 ? toBase(v, 10) : `${OP_SYMBOL[op]} ${toBase(v, 10)}`)
    .join(" ");

  resultBody.innerHTML = buildResultHTML(exprFromOriginals(), decimalExpr, result);
}

/** Best-effort rendering of the formula (with original values) even when it doesn't parse. */
function renderFormulaHTMLSafe() {
  try {
    const tokens = tokenizeFormula(exprInput.value.trim());
    return renderFormulaHTML(tokens, originalPieceForVar);
  } catch (e) {
    return exprInput.value.trim() ? exprInput.value.trim() : "?";
  }
}

/** Step 3 rendering for Expression mode: parse, evaluate, and show the result — or the error. */
function refreshExpressionResult(values) {
  const formula = exprInput.value.trim();
  let tokens, ast;
  try {
    tokens = tokenizeFormula(formula);
    ast = parseFormulaTokens(tokens);
    exprMsg.className = "msg";
    exprMsg.textContent = "";
  } catch (err) {
    exprMsg.className = "msg err";
    exprMsg.textContent = err.message;
    resultBody.innerHTML = `
      <div class="expr">${renderFormulaHTMLSafe()} <span class="op-sym">=</span> ?</div>
      <div class="note bad">${err.message}</div>`;
    return;
  }

  const varValues = {};
  values.forEach((v, i) => { varValues[String.fromCharCode(97 + i)] = v; });

  const exprLine = renderFormulaHTML(tokens, originalPieceForVar);

  let result;
  try {
    result = evaluateFormulaAst(ast, varValues);
  } catch (err) {
    exprMsg.className = "msg err";
    exprMsg.textContent = err.message;
    resultBody.innerHTML = `
      <div class="expr">${exprLine} <span class="op-sym">=</span> ?</div>
      <div class="note bad">${err.message}</div>`;
    return;
  }

  const decimalLine = renderFormulaHTML(tokens, name => toBase(varValues[name], 10));
  resultBody.innerHTML = buildResultHTML(exprLine, decimalLine, result);
}

/* ============================================================
   Step 4 — complements and subtraction by complement
   ============================================================ */
const SYSTEM_NAME = { 1: "1's", 2: "2's" };

/** Plain-text rows for one subtraction step (shared by the HTML and text renderers). */
function stepRows(st, w, system) {
  const nm = SYSTEM_NAME[system];
  const bin = (p) => formatPattern(p, w, 2);
  const rows = [
    { label: "A (running value)", bits: bin(st.pa), note: "= " + st.aValue },
    { label: "B (subtrahend)", bits: bin(st.pb), note: "= " + st.bValue },
    { label: nm + " complement of B", bits: bin(st.negB), note: "= -B" },
    { label: "A + complement", carry: st.carry ? 1 : 0, bits: bin(st.sum),
      note: !st.carry ? "carry out = 0"
        : system === 1 ? "carry out = 1 → added back" : "carry out = 1 → dropped" }
  ];
  if (st.endAround) {
    rows.push({ label: "+ end-around carry", bits: bin(st.result), note: "sum + 1" });
  }

  let verdict;
  if ((st.result >> BigInt(w - 1)) === 0n) {
    verdict = "sign 0 → positive = " + st.value;
  } else if (st.negZero) {
    verdict = "sign 1, all ones = -0 = 0";
  } else {
    verdict = "sign 1 → negative; complement of sum = " +
      bin(complementOf(st.result, w, system)) + " = " + (-st.value) + ", so " + st.value;
  }
  rows.push({ label: "Result", bits: bin(st.result), note: verdict, result: true });
  return rows;
}

/** All steps plus the final pattern for the 1's or the 2's method. */
function walkthroughHTML(run, w, system) {
  const steps = run.steps.map((st, idx) => {
    const rows = stepRows(st, w, system).map(r => `
      <tr class="${r.result ? "res" : ""}">
        <th scope="row">${r.label}</th>
        <td class="bits">${r.carry === undefined ? "" : `<span class="carry${r.carry ? "" : " off"}">${r.carry}</span>`}${r.bits}</td>
        <td class="why">${r.note}</td>
      </tr>`).join("");
    return `<div class="cstep">
      <div class="cstep-head"><span class="k">Step ${idx + 1}</span> ${st.aValue} ${OP_SYMBOL["-"]} ${st.bValue}</div>
      <table class="cs"><tbody>${rows}</tbody></table>
    </div>`;
  }).join("");

  const chips = BASE_ORDER.map(b => `<div class="chip">
      <div class="lab">${BASES[b].name}</div>
      <div class="val">${formatPattern(run.pattern, w, b)}<sub>${b}</sub></div>
    </div>`).join("");

  const meaning = run.negZero
    ? "all ones = -0, which equals 0"
    : "as a signed number = " + run.value;

  return `${steps}
    <div class="cfinal">
      <div class="cfinal-head">Final ${w}-bit pattern (${SYSTEM_NAME[system]} complement method) — ${meaning}</div>
      <div class="chips">${chips}</div>
    </div>`;
}

/** One input's number / 1's complement / 2's complement rows, in all four bases. */
function complementCardHTML(i, value, w) {
  const s = state[i];
  const head = `<div class="chead"><span class="idx">${String(i + 1).padStart(2, "0")}</span>
      <span class="mono">${s.raw.trim().toUpperCase()}<sub>${s.base}</sub> = ${toBase(value, 10)}<sub>10</sub></span></div>`;

  if (!ratIsInt(value)) {
    return `<div class="ccard">${head}<p class="cnote">Complements are taken on whole numbers — this value has a fractional part, so it is skipped.</p></div>`;
  }

  const c = complementsOf(value.n, w);
  const heads = BASE_ORDER.map(b => `<th class="b${b}">${BASES[b].name}</th>`).join("");
  const cells = (p) => BASE_ORDER.map(b => `<td class="mono">${formatPattern(p, w, b)}</td>`).join("");

  return `<div class="ccard">${head}
    <table class="ct">
      <thead><tr><th></th>${heads}</tr></thead>
      <tbody>
        <tr><th scope="row">${value.n < 0n ? "Number (2's form)" : "Number"}</th>${cells(c.number)}</tr>
        <tr><th scope="row">1's complement</th>${cells(c.ones)}</tr>
        <tr class="two"><th scope="row">2's complement</th>${cells(c.twos)}</tr>
      </tbody>
    </table>
    <p class="cnote">flip every bit → <span class="mono">${formatPattern(c.ones, w, 2)}</span> &nbsp;·&nbsp;
      add 1 → <span class="mono">${formatPattern(c.twos, w, 2)}</span></p>
  </div>`;
}

/** Step 4: word size, complements of every input, and v1 − v2 − … by both methods. */
function refreshComplements(values) {
  if (!values) {
    compBody.innerHTML = "";
    wordInfo.textContent = "";
    return;
  }

  let w;
  try {
    w = complementWidth(values, wordChoice);
  } catch (err) {
    wordInfo.textContent = "";
    compBody.innerHTML = `<div class="note bad">${err.message}</div>`;
    return;
  }
  wordInfo.textContent = w + "-bit word" + (wordChoice === "auto" ? " (chosen automatically)" : "");

  const cards = values.map((v, i) => complementCardHTML(i, v, w)).join("");
  const expression = state
    .map(s => `${s.raw.trim().toUpperCase()}<sub>${s.base}</sub>`)
    .join(` ${OP_SYMBOL["-"]} `);

  let subtraction;
  try {
    const sub = complementSubtraction(values, w);
    subtraction = [1, 2].map(system => {
      const rule = system === 1
        ? "Add the 1's complement of B. A carry out of the top bit is added back (end-around carry); no carry means the result is negative."
        : "Add the 2's complement of B. A carry out of the top bit is dropped; no carry means the result is negative.";
      return `<h3 class="csec">Subtraction using ${SYSTEM_NAME[system]} complement</h3>
        <p class="cnote">${rule}</p>
        <div class="csub" id="compSub${system}">${walkthroughHTML(system === 1 ? sub.ones : sub.twos, w, system)}</div>`;
    }).join("") + `<div class="note">Plain subtraction gives <strong>${sub.direct}</strong> — both methods agree.</div>`;
  } catch (err) {
    subtraction = `<h3 class="csec">Subtraction using complements</h3><div class="note bad">${err.message}</div>`;
  }

  compBody.innerHTML = `
    <h3 class="csec">Complements of each input</h3>
    <div class="clist" id="compInputs">${cards}</div>
    <p class="cnote csum">Subtraction runs left to right: ${expression}</p>
    ${subtraction}`;
}

/** Word-size buttons. Also used by loadCase(). */
function setWordChoice(choice) {
  wordChoice = choice === "auto" ? "auto" : Number(choice);
  document.querySelectorAll(".size-btn").forEach(b =>
    b.setAttribute("aria-pressed", String(b.dataset.size === String(wordChoice))));
}

document.querySelectorAll(".size-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    setWordChoice(btn.dataset.size);
    refreshResult();
  });
});

/* ============================================================
   Controls — input count, operation, tabs
   ============================================================ */
document.getElementById("more").addEventListener("click", () => {
  if (state.length >= MAX_INPUTS) return;
  state.push({ base: 10, raw: "" });
  syncCountButtons();
  buildRows();
  refreshResult();
});

document.getElementById("less").addEventListener("click", () => {
  if (state.length <= MIN_INPUTS) return;
  state.pop();
  syncCountButtons();
  buildRows();
  refreshResult();
});

function syncCountButtons() {
  document.getElementById("less").disabled = state.length <= MIN_INPUTS;
  document.getElementById("more").disabled = state.length >= MAX_INPUTS;
}

opsEl.querySelectorAll(".op").forEach(btn => {
  btn.addEventListener("click", () => {
    if (btn.disabled) return;
    op = btn.dataset.op;
    opsEl.querySelectorAll(".op").forEach(b =>
      b.setAttribute("aria-pressed", b === btn));
    refreshResult();
  });
});

/** Switch between Simple chain and Expression mode (also used by loadCase()). */
function setMode(newMode) {
  mode = newMode === "expr" ? "expr" : "chain";
  document.querySelectorAll(".mode-btn").forEach(b =>
    b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
  modeChainEl.hidden = mode !== "chain";
  modeExprEl.hidden = mode !== "expr";
}

document.querySelectorAll(".mode-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    setMode(btn.dataset.mode);
    refreshResult();
  });
});

exprInput.addEventListener("input", refreshResult);

const tabCalc = document.getElementById("tab-calc");
const tabDoc  = document.getElementById("tab-doc");
const viewCalc = document.getElementById("view-calc");
const viewDoc  = document.getElementById("view-doc");

function showView(which) {
  const calc = which === "calc";
  tabCalc.setAttribute("aria-selected", calc);
  tabDoc.setAttribute("aria-selected", !calc);
  viewCalc.classList.toggle("hidden", !calc);
  viewDoc.classList.toggle("active", !calc);
  viewDoc.hidden = calc;
  if (!calc && typeof renderFlowchart === "function") {
    requestAnimationFrame(renderFlowchart);
  }
}
tabCalc.addEventListener("click", () => showView("calc"));
tabDoc.addEventListener("click", () => showView("doc"));

/* ============================================================
   Documentation — test-case table + sample output
   ============================================================ */
function renderTestTable() {
  const body = document.getElementById("tcBody");

  body.innerHTML = TEST_CASES.map((tc, i) => {
    const isExpr = tc.mode === "expr";
    let expected;
    try {
      const values = tc.inputs.map(([b, v]) => parseValue(v, b));
      let result;
      if (isExpr) {
        const varValues = {};
        values.forEach((v, idx) => { varValues[String.fromCharCode(97 + idx)] = v; });
        result = evaluateFormulaAst(parseFormulaTokens(tokenizeFormula(tc.formula)), varValues);
      } else {
        result = applyOperation(values, tc.op);
      }
      expected = `${toBase(result, 10)} / ${toBase(result, 2)} / ` +
        `${toBase(result, 8)} / ${toBase(result, 16)}`;
    } catch (err) {
      expected = `Error &mdash; ${err.message}`;
    }

    const originals = tc.inputs
      .map(([b, v]) => `${v}<sub>${b}</sub>`)
      .join(isExpr ? ", " : " " + OP_SYMBOL[tc.op] + " ");

    return `<tr>
      <td class="mono">${String(i + 1).padStart(2, "0")}</td>
      <td class="nw">${tc.mix}</td>
      <td class="mono">${isExpr ? tc.formula : OP_SYMBOL[tc.op]}</td>
      <td class="mono nw">${originals}</td>
      <td class="mono">${expected}</td>
      <td class="tryc"><button class="try" data-case="${i}">Try</button></td>
    </tr>`;
  }).join("");

  body.querySelectorAll(".try").forEach(btn => {
    btn.addEventListener("click", () => loadCase(TEST_CASES[Number(btn.dataset.case)]));
  });
}

/** Test tables for Step 4: complements of single numbers, and subtraction by complement. */
function renderComplementTables() {
  const four = (p, w) => BASE_ORDER
    .map(b => `<div>${BASES[b].name} ${formatPattern(p, w, b)}</div>`).join("");

  document.getElementById("tcCompValues").innerHTML = COMPLEMENT_VALUES.map((cv, i) => {
    const c = complementsOf(parseValue(cv.value, cv.base).n, cv.width);
    return `<tr>
      <td class="mono">C${String(i + 1).padStart(2, "0")}</td>
      <td class="mono">${cv.value}<sub>${cv.base}</sub></td>
      <td class="mono">${cv.width}-bit</td>
      <td class="mono cbases">${four(c.ones, cv.width)}</td>
      <td class="mono cbases">${four(c.twos, cv.width)}</td>
    </tr>`;
  }).join("");

  const body = document.getElementById("tcCompCases");
  body.innerHTML = COMPLEMENT_CASES.map((tc, i) => {
    const num = "S" + String(i + 1).padStart(2, "0");
    const originals = tc.inputs.map(([b, v]) => `${v}<sub>${b}</sub>`).join(` ${OP_SYMBOL["-"]} `);
    const start = `<td class="mono">${num}</td><td class="nw">${tc.mix}</td><td class="mono nw">${originals}</td>`;
    const tryBtn = `<td class="tryc"><button class="try" data-ccase="${i}">Try</button></td>`;

    try {
      const values = tc.inputs.map(([b, v]) => parseValue(v, b));
      const w = complementWidth(values, tc.width || "auto");
      const sub = complementSubtraction(values, w);
      const cell = (run) => `${formatPattern(run.pattern, w, 2)} (${run.negZero ? "-0" : run.value})`;
      return `<tr>${start}<td class="mono nw">${w}-bit${tc.width ? "" : " auto"}</td>
        <td class="mono">${cell(sub.ones)}</td><td class="mono">${cell(sub.twos)}</td>
        <td class="mono">${sub.direct}</td>${tryBtn}</tr>`;
    } catch (err) {
      return `<tr>${start}<td class="mono nw">${tc.width ? tc.width + "-bit" : "auto"}</td>
        <td class="mono" colspan="3">Error — ${err.message}</td>${tryBtn}</tr>`;
    }
  }).join("");

  body.querySelectorAll(".try").forEach(btn => {
    btn.addEventListener("click", () => loadCase(COMPLEMENT_CASES[Number(btn.dataset.ccase)]));
  });
}

function loadCase(tc) {
  state = tc.inputs.map(([b, v]) => ({ base: b, raw: v }));
  setWordChoice(tc.width || "auto");
  setMode(tc.mode === "expr" ? "expr" : "chain");
  if (mode === "chain") {
    op = tc.op || "-";
    opsEl.querySelectorAll(".op").forEach(b =>
      b.setAttribute("aria-pressed", b.dataset.op === op));
  } else {
    exprInput.value = tc.formula;
  }
  syncCountButtons();
  buildRows();
  refreshResult();
  showView("calc");
  // complement cases are about Step 4, so scroll there instead of to the top
  const target = tc.op || tc.mode ? null : compBlock;
  if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  else window.scrollTo({ top: 0, behavior: "smooth" });
}

/** Plain-text equivalent of renderFormulaHTML(), for the sample-output panels. */
function renderFormulaText(tokens, mapVar) {
  return tokens.map(t => {
    if (t.type === "(" || t.type === ")") return t.type;
    if (t.type === "op") return OP_SYMBOL[t.op];
    if (t.type === "var") return mapVar(t.name);
    if (t.type === "num") return t.text;
    return "";
  }).join(" ");
}

/** Header + per-input conversion block shared by every sample panel. */
function sampleInputLines(tc, values) {
  const lines = [];
  lines.push("  NUMBER SYSTEM CONVERTER AND ARITHMETIC CALCULATOR");
  lines.push("  " + "=".repeat(50));
  lines.push("  How many numbers? " + tc.inputs.length);
  lines.push("");
  tc.inputs.forEach(([b, v], idx) => {
    const dec = values[idx];
    lines.push(`  Input ${idx + 1}:  ${v}   (base ${b}, ${BASES[b].label})`);
    lines.push(`     BIN = ${toBase(dec, 2)}`);
    lines.push(`     OCT = ${toBase(dec, 8)}`);
    lines.push(`     DEC = ${toBase(dec, 10)}`);
    lines.push(`     HEX = ${toBase(dec, 16)}`);
    lines.push("");
  });
  return lines;
}

/** Sample 1 — Simple chain mode, run start to finish. */
function renderSampleChain(tc) {
  const values = tc.inputs.map(([b, v]) => parseValue(v, b));
  const result = applyOperation(values, tc.op);
  const opName = { "+": "addition (+)", "-": "subtraction (-)", "*": "multiplication (x)", "/": "division (/)" }[tc.op];

  const lines = sampleInputLines(tc, values);
  lines.push("  Mode: Simple chain");
  lines.push("  Operation: " + opName);
  lines.push("  Common representation (decimal): " +
    values.map(v => toBase(v, 10)).join(` ${OP_SYMBOL[tc.op]} `) + " = " + toBase(result, 10));
  lines.push("");
  lines.push("  Expression:  " + tc.inputs.map(([b, v]) => `${v}(${b})`).join(` ${OP_SYMBOL[tc.op]} `));
  lines.push("  RESULT");
  lines.push("     BIN = " + toBase(result, 2));
  lines.push("     OCT = " + toBase(result, 8));
  lines.push("     DEC = " + toBase(result, 10));
  lines.push("     HEX = " + toBase(result, 16));

  document.getElementById("sampleOut").textContent = lines.join("\n");
}

/** Sample 2 — Expression mode: parentheses + mixed precedence, worked through. */
function renderSampleExpr(tc) {
  const values = tc.inputs.map(([b, v]) => parseValue(v, b));
  const varValues = {};
  values.forEach((v, idx) => { varValues[String.fromCharCode(97 + idx)] = v; });
  const tokens = tokenizeFormula(tc.formula);
  const ast = parseFormulaTokens(tokens);
  const result = evaluateFormulaAst(ast, varValues);

  const lines = sampleInputLines(tc, values);
  lines.push("  Mode: Expression");
  lines.push("  Formula (a, b, c, ... = inputs in order):  " + tc.formula);
  lines.push("  With original values:  " +
    renderFormulaText(tokens, name => {
      const idx = name.charCodeAt(0) - 97;
      const [b, v] = tc.inputs[idx];
      return `${v}(${b})`;
    }));
  lines.push("  Common representation (decimal):  " +
    renderFormulaText(tokens, name => toBase(varValues[name], 10)) + " = " + toBase(result, 10));
  lines.push("  RESULT");
  lines.push("     BIN = " + toBase(result, 2));
  lines.push("     OCT = " + toBase(result, 8));
  lines.push("     DEC = " + toBase(result, 10));
  lines.push("     HEX = " + toBase(result, 16));

  document.getElementById("sampleOutExpr").textContent = lines.join("\n");
}

/** Sample 3 — a run that trips an arithmetic error, to show the error handling in action. */
function renderSampleError(tc) {
  const values = tc.inputs.map(([b, v]) => parseValue(v, b));
  const lines = sampleInputLines(tc, values);

  if (tc.mode === "expr") {
    lines.push("  Mode: Expression");
    lines.push("  Formula (a, b, c, ... = inputs in order):  " + tc.formula);
  } else {
    const opName = { "+": "addition (+)", "-": "subtraction (-)", "*": "multiplication (x)", "/": "division (/)" }[tc.op];
    lines.push("  Mode: Simple chain");
    lines.push("  Operation: " + opName);
    lines.push("  Expression:  " + tc.inputs.map(([b, v]) => `${v}(${b})`).join(` ${OP_SYMBOL[tc.op]} `));
  }

  let message = "(no error — this case did not fail)";
  try {
    if (tc.mode === "expr") {
      const varValues = {};
      values.forEach((v, idx) => { varValues[String.fromCharCode(97 + idx)] = v; });
      evaluateFormulaAst(parseFormulaTokens(tokenizeFormula(tc.formula)), varValues);
    } else {
      applyOperation(values, tc.op);
    }
  } catch (err) {
    message = err.message;
  }

  lines.push("");
  lines.push("  RESULT");
  lines.push("     ERROR: " + message);
  lines.push("     (calculation stopped — Step 3 shows this same message)");

  document.getElementById("sampleOutError").textContent = lines.join("\n");
}

/** Sample 4 — complements of each input, then subtraction by both methods. Three panels. */
function renderSampleComplement(tc) {
  const values = tc.inputs.map(([b, v]) => parseValue(v, b));
  const w = complementWidth(values, tc.width || "auto");
  const sub = complementSubtraction(values, w);
  const bin = (p) => formatPattern(p, w, 2);
  const allBases = (p) => BASE_ORDER.map(b => `${BASES[b].name} ${formatPattern(p, w, b)}`).join("   ");
  const shown = tc.inputs.map(([b, v]) => `${v}(${b})`).join(` ${OP_SYMBOL["-"]} `);

  // panel 1: conversions + complements of every input
  const intro = sampleInputLines(tc, values);
  intro.push("  Mode: Complements   (word size: " + w + " bits" + (tc.width ? "" : ", auto") + ")");
  intro.push("");
  tc.inputs.forEach(([b, v], idx) => {
    const c = complementsOf(values[idx].n, w);
    intro.push(`  Input ${idx + 1}:  ${v}(${b})`);
    intro.push("     number = " + allBases(c.number));
    intro.push("     1's    = " + allBases(c.ones));
    intro.push("     2's    = " + allBases(c.twos));
    intro.push("");
  });

  // panels 2 and 3: one walkthrough per method
  const walk = (system, run) => {
    const lines = [];
    lines.push(`  Subtraction using ${SYSTEM_NAME[system]} complement:  ${shown}`);
    run.steps.forEach((st, idx) => {
      lines.push("");
      lines.push(`  Step ${idx + 1}:  ${st.aValue} ${OP_SYMBOL["-"]} ${st.bValue}`);
      stepRows(st, w, system).forEach(r => {
        const bits = (r.carry === undefined ? "  " : r.carry + " ") + r.bits;
        lines.push("     " + r.label.padEnd(22) + bits.padEnd(w + 4) + r.note);
      });
    });
    lines.push("");
    lines.push("  RESULT (" + SYSTEM_NAME[system] + " complement)");
    lines.push("     " + allBases(run.pattern));
    lines.push("     signed value = " + (run.negZero ? "-0 (equals 0)" : run.value));
    return lines;
  };

  const twos = walk(2, sub.twos);
  twos.push("");
  twos.push("  Plain subtraction check:  " + sub.direct + "   (both methods agree)");

  const host = document.getElementById("sampleOutComp");
  host.innerHTML = "";
  [intro, walk(1, sub.ones), twos].forEach(lines => {
    const panel = document.createElement("div");
    panel.className = "sample";
    panel.textContent = lines.join("\n");
    host.appendChild(panel);
  });
}

function renderSamples() {
  const chainCase = TEST_CASES.find(c => c.sample) || TEST_CASES.find(c => c.mode !== "expr");
  const exprCase  = TEST_CASES.find(c => c.sampleExpr);
  const errorCase = TEST_CASES.find(c => c.sampleError);
  const compCase  = COMPLEMENT_CASES.find(c => c.sampleComplement);

  if (chainCase) renderSampleChain(chainCase);
  if (exprCase) renderSampleExpr(exprCase);
  if (errorCase) renderSampleError(errorCase);
  if (compCase) renderSampleComplement(compCase);
}

/* ============================================================
   Export PDF — lays the Documentation tab out for print
   (see the @media print rules in styles.css) and opens the
   browser's print dialog, where "Save as PDF" makes the file.
   ============================================================ */
const REPORT_TITLE = "DOLERA - CPE463 H2 - Radix Workbench";

async function exportPdf() {
  const button = document.getElementById("exportPdf");
  button.disabled = true;

  showView("doc");
  // the flowcharts, web fonts and screenshots must be ready before the page is paginated
  const images = Array.from(document.images).map(img => img.decode().catch(() => {}));
  await Promise.all([
    document.fonts ? document.fonts.ready.catch(() => {}) : null,
    typeof renderFlowchart === "function" ? renderFlowchart() : null,
    ...images
  ]);

  const originalTitle = document.title;
  document.title = REPORT_TITLE;               // becomes the suggested file name
  document.body.classList.add("print-report");
  window.addEventListener("afterprint", () => {
    document.title = originalTitle;
    document.body.classList.remove("print-report");
    button.disabled = false;
  }, { once: true });

  window.print();
}
document.getElementById("exportPdf").addEventListener("click", exportPdf);

/* ============================================================
   Init
   ============================================================ */
syncCountButtons();
buildRows();
refreshResult();
renderTestTable();
renderComplementTables();
renderSamples();
