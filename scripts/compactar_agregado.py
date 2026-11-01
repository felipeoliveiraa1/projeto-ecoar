"""Gera versões compactas (Markdown) dos arquivos agregados, para a etapa de síntese.

Agrupa itens repetidos (mesmo termo, mesma técnica) e troca o JSON por texto com a
fonte no formato [Aula N, mm:ss]. O trecho literal fica de fora: ele já foi conferido
e continua disponível no JSON agregado e na transcrição.

Uso: python3 -I compactar_agregado.py <pasta_agregado>
"""
import json
import re
import sys
import unicodedata
from collections import OrderedDict
from pathlib import Path


def fonte(item):
    return f"[Aula {item['aula']}, {item.get('minuto', '?')}]"


def chave(texto):
    t = unicodedata.normalize("NFD", (texto or "").lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    t = re.sub(r"\(.*?\)", "", t)
    return re.sub(r"[^a-z0-9]+", " ", t).strip()


def agrupar(itens, campo):
    grupos = OrderedDict()
    for it in sorted(itens, key=lambda x: (x["aula"], str(x.get("minuto", "")))):
        grupos.setdefault(chave(it.get(campo, "")), []).append(it)
    return grupos


def conceitos(itens):
    linhas = ["# Conceitos (agrupados por termo)\n"]
    for _, grupo in agrupar(itens, "termo").items():
        linhas.append(f"## {grupo[0].get('termo', '').strip()}")
        for it in grupo:
            linhas.append(f"- {it.get('definicao', '').strip()} {fonte(it)}")
        linhas.append("")
    return "\n".join(linhas)


def tecnicas(itens):
    linhas = ["# Técnicas e passos (agrupados por nome)\n"]
    for _, grupo in agrupar(itens, "nome").items():
        linhas.append(f"## {grupo[0].get('nome', '').strip()}")
        for it in grupo:
            partes = [f"Quando: {it['quando_usar']}" if it.get("quando_usar") else "",
                      f"Como: {it['como_fazer']}" if it.get("como_fazer") else ""]
            frases = it.get("frases_modelo") or []
            if frases:
                partes.append("Frases: " + " | ".join(f"\"{f}\"" for f in frases))
            linhas.append(f"- {' '.join(p for p in partes if p)} {fonte(it)}")
        linhas.append("")
    return "\n".join(linhas)


def limites(itens):
    linhas = ["# Limites, segurança, erros comuns e o que não fazer\n"]
    for it in sorted(itens, key=lambda x: (x["categoria"], x["aula"])):
        if it["categoria"] == "limites_e_seguranca":
            linhas.append(f"- LIMITE: {it.get('regra', '').strip()} {fonte(it)}")
        else:
            linhas.append(f"- ERRO: {it.get('erro', '').strip()} — Por quê: {it.get('por_que', '').strip()} {fonte(it)}")
    return "\n".join(linhas)


def casos(itens):
    linhas = ["# Casos e regressões das aulas (anonimizados)\n"]
    campos = [("queixa", "Queixa"), ("como_foi_conduzido", "Condução"), ("memorias_acessadas", "Memórias"),
              ("atualizacao_feita", "Atualização"), ("resultado_relatado", "Resultado relatado"),
              ("aprendizado", "Aprendizado")]
    for it in sorted(itens, key=lambda x: (x["aula"], str(x.get("minuto", "")))):
        linhas.append(f"## {it.get('titulo', 'Caso').strip()} {fonte(it)}")
        for c, rotulo in campos:
            if it.get(c):
                linhas.append(f"- {rotulo}: {it[c].strip()}")
        linhas.append("")
    return "\n".join(linhas)


def perguntas_respostas(itens):
    linhas = ["# Perguntas reais dos alunos e respostas do Rafael\n"]
    for it in sorted(itens, key=lambda x: (x["aula"], str(x.get("minuto", "")))):
        linhas.append(f"- P: {it.get('pergunta', '').strip()}\n  R: {it.get('resposta', '').strip()} {fonte(it)}")
    return "\n".join(linhas)


def voz(itens):
    linhas = ["# Voz do Rafael e referências citadas\n", "## Expressões, metáforas e bordões"]
    for it in itens:
        if it["categoria"] == "voz_do_rafael":
            linhas.append(f"- \"{it.get('expressao', '').strip()}\" — {it.get('significado_ou_uso', '').strip()} {fonte(it)}")
    linhas.append("\n## Referências citadas pelo Rafael")
    for it in itens:
        if it["categoria"] == "referencias_citadas":
            linhas.append(f"- {it.get('referencia', '').strip()}: {it.get('o_que_ele_diz', '').strip()} {fonte(it)}")
    return "\n".join(linhas)


def testes(itens):
    linhas = ["# Perguntas de teste propostas na extração\n"]
    for it in sorted(itens, key=lambda x: (x["aula"], str(x.get("minuto", "")))):
        linhas.append(f"- ({it.get('tipo', '?')}) P: {it.get('pergunta', '').strip()}\n  Esperado: {it.get('resposta_esperada', '').strip()} {fonte(it)}")
    return "\n".join(linhas)


GERADORES = {
    "conceitos": conceitos, "tecnicas": tecnicas, "limites_e_seguranca": limites, "casos": casos,
    "perguntas_e_respostas": perguntas_respostas, "voz_e_referencias": voz, "perguntas_de_teste": testes,
}


def main():
    pasta = Path(sys.argv[1])
    saida = pasta / "compacto"
    saida.mkdir(exist_ok=True)
    for nome, gerar in GERADORES.items():
        itens = json.loads((pasta / f"{nome}.json").read_text(encoding="utf-8"))
        texto = gerar(itens)
        (saida / f"{nome}.md").write_text(texto + "\n", encoding="utf-8")
        print(f"{nome}: {len(itens)} itens -> {len(texto) // 1000} mil caracteres")


if __name__ == "__main__":
    main()
