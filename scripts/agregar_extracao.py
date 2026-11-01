"""Junta as extrações das 43 aulas em arquivos por tema, para a etapa de síntese.

Cada item ganha "aula", "titulo" e "verificacao" (resultado da conferência do trecho).
Itens cujo trecho não foi encontrado na aula vão para _nao_verificados.json e
ficam fora dos arquivos de tema até alguém revisar.

Uso: python3 -I agregar_extracao.py <pasta_transcricoes> <pasta_extracao> <pasta_saida>
"""
import json
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import verificar_extracao as ve  # noqa: E402

TEMAS = {
    "conceitos": ["conceitos"],
    "tecnicas": ["tecnicas"],
    "casos": ["casos"],
    "perguntas_e_respostas": ["perguntas_e_respostas"],
    "limites_e_seguranca": ["limites_e_seguranca", "erros_comuns_e_o_que_nao_fazer"],
    "voz_e_referencias": ["voz_do_rafael", "referencias_citadas"],
    "perguntas_de_teste": ["perguntas_de_teste"],
}


def main():
    pasta_tr, pasta_ex, saida = sys.argv[1], Path(sys.argv[2]), Path(sys.argv[3])
    saida.mkdir(parents=True, exist_ok=True)
    por_tema = {t: [] for t in TEMAS}
    nao_verificados, resumos, contagem = [], [], Counter()

    for arq in sorted(pasta_ex.glob("aula-*.json")):
        dados = json.loads(arq.read_text(encoding="utf-8"))
        n = int(dados["aula"])
        pars = ve.carregar_aula(pasta_tr, n)
        idx = {m: i for i, (m, _) in enumerate(pars)}
        resumos.append(f"## {dados['titulo']}\n\nTemas: {', '.join(dados.get('temas', []))}\n\n"
                       f"{dados.get('resumo', '')}\n\nObservações do extrator: {dados.get('observacoes') or '-'}\n")
        for tema, cats in TEMAS.items():
            for cat in cats:
                for item in dados.get(cat, []) or []:
                    item = {"aula": n, "titulo": dados["titulo"], "categoria": cat, **item}
                    if cat in ve.COM_TRECHO:
                        status, novo = ve.checar_item(item, pars, idx)
                        if status == "minuto_errado":
                            item["minuto"] = novo
                            status = "ok_minuto_corrigido"
                        item["verificacao"] = status
                        if status in ("nao_achado", "sem_trecho"):
                            nao_verificados.append(item)
                            contagem["nao_verificado"] += 1
                            continue
                    por_tema[tema].append(item)
                    contagem[tema] += 1

    for tema, itens in por_tema.items():
        (saida / f"{tema}.json").write_text(json.dumps(itens, ensure_ascii=False, indent=1), encoding="utf-8")
    (saida / "_nao_verificados.json").write_text(json.dumps(nao_verificados, ensure_ascii=False, indent=1),
                                                encoding="utf-8")
    (saida / "resumos.md").write_text("# Resumos das aulas (extração)\n\n" + "\n".join(resumos), encoding="utf-8")
    print(" | ".join(f"{k}: {v}" for k, v in contagem.items()))


if __name__ == "__main__":
    main()
