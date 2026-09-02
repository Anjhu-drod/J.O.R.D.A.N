import { normalizeText } from "./utils.js";

const EPS = 1e-12;

function number(value) {
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function unitNumber(text, units) {
  const pattern = new RegExp(`(-?\\d+(?:[\\.,]\\d+)?)\\s*(?:${units})\\b`, "i");
  const match = text.match(pattern);
  return match ? number(match[1]) : null;
}

function format(value, digits = 3) {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if ((abs > 0 && abs < 0.001) || abs >= 1e6) return value.toExponential(3).replace(".", ",");
  return Number(value.toFixed(digits)).toLocaleString("pt-BR", { maximumFractionDigits: digits });
}

function result(title, answer, details = [], formula = "") {
  return { title, answer, details, formula };
}

function parseResistorList(text) {
  const pair = text.match(/(-?\d+(?:[\.,]\d+)?)\s*(?:e|,|com)\s*(-?\d+(?:[\.,]\d+)?)\s*(?:ohm|ohms|Ω)/i);
  if (pair) return [number(pair[1]), number(pair[2])].filter((v) => v !== null && v > 0);
  const matches = [...text.matchAll(/(-?\d+(?:[\.,]\d+)?)\s*(?:ohm|ohms|Ω)/gi)];
  return matches.map((m) => number(m[1])).filter((v) => v !== null && v > 0);
}

export class ScienceService {
  answer(input = "") {
    const raw = String(input);
    const text = normalizeText(raw);

    const resistors = parseResistorList(raw);
    if (resistors.length >= 2 && /\bserie\b/.test(text)) {
      const equivalent = resistors.reduce((sum, r) => sum + r, 0);
      return result(
        "Resistores em série",
        `A resistência equivalente é ${format(equivalent)} Ω.`,
        [`Valores: ${resistors.map((r) => `${format(r)} Ω`).join(" + ")}`],
        "Req = R1 + R2 + ..."
      );
    }

    if (resistors.length >= 2 && /\bparalel/.test(text)) {
      const inverse = resistors.reduce((sum, r) => sum + 1 / r, 0);
      const equivalent = inverse > EPS ? 1 / inverse : Infinity;
      return result(
        "Resistores em paralelo",
        `A resistência equivalente é aproximadamente ${format(equivalent)} Ω.`,
        [`Valores: ${resistors.map((r) => `${format(r)} Ω`).join(", ")}`],
        "1/Req = 1/R1 + 1/R2 + ..."
      );
    }

    const volts = unitNumber(raw, "v|volt|volts");
    const amps = unitNumber(raw, "a|ampere|amperes|amp|amps");
    const ohms = unitNumber(raw, "ohm|ohms|Ω");
    const watts = unitNumber(raw, "w|watt|watts");

    if (volts !== null && ohms !== null && amps === null) {
      const current = volts / ohms;
      return result("Lei de Ohm", `A corrente é ${format(current)} A.`, [`Tensão: ${format(volts)} V`, `Resistência: ${format(ohms)} Ω`], "I = V / R");
    }

    if (amps !== null && ohms !== null && volts === null) {
      const voltage = amps * ohms;
      return result("Lei de Ohm", `A tensão é ${format(voltage)} V.`, [`Corrente: ${format(amps)} A`, `Resistência: ${format(ohms)} Ω`], "V = I · R");
    }

    if (volts !== null && amps !== null && ohms === null && !/\bpotencia\b/.test(text)) {
      const resistance = volts / Math.max(Math.abs(amps), EPS);
      return result("Lei de Ohm", `A resistência é ${format(resistance)} Ω.`, [`Tensão: ${format(volts)} V`, `Corrente: ${format(amps)} A`], "R = V / I");
    }

    if (volts !== null && amps !== null && (/\bpotencia\b/.test(text) || watts === null)) {
      const power = volts * amps;
      return result("Potência elétrica", `A potência é ${format(power)} W.`, [`Tensão: ${format(volts)} V`, `Corrente: ${format(amps)} A`], "P = V · I");
    }

    const massKg = unitNumber(raw, "kg|quilo|quilos|quilograma|quilogramas");
    const speedMps = unitNumber(raw, "m\/s|mps|metro por segundo|metros por segundo");
    const speedKmh = unitNumber(raw, "km\/h|kmh|quilometros por hora|quilômetros por hora");
    const acceleration = unitNumber(raw, "m\/s2|m\/s²|metros por segundo ao quadrado");

    if (massKg !== null && /\b(?:correr|andar|ficar|passar)\b.*\b(?:sobre\s+a|sobre|na)\s+agua\b/.test(text)) {
      // Estimativa hidrodinâmica didática. O fator 0,28 representa uma área de contato útil
      // aproximada por passada e perdas de apoio. Não é um modelo biomecânico completo.
      const rho = 1000;
      const g = 9.80665;
      const footArea = 0.022;
      const cd = 1.0;
      const dutyFactor = 0.28;
      const verticalImpactSpeed = Math.sqrt((2 * massKg * g) / (rho * cd * footArea * dutyFactor));
      const estimatedForward = verticalImpactSpeed * 1.35;
      return result(
        "Corrida sobre a água · estimativa",
        `Com ${format(massKg, 1)} kg, um modelo hidrodinâmico bem simplificado dá algo na ordem de ${format(estimatedForward, 1)} m/s, cerca de ${format(estimatedForward * 3.6, 0)} km/h. Para uma pessoa real isso não significa que seria possível correr sobre a água: postura, tempo de contato, área do pé, cavitação e potência muscular tornam a situação muito mais difícil.`,
        [
          `Massa: ${format(massKg, 1)} kg`,
          `Área útil de pé assumida: ${format(footArea * 10000, 0)} cm²`,
          "Modelo: força de arrasto hidrodinâmico equilibrando aproximadamente o peso"
        ],
        "F ≈ ½·ρ·Cd·A·v²"
      );
    }

    if (massKg !== null && (speedMps !== null || speedKmh !== null) && /\benergia\s+cinetica\b/.test(text)) {
      const v = speedMps ?? speedKmh / 3.6;
      const energy = 0.5 * massKg * v * v;
      return result("Energia cinética", `A energia cinética é aproximadamente ${format(energy)} J.`, [`Massa: ${format(massKg)} kg`, `Velocidade: ${format(v)} m/s`], "Ec = ½·m·v²");
    }

    if (massKg !== null && (speedMps !== null || speedKmh !== null) && /\b(?:momento|quantidade de movimento)\b/.test(text)) {
      const v = speedMps ?? speedKmh / 3.6;
      const momentum = massKg * v;
      return result("Momento linear", `O momento linear é ${format(momentum)} kg·m/s.`, [`Massa: ${format(massKg)} kg`, `Velocidade: ${format(v)} m/s`], "p = m·v");
    }

    if (massKg !== null && acceleration !== null && /\bforca\b/.test(text)) {
      const force = massKg * acceleration;
      return result("Segunda lei de Newton", `A força resultante é ${format(force)} N.`, [`Massa: ${format(massKg)} kg`, `Aceleração: ${format(acceleration)} m/s²`], "F = m·a");
    }

    if (/\b(?:lei de ohm|o que e resistencia|o que é resistência|como funciona um resistor|circuito eletrico|circuito elétrico)\b/.test(text)) {
      return result(
        "Circuitos elétricos",
        "Em um circuito resistivo básico, tensão é a diferença de potencial, corrente é o fluxo de carga e resistência limita a corrente. A relação central é a Lei de Ohm. Em série, a corrente é a mesma; em paralelo, a tensão é a mesma entre os ramos.",
        ["Potência: P = V·I", "Energia: E = P·t", "Série: resistências somam", "Paralelo: somam-se os inversos"],
        "V = I·R"
      );
    }

    return null;
  }
}
