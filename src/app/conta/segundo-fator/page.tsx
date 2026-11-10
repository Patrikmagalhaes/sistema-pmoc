import { forbidden } from "next/navigation";
import { segundoFatorAtivoDesde } from "@/modules/acesso";
import { getAuth } from "@/server/auth";
import { exigirLogin } from "@/server/auth/sessao";
import { SegundoFator } from "./segundo-fator";

export const runtime = "nodejs";
export const metadata = { title: "Segundo fator – Sistema PMOC" };

const dataBR = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeZone: "America/Sao_Paulo",
});

/** TL-004 – Configurar segundo fator (ADM; RN-194; 04 §4.5). */
export default async function SegundoFatorPage() {
  const s = await exigirLogin();
  if (s.usuario.perfil !== "ADM") forbidden(); // TECNICO e CLIENTE não têm segundo fator no MVP
  const ativo = s.estado === "OK";
  const desde = ativo ? await segundoFatorAtivoDesde(s.ctx, getAuth().deps) : null;
  return (
    <main className="centro">
      <div className="cartao">
        <h1>Segundo fator</h1>
        <SegundoFator ativo={ativo} ativoDesde={desde ? dataBR.format(desde) : null} />
      </div>
    </main>
  );
}
