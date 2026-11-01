import { NextResponse, type NextRequest } from "next/server";

/*
 * Proteção de acesso enquanto não existe login de alunos.
 * Se ACESSO_SENHA estiver definida, o navegador pede usuário e senha (Basic Auth) antes
 * de abrir o app e a API. Assim o link público não expõe o conteúdo do curso nem gasta
 * créditos da Azure. Sem a variável (ambiente local), o app fica aberto.
 */

function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i++) diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferenca === 0;
}

export function proxy(request: NextRequest) {
  const senha = process.env.ACESSO_SENHA;
  if (!senha) return NextResponse.next();
  const usuario = process.env.ACESSO_USUARIO ?? "rb7";

  const cabecalho = request.headers.get("authorization") ?? "";
  if (cabecalho.startsWith("Basic ")) {
    try {
      const [u, ...resto] = atob(cabecalho.slice(6)).split(":");
      if (iguais(u, usuario) && iguais(resto.join(":"), senha)) return NextResponse.next();
    } catch {
      // cabeçalho malformado: cai no pedido de senha abaixo
    }
  }
  return new NextResponse("Acesso restrito ao Agente RB7.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Agente RB7", charset="UTF-8"' },
  });
}

export const config = {
  // Tudo, menos arquivos estáticos do Next (o ícone e o cérebro também ficam protegidos).
  matcher: ["/((?!_next/static|_next/image).*)"],
};
