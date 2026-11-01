"""Recoloca "fi"/"fl" que o pdftotext perdeu (ex.: "con ar" -> "confiar", "siológico" -> "fisiológico").

Usa como dicionário as palavras das transcrições das aulas (mais uma lista de
palavras comuns). Só junta fragmentos quando o resultado é uma palavra conhecida
e pelo menos um dos fragmentos sozinho não é. Remove linhas só com "fi"/"fl" soltos.

Uso: python3 -I corrigir_ligaduras.py <pasta_transcricoes> <arquivo.txt> [...]
"""
import re
import sys
from collections import Counter
from pathlib import Path

LIGS = ("fi", "fl")
LETRAS = "A-Za-zÀ-ÿ"
PALAVRA = re.compile(f"[{LETRAS}]+")
SOLTAS = re.compile(r"^\s*(?:(?:fi|fl|ff|ffi|ffl)\s*)+$")
FIM_LETRAS = re.compile(f"^(.*?)([{LETRAS}]+)$")
INICIO_LETRAS = re.compile(f"^([{LETRAS}]+)(.*)$")
EXTRAS = """
confiar confiança conflito conflitos suficiente suficientes fisiológico fisiológica identifique
identificar identifica identificação específico específica especificamente eficaz eficácia
significado significa significativo reflexo reflexão influência influencia definir definição
dificuldade dificuldades difícil final finalmente afinal filho filha filhos filhas ficar fica
ficou fique profissional profissionais oficial benefício benefícios perfil perfis fim fins
flexível flexibilidade fluxo fluir flor fortificar fixar fixo firme filtro filosofia ficha
desafio desafios científico científica superfície sacrifício magnífico pacífico
""".split()


def carregar_vocab(pasta_transcricoes, textos_pdf):
    vocab = Counter()
    for f in Path(pasta_transcricoes).glob("*.md"):
        vocab.update(w.lower() for w in PALAVRA.findall(f.read_text(encoding="utf-8")))
    # Do PDF só entram palavras que já vieram com fi/fl inteiros (os fragmentos quebrados ficam de fora).
    for t in textos_pdf:
        vocab.update(w.lower() for w in PALAVRA.findall(t) if "fi" in w.lower() or "fl" in w.lower())
    vocab.update({w: 1000 for w in EXTRAS})
    return vocab


def freq(w, vocab):
    return vocab.get(w.lower(), 0)


def com_caixa(modelo, palavra):
    return palavra[:1].upper() + palavra[1:] if modelo[:1].isupper() else palavra


def corrigir_linha(linha, vocab, trocas):
    partes = re.split(r"( )", linha)  # mantém os espaços como itens separados
    i = 0
    while i + 2 < len(partes):
        a, esp, b = partes[i], partes[i + 1], partes[i + 2]
        ma, mb = FIM_LETRAS.match(a), INICIO_LETRAS.match(b)
        if esp == " " and ma and mb:
            pre, fa = ma.groups()
            fb, pos = mb.groups()
            juntou = False
            for lig in LIGS:
                cand = fa + lig + fb
                fragmentos_comuns = freq(fa, vocab) >= 20 and freq(fb, vocab) >= 20
                if freq(cand, vocab) >= 2 and not fragmentos_comuns:
                    trocas[f"{fa} {fb} -> {cand}"] += 1
                    partes[i:i + 3] = [pre + cand + pos]
                    juntou = True
                    break
            if juntou:
                continue  # a palavra nova pode ter outra ligadura com a próxima
        i += 1
    linha = "".join(partes)

    def prefixo(m):
        w = m.group(0)
        if freq(w, vocab) >= 2:
            return w
        for lig in LIGS:
            cand = com_caixa(w, lig + w.lower())
            if freq(cand, vocab) >= 2:
                trocas[f"{w} -> {cand}"] += 1
                return cand
        return w

    return PALAVRA.sub(prefixo, linha)


def main():
    pasta = sys.argv[1]
    arquivos = [Path(p) for p in sys.argv[2:]]
    textos = {f: f.read_text(encoding="utf-8") for f in arquivos}
    vocab = carregar_vocab(pasta, textos.values())
    for f, texto in textos.items():
        soltas = sum(len(re.findall(r"\b(?:fi|fl)\b", l)) for l in texto.splitlines() if SOLTAS.match(l))
        trocas = Counter()
        linhas = [corrigir_linha(l, vocab, trocas) for l in texto.splitlines() if not SOLTAS.match(l)]
        f.write_text("\n".join(linhas) + "\n", encoding="utf-8")
        print(f"\n## {f.name}: {soltas} ligaduras soltas no PDF, {sum(trocas.values())} correções")
        for t, n in trocas.most_common():
            print(f"   {n:3d}x {t}")


if __name__ == "__main__":
    main()
