/* ============================================================
   expression.js — free-form expressions for Expression mode
   Depends on: rational.js, converter.js, arithmetic.js

   Grammar (lowest to highest precedence), left associative,
   parentheses override everything:

     expr   := term (("+" | "-") term)*
     term   := factor (("*" | "/") factor)*
     factor := ("+" | "-") factor | primary
     primary:= NUMBER | VARIABLE | "(" expr ")"

   Variables are single letters (a, b, c, ...) mapped to the
   inputs in order. No DOM code here — tokens/AST are handed
   back to app.js for rendering and evaluation.
   ============================================================ */

/** Split a formula string into tokens, or throw a descriptive Error. */
function tokenizeFormula(text) {
  const tokens = [];
  let i = 0;
  const len = text.length;

  while (i < len) {
    const ch = text[i];

    if (/\s/.test(ch)) { i++; continue; }

    if (ch === "(" || ch === ")") { tokens.push({ type: ch }); i++; continue; }

    if (ch === "+" || ch === "-" || ch === "*" || ch === "/") {
      tokens.push({ type: "op", op: ch });
      i++;
      continue;
    }

    if (/[0-9.]/.test(ch)) {
      const start = i;
      while (i < len && /[0-9.]/.test(text[i])) i++;
      tokens.push({ type: "num", text: text.slice(start, i) });
      continue;
    }

    if (/[a-zA-Z]/.test(ch)) {
      tokens.push({ type: "var", name: ch.toLowerCase() });
      i++;
      continue;
    }

    throw new Error(`Unexpected character "${ch}" in the formula.`);
  }

  return tokens;
}

/** Human-readable name for a token, used in error messages. */
function describeToken(t) {
  if (!t) return "end of the formula";
  if (t.type === "op") return `"${t.op}"`;
  if (t.type === "var") return `"${t.name}"`;
  if (t.type === "num") return `"${t.text}"`;
  return `"${t.type}"`;
}

/**
 * Parse `tokens` (from tokenizeFormula) into an AST.
 * Throws a descriptive Error on any syntax problem: empty formula,
 * unmatched parentheses, missing operators, trailing operators, etc.
 */
function parseFormulaTokens(tokens) {
  if (tokens.length === 0) {
    throw new Error("Enter a formula to evaluate, e.g. (a + b - c) * d.");
  }

  let pos = 0;
  const peek = () => tokens[pos];

  function parseExpr() {
    let node = parseTerm();
    while (peek() && peek().type === "op" && (peek().op === "+" || peek().op === "-")) {
      const op = tokens[pos++].op;
      const right = parseTerm();
      node = { type: "bin", op, left: node, right };
    }
    return node;
  }

  function parseTerm() {
    let node = parseFactor();
    while (peek() && peek().type === "op" && (peek().op === "*" || peek().op === "/")) {
      const op = tokens[pos++].op;
      const right = parseFactor();
      node = { type: "bin", op, left: node, right };
    }
    return node;
  }

  function parseFactor() {
    const t = peek();
    if (t && t.type === "op" && (t.op === "+" || t.op === "-")) {
      pos++;
      return { type: "unary", op: t.op, expr: parseFactor() };
    }
    return parsePrimary();
  }

  function parsePrimary() {
    const t = peek();
    if (!t) {
      throw new Error("The formula ends unexpectedly — a number, variable, or \"(\" was expected.");
    }
    if (t.type === "(") {
      pos++;
      const node = parseExpr();
      if (!peek() || peek().type !== ")") {
        throw new Error("Missing a closing \")\" — check your parentheses.");
      }
      pos++;
      return node;
    }
    if (t.type === "var") { pos++; return { type: "var", name: t.name }; }
    if (t.type === "num") { pos++; return { type: "num", text: t.text }; }
    throw new Error(`Expected a number, variable, or "(" but found ${describeToken(t)}.`);
  }

  const ast = parseExpr();

  if (pos < tokens.length) {
    const t = tokens[pos];
    if (t.type === ")") throw new Error("Unmatched \")\" — remove it or add a matching \"(\".");
    throw new Error(`Unexpected ${describeToken(t)} — did you forget an operator?`);
  }

  return ast;
}

/**
 * Evaluate an AST from parseFormulaTokens against `varValues`
 * ({ a: rational, b: rational, ... }). Returns a rational.
 * Throws on an undefined variable or division by zero.
 */
function evaluateFormulaAst(node, varValues) {
  switch (node.type) {
    case "num":
      return parseValue(node.text, 10);
    case "var": {
      const v = varValues[node.name];
      if (v === undefined) {
        const letters = Object.keys(varValues).sort();
        const range = letters.length ? `a–${letters[letters.length - 1]}` : "none";
        throw new Error(`Variable "${node.name}" is not defined — this run has inputs ${range}.`);
      }
      return v;
    }
    case "unary": {
      const v = evaluateFormulaAst(node.expr, varValues);
      return node.op === "-" ? ratNeg(v) : v;
    }
    case "bin": {
      const l = evaluateFormulaAst(node.left, varValues);
      const r = evaluateFormulaAst(node.right, varValues);
      return OP_FN[node.op](l, r);
    }
  }
}

/**
 * Render `tokens` back into an HTML string, replacing each variable
 * token via `mapVar(name)`. Operators are wrapped the same way the
 * chain-mode expression line wraps them (see app.js exprFromOriginals).
 */
function renderFormulaHTML(tokens, mapVar) {
  return tokens.map(t => {
    if (t.type === "(" || t.type === ")") return t.type;
    if (t.type === "op") return `<span class="op-sym">${OP_SYMBOL[t.op]}</span>`;
    if (t.type === "var") return mapVar(t.name);
    if (t.type === "num") return t.text;
    return "";
  }).join(" ");
}
