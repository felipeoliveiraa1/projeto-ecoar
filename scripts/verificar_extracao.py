"""Confere a extração da Fase 1 contra as transcrições.

Para cada item com "trecho" e "minuto", verifica se o trecho literal existe no
parágrafo daquele minuto (ou num vizinho). Classifica cada item como:
  ok            trecho encontrado no minuto indicado
  aproximado    trecho quase igual (>= 85% de semelhança) no minuto indicado
  minuto_errado trecho existe, mas em outro minuto (com --corrigir, o minuto é ajustado)
  nao_achado    trecho não existe na aula (possível invenção: precisa de revisão)
Também confere se os minutos dos demais itens existem e sinaliza nomes próprios
comuns (possível falha de anonimização).

Uso: python3 -I verificar_extracao.py <pasta_transcricoes> <pasta_extracao> [--corrigir]
"""
import json
import re
import sys
import unicodedata
from collections import Counter
from difflib import SequenceMatcher
from pathlib import Path

COM_TRECHO = ["conceitos", "tecnicas", "casos", "perguntas_e_respostas",
              "limites_e_seguranca", "erros_comuns_e_o_que_nao_fazer"]
SO_MINUTO = ["voz_do_rafael", "referencias_citadas", "perguntas_de_teste"]
CHAVES = ["aula", "titulo", "resumo", "temas", *COM_TRECHO, *SO_MINUTO, "observacoes"]
MARCADOR = re.compile(r"^\[(\d+:\d{2}(?::\d{2})?)\] (.*)$")
NOMES_COMUNS = set("""
ana maria joão josé pedro paulo lucas daniel gabriel carlos marcos fernanda juliana patrícia
aline camila bruna amanda letícia larissa mariana beatriz carla cláudia sandra márcia renata
vanessa tatiane priscila débora luana júlia gustavo felipe rodrigo bruno thiago tiago andré
diego ricardo eduardo fábio marcelo leonardo vinícius mateus matheus rafaela isabela isabel
helena sofia laura luiza luísa milena yara simone elaine adriana cristina roberta raquel
lúcia fátima tereza vera sônia rita regina sílvia valéria viviane daniela gabriela natália
paula jéssica kelly michele carolina bianca henrique antônio francisco luiz luís jorge sérgio
márcio alexandre leandro roberto rogério fabiana flávia karina kátia luciana mônica tânia
""".split())


def norm(s):
    s = unicodedata.normalize("NFC", s.lower())
    s = re.sub(r"[^\w\s]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def carregar_aula(pasta, n):
    arq = next(Path(pasta).glob(f"{n:02d} - *.md"))
    pars = []
    for linha in arq.read_text(encoding="utf-8").splitlines():
        m = MARCADOR.match(linha)
        if m:
            pars.append((m.group(1), norm(m.group(2))))
    return pars


def semelhanca(trecho, texto):
    """Maior semelhança entre o trecho e qualquer janela de mesmo tamanho do texto."""
    if trecho in texto:
        return 1.0
    pt, ptx = trecho.split(), texto.split()
    k = len(pt)
    if not k or len(ptx) < k:
        return SequenceMatcher(None, trecho, texto).ratio()
    melhor = 0.0
    for i in range(0, len(ptx) - k + 1):
        sm = SequenceMatcher(None, trecho, " ".join(ptx[i:i + k]))
        if sm.real_quick_ratio() <= melhor or sm.quick_ratio() <= melhor:
            continue
        r = sm.ratio()
        if r > melhor:
            melhor = r
            if r > 0.97:
                break
    return melhor


def checar_item(item, pars, idx_por_minuto):
    trecho = norm(item.get("trecho", ""))
    minuto = str(item.get("minuto", "")).strip("[] ")
    if not trecho:
        return "sem_trecho", None
    i = idx_por_minuto.get(minuto)
    if i is not None:
        vizinhos = " ".join(t for _, t in pars[max(0, i - 1): i + 2])
        s = semelhanca(trecho, vizinhos)
        if s == 1.0:
            return "ok", None
        if s >= 0.85:
            return "aproximado", None
    # procura na aula inteira: primeiro o trecho exato, depois o aproximado
    for j, (m, t) in enumerate(pars):
        if trecho in " ".join(x for _, x in pars[j: j + 2]):
            return "minuto_errado", m
    melhor, onde = 0.0, None
    for j, (m, t) in enumerate(pars):
        janela = " ".join(x for _, x in pars[j: j + 2])
        s = semelhanca(trecho, janela)
        if s > melhor:
            melhor, onde = s, m
        if s == 1.0:
            break
    if melhor >= 0.85:
        return "minuto_errado", onde
    return "nao_achado", None


def nomes_suspeitos(dados):
    achados = Counter()
    texto = json.dumps(dados, ensure_ascii=False)
    for palavra in re.findall(r"\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+\b", texto):
        if palavra.lower() in NOMES_COMUNS:
            achados[palavra] += 1
    return achados


def main():
    pasta_tr, pasta_ex = sys.argv[1], Path(sys.argv[2])
    corrigir = "--corrigir" in sys.argv
    total = Counter()
    relatorio = {}
    for arq in sorted(pasta_ex.glob("aula-*.json")):
        n = int(arq.stem.split("-")[1])
        try:
            dados = json.loads(arq.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            print(f"aula {n:02d}: JSON inválido ({e})")
            total["json_invalido"] += 1
            continue
        faltando = [c for c in CHAVES if c not in dados]
        pars = carregar_aula(pasta_tr, n)
        idx = {m: i for i, (m, _) in enumerate(pars)}
        cont, problemas, mudou = Counter(), [], False
        for cat in COM_TRECHO:
            for item in dados.get(cat, []) or []:
                status, novo = checar_item(item, pars, idx)
                cont[status] += 1
                if status == "minuto_errado" and corrigir:
                    item["minuto"] = novo
                    mudou = True
                if status in ("nao_achado", "sem_trecho"):
                    problemas.append(f"{cat}: {status} [{item.get('minuto')}] {str(item.get('trecho', ''))[:70]}")
        for cat in SO_MINUTO:
            for item in dados.get(cat, []) or []:
                m = str(item.get("minuto", "")).strip("[] ")
                cont["minuto_ok" if m in idx else "minuto_inexistente"] += 1
        nomes = nomes_suspeitos({k: v for k, v in dados.items() if k not in ("titulo",)})
        if mudou:
            arq.write_text(json.dumps(dados, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        total.update(cont)
        relatorio[n] = {"contagem": dict(cont), "faltando": faltando, "problemas": problemas,
                        "nomes_suspeitos": dict(nomes)}
        linha = " ".join(f"{k}:{v}" for k, v in sorted(cont.items()))
        extras = []
        if faltando:
            extras.append(f"faltando {faltando}")
        if nomes:
            extras.append(f"nomes? {dict(nomes)}")
        print(f"aula {n:02d}: {linha}" + (f" | {' | '.join(extras)}" if extras else ""))
    (pasta_ex / "_verificacao.json").write_text(json.dumps(relatorio, ensure_ascii=False, indent=2),
                                               encoding="utf-8")
    com_trecho = sum(total[k] for k in ("ok", "aproximado", "minuto_errado", "nao_achado", "sem_trecho"))
    if com_trecho:
        bons = total["ok"] + total["aproximado"]
        print(f"\nTOTAL: {com_trecho} itens com trecho | conferidos no minuto certo: {bons} "
              f"({bons / com_trecho:.1%}) | minuto errado: {total['minuto_errado']} | "
              f"não achados: {total['nao_achado']} | sem trecho: {total['sem_trecho']} | "
              f"minutos inexistentes (demais itens): {total['minuto_inexistente']}")


if __name__ == "__main__":
    main()
