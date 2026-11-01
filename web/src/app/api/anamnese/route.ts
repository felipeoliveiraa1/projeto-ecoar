import { lerConfig } from "@/lib/agente/config";
import { carregarDocumento } from "@/lib/agente/documentos";

/*
 * Ficha de anamnese do Protocolo RB7. O texto vem do material do curso, então fica no
 * Supabase (documentos_base) e não no código público; esta rota fica atrás da senha do app.
 */
export async function GET() {
  const config = lerConfig();
  if (!config) return Response.json({ erro: "Agente não configurado." }, { status: 503 });
  const bruto = await carregarDocumento(config, "ficha-anamnese");
  if (!bruto) return Response.json({ erro: "Ficha indisponível." }, { status: 404 });
  try {
    return Response.json(JSON.parse(bruto), { headers: { "Cache-Control": "private, max-age=600" } });
  } catch {
    return Response.json({ erro: "Ficha inválida." }, { status: 500 });
  }
}
