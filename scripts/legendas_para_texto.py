"""Converte as legendas .vtt da Kiwify em transcrições legíveis (Markdown).

Gera um arquivo por aula e um arquivo único com o curso inteiro, em ordem.
Uso: python3 -I legendas_para_texto.py <aulas.json> <pasta_legendas> <pasta_saida>
"""
import json
import re
import sys
from pathlib import Path

TS = re.compile(r"(\d+):(\d{2}):(\d{2})\.(\d{3}) --> (\d+):(\d{2}):(\d{2})\.(\d{3})")
PAUSA_NOVO_PARAGRAFO = 2.5  # segundos de silêncio que abrem um parágrafo novo
TAMANHO_PARAGRAFO = 900  # caracteres; passado disso, quebra no próximo ponto final
TAMANHO_MAXIMO = 1400  # caracteres; trechos sem pontuação quebram aqui mesmo assim


def secs(h, m, s, ms):
    return int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000


def hms(t):
    t = int(t)
    return f"{t // 3600}:{t % 3600 // 60:02d}:{t % 60:02d}" if t >= 3600 else f"{t // 60:02d}:{t % 60:02d}"


def chave_ruido(texto):
    """Texto da legenda sem pontuação nas pontas, para comparar com a lista de ruído."""
    return texto.lower().strip(" .,!?;:…\"'")


def parse_vtt(path, remover=frozenset(), inserir=(), intervalos=()):
    """Lê a legenda, remove ruído e intervalos indevidos e insere as falas recuperadas (ver _correcoes.json)."""
    cues, cur = [], None
    for line in path.read_text(encoding="utf-8").splitlines():
        m = TS.match(line)
        if m:
            g = m.groups()
            cur = [secs(*g[:4]), secs(*g[4:]), []]
            cues.append(cur)
        elif cur is not None and line.strip():
            cur[2].append(line.strip())
    brutas = [(a, b, " ".join(t).strip()) for a, b, t in cues]
    brutas = [c for c in brutas if c[2] and chave_ruido(c[2]) and chave_ruido(c[2]) not in remover]
    brutas = [c for c in brutas if not any(ini <= c[0] < fim for ini, fim in intervalos)]
    brutas += [(c["inicio"], c["fim"], c["texto"]) for c in inserir]
    brutas.sort(key=lambda c: c[0])
    out = []
    for a, b, texto in brutas:
        if not (out and out[-1][2] == texto):  # descarta legenda idêntica colada
            out.append((a, b, texto))
    return out


def carregar_correcoes(pasta):
    arq = Path(pasta) / "_correcoes.json"
    if not arq.exists():
        return frozenset(), {}, {}
    dados = json.loads(arq.read_text(encoding="utf-8"))
    remover = frozenset(chave_ruido(t) for t in dados.get("remover_legendas_iguais_a", []))
    inserir = {int(n): v.get("legendas", []) for n, v in dados.get("inserir", {}).items()}
    intervalos = {int(n): [tuple(i) for i in v.get("intervalos", [])]
                  for n, v in dados.get("remover_intervalos", {}).items()}
    return remover, inserir, intervalos


def paragrafos(cues):
    pars, atual, inicio, fim_ant = [], [], None, None
    for a, b, t in cues:
        tamanho = sum(len(x) + 1 for x in atual)
        quebra = atual and (
            a - fim_ant > PAUSA_NOVO_PARAGRAFO
            or (tamanho > TAMANHO_PARAGRAFO and atual[-1].endswith((".", "?", "!")))
            or tamanho > TAMANHO_MAXIMO
        )
        if quebra:
            pars.append((inicio, " ".join(atual)))
            atual, inicio = [], None
        if inicio is None:
            inicio = a
        atual.append(t)
        fim_ant = b
    if atual:
        pars.append((inicio, " ".join(atual)))
    return pars


def main():
    aulas = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    pasta = Path(sys.argv[2])
    saida = Path(sys.argv[3])
    saida.mkdir(parents=True, exist_ok=True)
    remover, inserir, intervalos = carregar_correcoes(pasta)

    modulo = "ECOAR Experience #10 (Método Atualizado)"
    completo = [f"# {modulo} — transcrição completa\n",
                "Curso: Escola Ecoar · Professor: Rafael Barreiros · 43 aulas\n",
                "Fonte: legendas automáticas da Kiwify. Cada parágrafo começa com o "
                "minuto da aula entre colchetes.\n"]
    total_palavras = 0
    for a in aulas:
        n = int(a["order"])
        cues = parse_vtt(pasta / f"{n:02d}.vtt", remover, inserir.get(n, ()), intervalos.get(n, ()))
        dur = cues[-1][1] if cues else 0
        corpo = "\n\n".join(f"[{hms(t)}] {txt}" for t, txt in paragrafos(cues))
        palavras = sum(len(t.split()) for _, _, t in cues)
        total_palavras += palavras
        titulo = a["title"].strip()
        cabecalho = f"# {titulo}\n\nMódulo: {modulo} · Aula {n} de 43 · Duração: {hms(dur)}\n"
        (saida / f"{titulo}.md").write_text(f"{cabecalho}\n{corpo}\n", encoding="utf-8")
        completo.append(f"\n---\n\n## {titulo}\n\nAula {n} de 43 · Duração: {hms(dur)}\n\n{corpo}\n")

    (saida.parent / "ECOAR-10-transcricao-completa.md").write_text("\n".join(completo), encoding="utf-8")
    print(f"{len(aulas)} aulas, {total_palavras} palavras no total")


if __name__ == "__main__":
    main()
