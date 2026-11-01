"""Extrai o texto dos PDFs página por página, com marcador "[página N]".

- Remove as linhas de marca d'água ("Licensed to ...") que trazem nome/e-mail de quem comprou.
- Nos PDFs que perderam "fi"/"fl" (ligaduras soltas), recoloca as letras usando
  as funções de corrigir_ligaduras.py.
- Converte os .docx com o textutil do macOS (sem páginas).

Uso: python3 -I extrair_pdfs.py <pasta_materiais> <pasta_transcricoes>
Saída: <pasta_materiais>/texto/<nome>.txt
"""
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import corrigir_ligaduras as cl  # noqa: E402

MARCA_DAGUA = re.compile(r"Licensed to ")


def paginas(pdf):
    info = subprocess.run(["pdfinfo", str(pdf)], capture_output=True, text=True, check=True).stdout
    return int(re.search(r"^Pages:\s+(\d+)", info, re.M).group(1))


def texto_pagina(pdf, n):
    out = subprocess.run(["pdftotext", "-layout", "-f", str(n), "-l", str(n), str(pdf), "-"],
                         capture_output=True, text=True, check=True).stdout
    return [l.replace("\f", "") for l in out.splitlines() if not MARCA_DAGUA.search(l)]


def main():
    materiais = Path(sys.argv[1])
    transcricoes = sys.argv[2]
    saida = materiais / "texto"
    saida.mkdir(exist_ok=True)

    docs = {}
    for pdf in sorted(materiais.glob("*.pdf")):
        docs[pdf.stem] = [texto_pagina(pdf, n) for n in range(1, paginas(pdf) + 1)]

    todo_texto = ["\n".join(l for pag in pags for l in pag) for pags in docs.values()]
    vocab = cl.carregar_vocab(transcricoes, todo_texto)

    for nome, pags in docs.items():
        soltas = sum(1 for pag in pags for l in pag if cl.SOLTAS.match(l))
        trocas = Counter()
        partes = []
        for n, pag in enumerate(pags, 1):
            linhas = pag
            if soltas:
                linhas = [cl.corrigir_linha(l, vocab, trocas) for l in pag if not cl.SOLTAS.match(l)]
            corpo = "\n".join(linhas).strip()
            partes.append(f"[página {n}]\n{corpo}\n")
        (saida / f"{nome}.txt").write_text("\n".join(partes), encoding="utf-8")
        print(f"{nome}: {len(pags)} páginas, ligaduras soltas: {soltas}, correções: {sum(trocas.values())}")

    for docx in sorted(materiais.glob("*.docx")):
        subprocess.run(["textutil", "-convert", "txt", "-output", str(saida / f"{docx.stem}.txt"), str(docx)],
                       capture_output=True, check=True)
        print(f"{docx.stem}: convertido do Word")


if __name__ == "__main__":
    main()
