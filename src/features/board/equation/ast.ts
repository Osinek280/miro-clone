/** Własne AST wyrażeń matematycznych z LaTeX (MathQuill). */

export type BinaryOp =
  | '+'
  | '-'
  | '*'
  | '/'
  | '^'
  | '='
  | '<'
  | '>'
  | '<='
  | '>='
  | '!='
  | '±';

export type UnaryOp = '+' | '-';

export type Delimiter =
  | '('
  | ')'
  | '['
  | ']'
  | '{'
  | '}'
  | '|'
  | '.';

export type Expr =
  | NumberLiteral
  | Identifier
  | UnaryExpr
  | BinaryExpr
  | PowerExpr
  | SubscriptExpr
  | FractionExpr
  | SqrtExpr
  | CallExpr
  | DelimitedExpr
  | TupleExpr;

export interface NumberLiteral {
  type: 'Number';
  value: string;
}

export interface Identifier {
  type: 'Identifier';
  name: string;
}

export interface UnaryExpr {
  type: 'Unary';
  op: UnaryOp;
  argument: Expr;
}

export interface BinaryExpr {
  type: 'Binary';
  op: BinaryOp;
  left: Expr;
  right: Expr;
}

export interface PowerExpr {
  type: 'Power';
  base: Expr;
  exponent: Expr;
}

export interface SubscriptExpr {
  type: 'Subscript';
  base: Expr;
  sub: Expr;
}

export interface FractionExpr {
  type: 'Fraction';
  numerator: Expr;
  denominator: Expr;
}

export interface SqrtExpr {
  type: 'Sqrt';
  radicand: Expr;
  index?: Expr;
}

export interface CallExpr {
  type: 'Call';
  name: string;
  arguments: Expr[];
}

export interface DelimitedExpr {
  type: 'Delimited';
  left: Delimiter;
  right: Delimiter;
  body: Expr;
}

export interface TupleExpr {
  type: 'Tuple';
  elements: Expr[];
}

export function isExpr(node: unknown): node is Expr {
  return (
    typeof node === 'object' &&
    node !== null &&
    'type' in node &&
    typeof (node as Expr).type === 'string'
  );
}

/** Przejście po drzewie (pre-order): węzeł, potem dzieci w kolejności logicznej. */
export function walkExpr(
  expr: Expr,
  visit: (node: Expr) => void,
): void {
  visit(expr);
  switch (expr.type) {
    case 'Number':
    case 'Identifier':
      return;
    case 'Unary':
      walkExpr(expr.argument, visit);
      return;
    case 'Binary':
      walkExpr(expr.left, visit);
      walkExpr(expr.right, visit);
      return;
    case 'Power':
      walkExpr(expr.base, visit);
      walkExpr(expr.exponent, visit);
      return;
    case 'Subscript':
      walkExpr(expr.base, visit);
      walkExpr(expr.sub, visit);
      return;
    case 'Fraction':
      walkExpr(expr.numerator, visit);
      walkExpr(expr.denominator, visit);
      return;
    case 'Sqrt':
      if (expr.index) {
        walkExpr(expr.index, visit);
      }
      walkExpr(expr.radicand, visit);
      return;
    case 'Call':
      for (const a of expr.arguments) {
        walkExpr(a, visit);
      }
      return;
    case 'Delimited':
      walkExpr(expr.body, visit);
      return;
    case 'Tuple':
      for (const e of expr.elements) {
        walkExpr(e, visit);
      }
      return;
    default: {
      const _exhaustive: never = expr;
      return _exhaustive;
    }
  }
}

/** Zbiera nazwy identyfikatorów (np. do sprawdzania „zdefiniowane vs wolne”). */
export function collectIdentifiers(
  expr: Expr,
  out: Set<string> = new Set(),
): Set<string> {
  walkExpr(expr, (node) => {
    if (node.type === 'Identifier') {
      out.add(node.name);
    }
  });
  return out;
}
