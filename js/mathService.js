const FUNCTIONS = Object.freeze({
  sqrt: Math.sqrt,
  abs: Math.abs,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  ln: Math.log,
  log: Math.log10,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  min: Math.min,
  max: Math.max,
  pow: Math.pow
});

const CONSTANTS = Object.freeze({ pi: Math.PI, e: Math.E });

function tokenize(input = "") {
  let source = String(input || "")
    .toLowerCase()
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-")
    .trim();

  // Em contas puramente numéricas aceitamos vírgula decimal PT-BR. Dentro de
  // funções, a vírgula continua sendo separador de argumentos (pow(2, 10)).
  if (!/[a-z_]/i.test(source)) source = source.replace(/(\d),(\d)/g, "$1.$2");

  const tokens = [];
  let index = 0;
  while (index < source.length) {
    const rest = source.slice(index);
    const space = rest.match(/^\s+/);
    if (space) { index += space[0].length; continue; }

    const number = rest.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i);
    if (number) {
      tokens.push({ type: "number", value: Number(number[0]) });
      index += number[0].length;
      continue;
    }

    const ident = rest.match(/^[a-z_][a-z0-9_]*/i);
    if (ident) {
      tokens.push({ type: "ident", value: ident[0].toLowerCase() });
      index += ident[0].length;
      continue;
    }

    const ch = source[index];
    if ("+-*/^(),%".includes(ch)) {
      tokens.push({ type: ch, value: ch });
      index += 1;
      continue;
    }
    throw new Error(`Símbolo matemático não permitido: ${ch}`);
  }
  tokens.push({ type: "eof", value: null });
  return tokens;
}

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.index = 0;
  }

  peek(type = null) {
    const token = this.tokens[this.index];
    return type ? token.type === type : token;
  }

  take(type) {
    const token = this.tokens[this.index];
    if (token.type !== type) throw new Error(`Esperava “${type}”, mas encontrei “${token.type}”.`);
    this.index += 1;
    return token;
  }

  parse() {
    const value = this.expression();
    if (!this.peek("eof")) throw new Error("Expressão incompleta ou inválida.");
    if (!Number.isFinite(value)) throw new Error("O resultado não é um número finito.");
    return value;
  }

  expression() {
    let value = this.term();
    while (this.peek("+") || this.peek("-")) {
      if (this.peek("+")) { this.take("+"); value += this.term(); }
      else { this.take("-"); value -= this.term(); }
    }
    return value;
  }

  term() {
    let value = this.power();
    while (this.peek("*") || this.peek("/")) {
      if (this.peek("*")) {
        this.take("*");
        value *= this.power();
      } else {
        this.take("/");
        const divisor = this.power();
        if (divisor === 0) throw new Error("Divisão por zero.");
        value /= divisor;
      }
    }
    return value;
  }

  power() {
    let value = this.unary();
    if (this.peek("^")) {
      this.take("^");
      value = value ** this.power();
    }
    return value;
  }

  unary() {
    if (this.peek("+")) { this.take("+"); return this.unary(); }
    if (this.peek("-")) { this.take("-"); return -this.unary(); }
    return this.postfix();
  }

  postfix() {
    let value = this.primary();
    while (this.peek("%")) {
      this.take("%");
      value /= 100;
    }
    return value;
  }

  primary() {
    if (this.peek("number")) return this.take("number").value;
    if (this.peek("(")) {
      this.take("(");
      const value = this.expression();
      this.take(")");
      return value;
    }
    if (this.peek("ident")) {
      const name = this.take("ident").value;
      if (Object.prototype.hasOwnProperty.call(CONSTANTS, name) && !this.peek("(")) return CONSTANTS[name];
      const fn = FUNCTIONS[name];
      if (!fn) throw new Error(`Função matemática não permitida: ${name}`);
      this.take("(");
      const args = [];
      if (!this.peek(")")) {
        args.push(this.expression());
        while (this.peek(",")) {
          this.take(",");
          args.push(this.expression());
        }
      }
      this.take(")");
      if (!args.length) throw new Error(`A função ${name} precisa de um valor.`);
      const value = fn(...args);
      if (!Number.isFinite(value)) throw new Error(`A função ${name} produziu um resultado inválido.`);
      return value;
    }
    throw new Error("Expressão matemática inválida.");
  }
}

export function safeCalculate(expression = "") {
  const parser = new Parser(tokenize(expression));
  const value = parser.parse();
  const rounded = Math.abs(value) < 1e15 ? Number(value.toPrecision(14)) : value;
  return { expression: String(expression), value: rounded };
}
