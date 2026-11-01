"""Confere se cada legenda da Kiwify cobre a aula inteira e procura sinais de problema.

Uso: python3 -I checar_legendas.py <aulas.json> <pasta_legendas> <durations.tsv>
"""
import json
import re
import sys
from collections import Counter
from pathlib import Path

TS = re.compile(r"(\d+):(\d{2}):(\d{2})\.(\d{3}) --> (\d+):(\d{2}):(\d{2})\.(\d{3})")


def secs(h, m, s, ms):
    return int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000


def parse_vtt(path):
    cues, cur = [], None
    for line in path.read_text(encoding="utf-8").splitlines():
        m = TS.match(line)
        if m:
            g = m.groups()
            cur = [secs(*g[:4]), secs(*g[4:]), []]
            cues.append(cur)
        elif cur is not None and line.strip():
            cur[2].append(line.strip())
    return [(a, b, " ".join(t)) for a, b, t in cues]


def main():
    aulas = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    pasta = Path(sys.argv[2])
    dur = {}
    for line in Path(sys.argv[3]).read_text().splitlines():
        n, d, _ = line.split("\t")
        dur[int(n)] = int(d)

    print("aula | duração | legenda até | cobertura | palavras/min | maior buraco | linha mais repetida")
    for a in aulas:
        n = int(a["order"])
        cues = parse_vtt(pasta / f"{n:02d}.vtt")
        d = dur[n]
        fim = cues[-1][1] if cues else 0
        palavras = sum(len(t.split()) for _, _, t in cues)
        gaps = [cues[i + 1][0] - cues[i][1] for i in range(len(cues) - 1)]
        gaps.append(cues[0][0] if cues else d)  # silêncio no começo
        gaps.append(d - fim)  # silêncio no fim
        maior = max(gaps) if gaps else d
        rep = Counter(t.lower() for _, _, t in cues if len(t) > 15).most_common(1)
        rep_txt = f"{rep[0][1]}x '{rep[0][0][:40]}'" if rep and rep[0][1] >= 3 else "-"
        alerta = " <-- conferir" if (fim < d * 0.95 or maior > 120 or (rep and rep[0][1] >= 5)) else ""
        print(f"{n:02d} | {d // 60:3d}min | {fim / 60:6.1f}min | {fim / d * 100:5.1f}% | "
              f"{palavras / (d / 60):5.0f} | {maior:5.0f}s | {rep_txt}{alerta}")


if __name__ == "__main__":
    main()
