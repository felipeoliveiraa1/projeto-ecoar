"""Divide aulas e apostilas em trechos para o índice de busca dos agentes.

Cada trecho leva a fonte pronta para citação (aula + minuto ou documento + página)
e uma "coleção", para que cada agente busque só no que lhe interessa:
  metodo    aulas do #10 + Plano Ecoar + Método RB7 + Anamnese
  conteudo  Como vender terapia de forma orgânica
  palco     Apostila Hipnose & Diversão (hipnose de entretenimento, fora do agente de terapia)
  juridico  modelos de contrato

Uso: python3 -I gerar_trechos.py <pasta_transcricoes> <pasta_textos_materiais> <saida.jsonl>
"""
import json
import re
import sys
import unicodedata
from collections import Counter
from pathlib import Path

ALVO, MAXIMO = 300, 450  # palavras por trecho
MARCADOR = re.compile(r"^\[(\d+:\d{2}(?::\d{2})?)\] (.*)$")
PAGINA = re.compile(r"^\[página (\d+)\]$")
COLECAO_DOC = {
    "Plano Ecoar - Apostila e Guia Completo": "metodo",
    "Método RB7 - Passo a passo": "metodo",
    "Anamnese - Passo a passo": "metodo",
    "Como vender terapia de forma orgânica": "conteudo",
    "Apostila Hipnose & Diversão": "palco",
    "Contrato hipnoterapia à vista_aprazo": "juridico",
    "Rescisão terapia cartão de crédito": "juridico",
}


def palavras(s):
    return len(s.split())


ANONIMIZAR = None  # (regex, substituto), carregado em main() a partir de conhecimento/anonimizacao.json


def anonimizar(texto):
    """Troca primeiros nomes de participantes por "[participante]" (a base do agente é anonimizada)."""
    if not ANONIMIZAR or not texto:
        return texto
    regex, substituto = ANONIMIZAR
    return regex.sub(substituto, texto)


def trechos_aula(arq):
    titulo = anonimizar(unicodedata.normalize("NFC", arq.stem))
    n = int(titulo[:2])
    pars = []
    for linha in arq.read_text(encoding="utf-8").splitlines():
        m = MARCADOR.match(linha)
        if m:
            pars.append((m.group(1), anonimizar(linha)))
    blocos, atual = [], []
    for p in pars:
        atual.append(p)
        if sum(palavras(x[1]) for x in atual) >= ALVO:
            blocos.append(atual)
            atual = [atual[-1]]  # sobreposição de um parágrafo entre trechos vizinhos
    if len(atual) > 1 or not blocos:
        blocos.append(atual)
    for i, b in enumerate(blocos, 1):
        yield {
            "id": f"aula{n:02d}-{i:03d}",
            "colecao": "metodo",
            "fonte": "aula",
            "aula": n,
            "titulo": titulo,
            "minuto_inicio": b[0][0],
            "minuto_fim": b[-1][0],
            "citacao": f"Aula {n} — {titulo[5:]}, {b[0][0]}",
            "texto": "\n".join(x[1] for x in b),
        }


def trechos_documento(arq):
    nome = unicodedata.normalize("NFC", arq.stem)  # nomes de arquivo no macOS podem vir decompostos
    colecao = COLECAO_DOC.get(nome, "outros")
    paginas, atual_pag, linhas = [], None, []
    for linha in arq.read_text(encoding="utf-8").splitlines():
        m = PAGINA.match(linha)
        if m:
            if atual_pag is not None:
                paginas.append((atual_pag, "\n".join(linhas).strip()))
            atual_pag, linhas = int(m.group(1)), []
        else:
            linhas.append(re.sub(r"[ \t]{2,}", " ", linha).strip())
    if atual_pag is not None:
        paginas.append((atual_pag, "\n".join(linhas).strip()))
    if not paginas:  # .docx sem páginas
        paginas = [(None, re.sub(r"[ \t]{2,}", " ", arq.read_text(encoding="utf-8")).strip())]

    pedacos = []  # (pag_ini, pag_fim, texto)
    buf_ini, buf = None, []
    for pag, texto in paginas:
        if not texto:
            continue
        ws = texto.split()
        if len(ws) > MAXIMO:  # página longa: quebra em partes
            for k in range(0, len(ws), ALVO):
                pedacos.append((pag, pag, " ".join(ws[k:k + ALVO])))
            continue
        if buf_ini is None:
            buf_ini = pag
        buf.append((pag, texto))
        if sum(palavras(t) for _, t in buf) >= 120:
            pedacos.append((buf_ini, pag, "\n\n".join(t for _, t in buf)))
            buf_ini, buf = None, []
    if buf:
        pedacos.append((buf_ini, buf[-1][0], "\n\n".join(t for _, t in buf)))

    for i, (p0, p1, texto) in enumerate(pedacos, 1):
        if p0 is None:
            onde = ""
        elif p0 == p1:
            onde = f", p. {p0}"
        else:
            onde = f", p. {p0}-{p1}"
        yield {
            "id": f"{re.sub(r'[^a-z0-9]+', '-', nome.lower()).strip('-')}-{i:03d}",
            "colecao": colecao,
            "fonte": "documento",
            "documento": nome,
            "pagina_inicio": p0,
            "pagina_fim": p1,
            "citacao": f"{nome}{onde}",
            "texto": texto,
        }


def main():
    global ANONIMIZAR
    pasta_tr, pasta_docs, saida = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
    lista = pasta_tr.parent / "conhecimento" / "anonimizacao.json"
    if lista.exists():
        dados = json.loads(lista.read_text(encoding="utf-8"))
        nomes = sorted(dados["nomes"], key=len, reverse=True)
        # Não troca em "São Paulo" nem quando o nome vem antes de sobrenome de autor citado (ex.: Daniel Kahneman).
        autores = dados.get("autores_preservados", [])
        depois = r"(?!\s+(?:" + "|".join(re.escape(a) for a in autores) + r")\b)" if autores else ""
        padrao = r"(?<!São )\b(?:" + "|".join(re.escape(n) for n in nomes) + r")\b" + depois
        ANONIMIZAR = (re.compile(padrao), dados.get("substituto", "[participante]"))
        print(f"anonimização: {len(nomes)} nomes")
    itens = []
    for arq in sorted(pasta_tr.glob("*.md")):
        itens.extend(trechos_aula(arq))
    for arq in sorted(pasta_docs.glob("*.txt")):
        itens.extend(trechos_documento(arq))
    saida.parent.mkdir(parents=True, exist_ok=True)
    with saida.open("w", encoding="utf-8") as f:
        for it in itens:
            f.write(json.dumps(it, ensure_ascii=False) + "\n")
    por_col = Counter(it["colecao"] for it in itens)
    media = sum(palavras(it["texto"]) for it in itens) / len(itens)
    print(f"{len(itens)} trechos ({dict(por_col)}), média de {media:.0f} palavras por trecho -> {saida}")


if __name__ == "__main__":
    main()
