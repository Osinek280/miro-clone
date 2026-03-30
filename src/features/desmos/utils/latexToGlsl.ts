/**
 * Converts a MathQuill-style LaTeX fragment into a GLSL ES 1.0 expression
 * using parameters `x` and `y` (implicit form f(x,y) for contouring).
 */

const PI = '3.14159265358979323846';

function preprocess(latex: string): string {
  return latex
    .replace(/\\left/g, '')
    .replace(/\\right/g, '')
    .replace(/\\cdot/g, '*')
    .replace(/\\times/g, '*')
    .replace(/\\div/g, '/')
    .replace(/\s+/g, '');
}

export function latexExprToGlsl(latex: string): string | null {
  const raw = latex.trim();
  if (!raw) return null;
  try {
    const p = new LatexParser(preprocess(raw));
    const out = p.parseExpression();
    p.skipSpace();
    if (p.i < p.s.length) return null;
    return out;
  } catch {
    return null;
  }
}

class LatexParser {
  s: string;
  i = 0;

  constructor(s: string) {
    this.s = s;
  }

  skipSpace(): void {
    while (this.i < this.s.length && /\s/.test(this.s[this.i]!)) this.i++;
  }

  peek(): string | undefined {
    this.skipSpace();
    return this.s[this.i];
  }

  at(ch: string): boolean {
    return this.peek() === ch;
  }

  consume(ch?: string): void {
    this.skipSpace();
    if (ch !== undefined && this.s[this.i] !== ch) {
      throw new Error('expected');
    }
    if (this.i < this.s.length) this.i++;
  }

  parseExpression(): string {
    let left = this.parseTerm();
    while (true) {
      this.skipSpace();
      const op = this.s[this.i];
      if (op === '+' || op === '-') {
        this.i++;
        const right = this.parseTerm();
        left = `(${left})${op}(${right})`;
      } else break;
    }
    return left;
  }

  parseTerm(): string {
    let left = this.parseUnary();
    while (true) {
      this.skipSpace();
      const op = this.s[this.i];
      if (op === '*' || op === '/') {
        this.i++;
        const right = this.parseUnary();
        left = op === '*' ? `(${left})*(${right})` : `(${left})/(${right})`;
      } else if (this.canStartPrimary()) {
        const right = this.parseUnary();
        left = `(${left})*(${right})`;
      } else break;
    }
    return left;
  }

  canStartPrimary(): boolean {
    if (this.i >= this.s.length) return false;
    const c = this.s[this.i]!;
    if (c === '(' || c === '{' || c === '\\') return true;
    if (/[0-9.]/.test(c)) return true;
    if (/[a-zA-Z]/.test(c)) return true;
    return false;
  }

  parseUnary(): string {
    let neg = false;
    while (true) {
      this.skipSpace();
      const c = this.s[this.i];
      if (c === '+') this.i++;
      else if (c === '-') {
        this.i++;
        neg = !neg;
      } else break;
    }
    let e = this.parsePostfix();
    return neg ? `(0.0-(${e}))` : e;
  }

  parsePostfix(): string {
    let base = this.parsePrimary();
    this.skipSpace();
    if (this.at('^')) {
      this.consume('^');
      const exp = this.parsePostfix();
      return `pow((${base}), (${exp}))`;
    }
    return base;
  }

  readBraced(): string {
    this.consume('{');
    let depth = 1;
    const start = this.i;
    while (this.i < this.s.length && depth > 0) {
      const c = this.s[this.i]!;
      if (c === '{') depth++;
      else if (c === '}') depth--;
      if (depth === 0) {
        const inner = this.s.slice(start, this.i);
        this.i++;
        return inner;
      }
      this.i++;
    }
    throw new Error('unbalanced');
  }

  readBracketed(): string {
    this.consume('[');
    const start = this.i;
    while (this.i < this.s.length && this.s[this.i] !== ']') this.i++;
    const inner = this.s.slice(start, this.i);
    if (this.s[this.i] !== ']') throw new Error(']');
    this.i++;
    return inner;
  }

  parseCommand(): string {
    this.consume('\\');
    const start = this.i;
    while (
      this.i < this.s.length &&
      /[a-zA-Z]/.test(this.s[this.i]!)
    ) {
      this.i++;
    }
    const name = this.s.slice(start, this.i).toLowerCase();
    if (!name) throw new Error('cmd');

    switch (name) {
      case 'frac': {
        const a = this.readBraced();
        const b = this.readBraced();
        const pa = new LatexParser(a).parseExpression();
        const pb = new LatexParser(b).parseExpression();
        return `((${pa})/(${pb}))`;
      }
      case 'sqrt': {
        let root = 2;
        if (this.at('[')) {
          const idx = this.readBracketed();
          root = Number.parseFloat(idx.trim());
          if (!Number.isFinite(root) || root <= 0) throw new Error('sqrt idx');
        }
        const inner = this.readBraced();
        const innerExpr = new LatexParser(inner).parseExpression();
        if (root === 2) return `sqrt((${innerExpr}))`;
        return `pow((${innerExpr}), (1.0/(${root}.0)))`;
      }
      case 'sin':
        return `sin((${this.parseParenOrBraceArg()}))`;
      case 'cos':
        return `cos((${this.parseParenOrBraceArg()}))`;
      case 'tan':
        return `tan((${this.parseParenOrBraceArg()}))`;
      case 'asin':
        return `asin((${this.parseParenOrBraceArg()}))`;
      case 'acos':
        return `acos((${this.parseParenOrBraceArg()}))`;
      case 'atan':
        return `atan((${this.parseParenOrBraceArg()}))`;
      case 'ln':
        return `log((${this.parseParenOrBraceArg()}))`;
      case 'log':
        return `(log((${this.parseParenOrBraceArg()}))/log(10.0))`;
      case 'exp':
        return `exp((${this.parseParenOrBraceArg()}))`;
      case 'abs':
        return `abs((${this.parseParenOrBraceArg()}))`;
      case 'pi':
        return `(${PI})`;
      case 'infty':
        return '(1e20)';
      default:
        throw new Error(`unknown \\${name}`);
    }
  }

  /** Argument as `(…)`, `{…}`, or a single primary (e.g. `\sin x`). */
  parseParenOrBraceArg(): string {
    this.skipSpace();
    if (this.at('(')) {
      this.consume('(');
      const e = this.parseExpression();
      this.consume(')');
      return e;
    }
    if (this.at('{')) {
      const inner = this.readBraced();
      return new LatexParser(inner).parseExpression();
    }
    const e = this.parsePrimary();
    return e;
  }

  readNumber(): string {
    const start = this.i;
    if (this.s[this.i] === '.') {
      this.i++;
      while (this.i < this.s.length && /[0-9]/.test(this.s[this.i]!)) this.i++;
      const raw = this.s.slice(start, this.i);
      if (raw.length < 2) throw new Error('num');
      return raw;
    }
    while (this.i < this.s.length && /[0-9]/.test(this.s[this.i]!)) this.i++;
    if (this.i < this.s.length && this.s[this.i] === '.') {
      this.i++;
      while (this.i < this.s.length && /[0-9]/.test(this.s[this.i]!)) this.i++;
    }
    const raw = this.s.slice(start, this.i);
    if (!raw) throw new Error('num');
    return raw.includes('.') ? raw : `${raw}.0`;
  }

  parsePrimary(): string {
    this.skipSpace();
    if (this.i >= this.s.length) throw new Error('eof');

    if (/[0-9.]/.test(this.s[this.i]!)) {
      return this.readNumber();
    }

    if (this.at('(')) {
      this.consume('(');
      const e = this.parseExpression();
      this.consume(')');
      return `(${e})`;
    }

    if (this.at('{')) {
      const inner = this.readBraced();
      return new LatexParser(inner).parseExpression();
    }

    if (this.at('\\')) {
      return this.parseCommand();
    }

    const c = this.s[this.i]!;
    if (/[a-zA-Z]/.test(c)) {
      this.i++;
      if (c === 'x' || c === 'y') return c;
      if (c === 'e') return '(2.71828182845904523536)';
      throw new Error(`var ${c}`);
    }

    throw new Error('primary');
  }
}
