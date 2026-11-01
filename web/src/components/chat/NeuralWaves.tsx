import { cn } from "@/lib/utils";

/*
 * Ondas de partículas douradas atrás do cérebro (conexões neurais).
 * Cada onda é uma linha tracejada com traços de comprimento ~0, que viram pontos.
 * A animação desloca os pontos ao longo da linha (stroke-dashoffset), só com CSS.
 * Os caminhos são calculados de forma determinística, iguais no servidor e no navegador.
 */

const LARGURA = 1600;
const ALTURA = 360;
const CENTRO_Y = ALTURA / 2;
const LINHAS = 14;
const AMOSTRAS = 64;

function caminhoDaOnda(k: number): string {
  const fase = 0.55 + k * 0.2;
  const amplitudeBase = 92 + k * 3;
  const pontos: [number, number][] = [];
  for (let i = 0; i <= AMOSTRAS; i++) {
    const u = i / AMOSTRAS;
    const borda = Math.pow(Math.abs(2 * u - 1), 1.1); // 0 no centro, 1 nas bordas
    const amplitude = amplitudeBase * (0.22 + 0.78 * borda);
    const y =
      CENTRO_Y +
      amplitude * Math.sin(2 * Math.PI * 1.04 * u + fase) +
      12 * Math.sin(2 * Math.PI * 3.1 * u + k * 0.45);
    pontos.push([u * LARGURA, y]);
  }
  // Catmull-Rom convertido em curvas de Bézier, para a onda ficar suave.
  let d = `M${pontos[0][0].toFixed(1)},${pontos[0][1].toFixed(1)}`;
  for (let i = 0; i < pontos.length - 1; i++) {
    const p0 = pontos[Math.max(0, i - 1)];
    const p1 = pontos[i];
    const p2 = pontos[i + 1];
    const p3 = pontos[Math.min(pontos.length - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

const ONDAS = Array.from({ length: LINHAS }, (_, k) => ({
  d: caminhoDaOnda(k),
  duracao: 26 + (k % 4) * 6,
  opacidade: Number((0.4 + 0.6 * Math.sin((Math.PI * (k + 0.5)) / LINHAS)).toFixed(3)),
}));

export function NeuralWaves({ className }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${LARGURA} ${ALTURA}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
      className={cn("pointer-events-none select-none", className)}
    >
      <defs>
        <linearGradient id="rb7-onda" x1="0" y1="0" x2={LARGURA} y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f5cf70" stopOpacity="0.15" />
          <stop offset="0.1" stopColor="#f5cf70" stopOpacity="1" />
          <stop offset="0.34" stopColor="#d4a32e" stopOpacity="0.75" />
          <stop offset="0.5" stopColor="#d4a32e" stopOpacity="0.3" />
          <stop offset="0.66" stopColor="#d4a32e" stopOpacity="0.75" />
          <stop offset="0.9" stopColor="#f5cf70" stopOpacity="1" />
          <stop offset="1" stopColor="#f5cf70" stopOpacity="0.15" />
        </linearGradient>
      </defs>
      <g className="ondas-respirando">
        {ONDAS.map((onda, i) => (
          <path
            key={i}
            d={onda.d}
            fill="none"
            stroke="url(#rb7-onda)"
            strokeWidth={1.9}
            strokeLinecap="round"
            strokeDasharray="0.1 8.3"
            opacity={onda.opacidade}
            className="onda-particulas"
            style={{ animationDuration: `${onda.duracao}s` }}
          />
        ))}
      </g>
    </svg>
  );
}
