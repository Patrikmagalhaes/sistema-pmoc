# Análise dos PMOCs existentes (engenharia reversa)

> **Objetivo:** registrar, sem interpretação livre, o que os 4 PMOCs de referência contêm, para servir de base aos requisitos do novo sistema.
> **Convenção:** tudo que não está escrito nos PDFs nem foi dito pelo usuário está marcado **[A VALIDAR]**. Itens marcados **(inferido)** são deduções minhas a partir do padrão dos PDFs.
> **Revisão 3 – versão final desta etapa (16/10/2026):** todas as perguntas foram respondidas. As decisões estão na **§8** (`DEC-01` a `DEC-32`); as regras para o sistema estão na **§9**; a **§10** lista só pendências pequenas que não bloqueiam o PRD. As seções 0 a 7 continuam descrevendo os PDFs antigos (Frigus) e foram anotadas onde uma decisão muda a leitura.

## 0. Fontes analisadas

| ID | Arquivo | Páginas | Cliente (capa) | Vigência (texto da capa) | Colunas da Ficha Histórico | Gerado em (rodapé) |
|---|---|---|---|---|---|---|
| DOK | `PMOC-Dokyo Japan Food-TH35922-R1.pdf` | 8 | Dokyo Japan Food | 1/4/2025 até 30/4/2026 | Abr/25 → Mar/26 | 16/10/2026 |
| AUR | `PMOC-AURELIO-TH01320.pdf` | 25 | AURELIO | 1/9/2025 até 1/8/2026 | Set/25 → Ago/26 | 16/10/2026 |
| CSL | `PMOC-CLINICA SAO LUIZ-CTR-00054.pdf` | 19 | CLINICA SAO LUIZ | 14/11/2025 até 14/10/2026 | Nov/25 → Out/26 | 16/10/2026 |
| PBS | `PMOC-PORTO BELO ADMINISTRADORA DE SHOPPING CENTERS LTDA-CTR-00080 (1).pdf` | 32 | PORTO BELO ADMINISTRADORA DE SHOPPING CENTERS LTDA | 14/8/2026 até 30/7/2027 | Ago/26 → Jul/27 | 30/9/2026 |

Observações gerais:
- Todos foram gerados pelo software **Frigus** (rodapé: `frigus.app.br`, logo Frigus no rodapé). Empresa executora em todos: **Thermo Service Sistemas de Climatização Ltda**.
- Os códigos `TH35922-R1`, `TH01320`, `CTR-00054`, `CTR-00080` aparecem **só no nome do arquivo**, nunca no corpo do documento.
- Página A4, retrato. Texto extraível (não é digitalizado).

---

## 1. Estrutura do documento

### 1.1 Ordem das seções (idêntica nos 4 PDFs)

| # | Seção (título exato no PDF) | Página típica | Conteúdo |
|---|---|---|---|
| — | Capa | 1 | Nome do cliente, título, vigência, local e data |
| 1 | `1. DADOS DA INSTALAÇÃO` | 2 | Endereço do local climatizado |
| 2 | `2. DADOS DO PROPRIETÁRIO` | 2 | Razão social e documento do proprietário |
| 3 | `3. DADOS DA EMPRESA EXECUTORA` | 2 | Empresa de manutenção, CREA, ART |
| 4 | `4. DADOS DO RESPONSÁVEL TÉCNICO` | 2 | RT + assinatura digital |
| 5 | `5. LISTAGEM DE EQUIPAMENTOS` | 3 | Resumo agrupado (quantidade por tipo) |
| 6 | `6. CRONOGRAMA` | 4 (PBS: 4–5) | Uma tabela por tipo de equipamento (`6.1`, `6.2`, …) com a periodicidade de cada atividade |
| — | `ANEXO 1` (folha de rosto) + texto | 5–6 | Página de rosto "Portaria do Ministério da Saúde 3523" + transcrição da Portaria |
| — | `ANEXO 2` (folha de rosto) + fichas | 7 → fim | Página de rosto "FICHA HISTÓRICO" + **uma página por equipamento** |

### 1.2 Elementos repetidos em todas as páginas

| Elemento | Posição | Conteúdo / formato |
|---|---|---|
| Logo da empresa executora | Topo esquerdo | Imagem (logo "THERMO SERVICE") |
| Cabeçalho da empresa | Topo centro | `Razão social` / `Endereço, nº, bairro, cidade/UF` / `Telefone (xx) xxxx-xxxx` |
| Rodapé | Base centro | `Página: {n} de {total} - PMOC gerado digitalmente em {d/m/aaaa} - frigus.app.br` |
| Logo do software | Base direita | Logo Frigus |

> Exceção: as páginas de ficha histórico (Anexo 2) **não** têm o cabeçalho da empresa, só o rodapé.

### 1.3 Capa — campos

| Campo | Exemplo (DOK) | Regra observada |
|---|---|---|
| Nome do cliente | `Dokyo Japan Food` | Igual a "Cliente" da seção 1 (nome fantasia) |
| Título fixo | `Plano de Manutenção Operação e Controle do Sistema de Ar Condicionado` | Texto fixo |
| Vigência | `Vigência de 1/4/2025 até 30/4/2026` | Datas sem zero à esquerda |
| Local e data | `São José, 1 de abril de 2025` | Cidade = cidade da empresa executora; data = início da vigência (inferido, vale nos 4) |

### 1.4 Seção 6 — Cronograma (formato da tabela)

- Uma subseção por **tipo de equipamento** presente no cliente (`6.1 Split`, `6.2 Splitão`, …).
- Colunas: `DESCRIÇÃO | MM | MB | MT | MS | MA`.
- Cada atividade tem **exatamente um "X"** em uma das 5 colunas.
- As siglas **não são definidas** no documento. **Confirmado pelo usuário (DEC-04):** MM = mensal, MB = bimestral, MT = trimestral, MS = semestral, MA = anual. Indício a favor: no Splitão (PBS), a atividade "Além dos serviços de manutenção mensal" está em MT e "Além dos serviços de manutenção mensal e trimestral" está em MS.
- Atividades aparecem ordenadas por periodicidade (MM → MA); dentro da mesma periodicidade a ordem varia entre PDFs.

### 1.5 Anexo 2 — Ficha Histórico (uma página por equipamento)

Cabeçalho da ficha (grade 3 linhas × 3 colunas):

| Coluna 1 | Coluna 2 | Coluna 3 |
|---|---|---|
| Tipo do equipamento (ex.: `Fancoletes`) | `Grupo:` (ex.: `Built-in`) | `Local:` (ex.: `FANCOIL - 18000 - COZINHA`) |
| — | `Marca:` | `Modelo:` |
| — | `Série:` | `Capacidade:` |

Corpo da ficha:
- Colunas: `DESCRIÇÃO` + **12 colunas de mês** (`Mmm/aa`, ex.: `Abr/25`), começando no mês de início da vigência.
- Linhas: todas as atividades do cronograma daquele tipo de equipamento.
- Legenda no rodapé da tabela: `OK - efetuado   NOK - não efetuado   Ø - não previsto`.

Estados de célula observados (visualmente):

| Estado | Aparência | Significado |
|---|---|---|
| `OK` | Texto "OK", fundo branco | Atividade prevista e executada |
| `NOK` | Texto "NOK", fundo branco | Atividade prevista e não executada |
| `Ø` | Ícone Ø, fundo cinza | Atividade não prevista naquele mês |
| (vazio) | Célula branca vazia | Atividade prevista, **sem registro** (não aparece na legenda) |

> A ficha funciona ao mesmo tempo como **calendário** (onde há atividade prevista) e como **registro de execução** (OK/NOK). Não há data do dia, técnico, observação, medição ou foto.

---

## 2. Dados cadastrais

### 2.1 Campos por seção (rótulos exatos)

| Seção | Campo (rótulo no PDF) | Observação |
|---|---|---|
| 1. Dados da Instalação | `Cliente` | Nome fantasia |
| | `Endereço` + `Nº` | Logradouro e número em campos separados |
| | `Cidade`, `UF`, `CEP` | |
| | `Fone` | |
| 2. Dados do Proprietário | `Razão Social` | |
| | `CNPJ` | Em AUR contém um CPF (ver §7) |
| | `Fone` | Pode ter 2 telefones |
| | `Cidade`, `UF` | |
| | `Endereço`, `Nº`, `CEP` | |
| 3. Dados da Empresa Executora | `Razão Social`, `CNPJ` | |
| | `Fone` | |
| | `Cidade`, `UF`, `Bairro` | Só esta seção e a 4 têm Bairro |
| | `Endereço`, `Nº`, `CEP` | |
| | `Registro CREA` | `138.869-5` |
| | `ART` | Preenchido só em DOK |
| 4. Dados do Responsável Técnico | `Título` | `Engenheiro Responsável` |
| | `Registro` | `138.869-5` (mesmo número do "Registro CREA" da empresa) |
| | `Cidade`, `UF`, `Bairro`, `Endereço`, `Nº`, `CEP` | Iguais aos da empresa |
| | `Fone`, `E-mail` | |
| | `Profissional` | Nome do RT |
| | `Assinado digitalmente IP:` | IP + imagem de assinatura manuscrita abaixo |

### 2.2 Valores encontrados

**Instalação / Proprietário**

| Campo | DOK | AUR | CSL | PBS |
|---|---|---|---|---|
| Cliente | Dokyo Japan Food | AURELIO | CLINICA SAO LUIZ | PORTO BELO ADMINISTRADORA DE SHOPPING CENTERS LTDA |
| Endereço instalação | Avenida Mauro Ramos, 1512 | Rua dos Tambaquis, 450 | Rua Paulino Pedro Hermes, 2427 | Rodovia BR 101, s/n. KM 159 (Nº vazio) |
| Cidade/UF | Florianópolis/SC | Florianópolis/SC | São José/SC | Porto Belo/SC |
| CEP | 88.020-30 | 88053-374 | 88110-694 | 88210000 |
| Fone instalação | (48) 3259-4000 | `null` | (48) 3346-0090 | `null` |
| Razão social proprietário | KANPAI GASTRONOMIA LTDA | AURELIO JOSE DA SILVA PORTELLA | CLINICA MEDICA SAO LUIZ LTDA | PORTO BELO ADMINISTRADORA DE SHOPPING CENTERS LTDA |
| CNPJ proprietário | 03.323.700/0001-05 | 552.014.239-49 | 05.961.696/0001-36 | 28.474.019/0001-9 |
| Fone proprietário | (48) 3259-4000 (48) 3259-4000 | null (11) 994054731 | (48) 3346-0090 | null |

**Empresa executora e RT (iguais nos 4, exceto ART)**

| Campo | Valor |
|---|---|
| Razão social / CNPJ | Thermo Service Sistemas de Climatização Ltda / 15.041.926/0001-00 |
| Endereço | Rua São Ludgéro, 1006, Barreiros, São José/SC, CEP 88.117-320 |
| Fone | (48) 3035-7355 |
| Registro CREA | 138.869-5 |
| ART | DOK: `BR12345678910`; AUR, CSL, PBS: vazio |
| RT – Título / Registro | Engenheiro Responsável / 138.869-5 |
| RT – Profissional / E-mail | Rafael Ramos / tecnico@thermoservice.srv.br |
| Assinatura | `Assinado digitalmente IP:104.28.47.70` + imagem de assinatura |

---

## 3. Inventário de equipamentos

### 3.1 Seção 5 — Listagem (resumo agrupado)

Formato de cada linha (inferido): `- {qtd} ({qtd por extenso}) {Tipo}, tipo {Grupo} [{Marca}][, capacidade {Capacidade} BTU]`

| PMOC | Linhas exatas |
|---|---|
| DOK | `1 (um) Fancoletes, tipo Built-in SPRINGER CARRIER, capacidade 18.000 BTU` |
| AUR | `2 (dois) VRF Condensador, tipo Condensadora LG` / `16 (dezesseis) VRF Evaporador, tipo BUILT - IN LG` |
| CSL | `8 (oito) Evaporador Monobloco, tipo Tipo Janela` / `4 (quatro) Split, tipo Hi-Wall` |
| PBS | `4 (quatro) Split, tipo Tipo Piso-Teto` / `14 (catorze) Split, tipo Hi-Wall` / `1 (um) Split, tipo Cassete` / `2 (dois) Splitão, tipo Fixo / Modular` / `3 (três) Ventilador, tipo Renovação de ar` |

Totais conferidos: quantidade da listagem = quantidade de fichas no Anexo 2 nos 4 PDFs (DOK 1, AUR 18, CSL 12, PBS 24).

### 3.2 Colunas do equipamento (vindas da Ficha Histórico)

| Campo | Rótulo no PDF | Exemplo | Preenchimento observado |
|---|---|---|---|
| Tipo | (sem rótulo, 1ª célula) | `Fancoletes`, `VRF Evaporador`, `Split` | 4/4 |
| Grupo (subtipo) | `Grupo:` | `Built-in`, `Hi-Wall`, `Tipo Janela` | 4/4 |
| Local | `Local:` | `Consultório 03`, `Cobertura (Cond. 01)` | DOK, AUR, CSL sim; **PBS vazio nos 24** |
| Marca | `Marca:` | `SPRINGER CARRIER`, `LG` | DOK, AUR; CSL e PBS vazios |
| Modelo | `Modelo:` | `42BBA018A510HDC` | Só DOK |
| Série | `Série:` | `1821B00535444` | Só DOK |
| Capacidade | `Capacidade:` | `18.000` (sem unidade na ficha; "BTU" na listagem) | Só DOK |

Não existe em nenhum PDF: código/TAG do equipamento, nº de patrimônio, fluido refrigerante, data de instalação, tensão nominal, área/ambiente atendido, nº de ocupantes, vínculo condensadora ↔ evaporadora.

### 3.3 Tipos e grupos encontrados

| Tipo | Grupos | PMOC |
|---|---|---|
| Fancoletes | Built-in | DOK |
| VRF Condensador | Condensadora | AUR |
| VRF Evaporador | BUILT - IN | AUR |
| Evaporador Monobloco | Tipo Janela | CSL |
| Split | Hi-Wall, Tipo Piso-Teto, Cassete | CSL, PBS |
| Splitão | Fixo / Modular | PBS |
| Ventilador | Renovação de ar | PBS |

---

## 4. Rotinas de manutenção por tipo de equipamento

Legenda: MM, MB, MT, MS, MA conforme §1.4 (confirmado em DEC-04).

### 4.1 Fancoletes (DOK)

| Atividade | Per. |
|---|---|
| Limpeza de filtros | MB |
| Limpeza geral | MB |
| Verificação de vazamento de ar e água | MB |
| Verificação da atuação da válvula de controle | MB |
| Verificação das conexões de força | MS |
| Verificação do funcionamento das partes móveis | MS |
| Verificação dos terminais elétricos | MS |
| Verificação dos estados dos eletrodutos | MS |
| Verificação dos focos de ferrugem ou problemas na mesma | MA |

### 4.2 VRF Condensador (AUR)

| Atividade | Per. |
|---|---|
| Verificação de ruídos e vibrações | MT |
| Verificação de vazamento de gás refrigerante | MT |
| Verificação da pintura do condensador | MT |
| Verificação da válvula de serviço | MT |
| Verificação da pintura da estrutura | MT |
| Verificação filtro secador | MT |
| Medição da capacidade do VRF | MT |
| Limpeza do quadro elétrico | MT |
| Medição das pressões de descarga, sucção | MT |
| Medição da tensão de entrada | MT |
| Medição da temperatura de liquido | MT |
| Verificação dos ventiladores dos condensadores | MT |
| Verificação dos contatos elétricos | MT |
| Verificação sequência de partida | MT |
| Medição corrente | MT |
| Medição da temperatura gás de descarga | MT |
| Verificação do isolamento de fechamento | MT |
| Medição da temperatura gás de sucção | MT |
| Verificação dos rolamentos do ventilador | MT |
| Verificação de pontos de ferrugem | MT |
| Limpeza geral | MT |
| Reaperto dos parafusos | MS |
| Limpeza das serpentinas dos condensadores | MA |

### 4.3 VRF Evaporador (AUR)

| Atividade | Per. |
|---|---|
| Limpeza exterior do gabinete | MT |
| Verificação do funcionamento da válvula de controle | MT |
| Verificação do dreno | MT |
| Limpeza do filtro de ar | MT |
| Tensão | MT |
| Verificação de vazamento nas conexões do equip. | MT |
| Testes do controlador de temperatura | MT |
| Testes geral de funcionamento | MT |
| Limpeza da serpentina com produto | MS |
| Limpeza dos ventiladores centrífugos | MA |
| Reaperto elétrico | MA |

### 4.4 Split e Evaporador Monobloco (mesma lista de 14 atividades)

A lista de atividades é **idêntica** para Split (CSL e PBS) e Evaporador Monobloco (CSL). A **periodicidade muda por cliente**:

| Atividade | Monobloco CSL | Split CSL | Split PBS |
|---|---|---|---|
| Tensão | MS | MS | MM |
| Corrente | MS | MS | MM |
| Limpeza exterior do gabinete | MS | MS | MM |
| Limpeza do filtro de ar da unidade evaporadora | MS | MS | MM |
| Verificação do funcionamento do compressor | MS | MS | MM |
| Testes geral de funcionamento | MS | MS | MM |
| Verificação do dreno | MS | MS | MT |
| Verificação de vazamento nas conexões do equip. | MS | MS | MT |
| Reaperto elétrico | MS | MS | MS |
| Limpeza evaporador com produto | MS | MS | MS |
| Verificação filtro secador | MA | MA | MA |
| Limpeza dos ventiladores centrífugos | MA | MA | MA |
| Verificação das peças do gabinete do condensador | MA | MA | MA |
| Limpeza condensador | MA | MA | MA |

> **Regra para o sistema (confirmada, DEC-07 e DEC-08):** a biblioteca de tipos e atividades é cadastrada pelo ADM e serve de padrão; a periodicidade de cada atividade é ajustável **por PMOC**. Só o ADM altera.

### 4.5 Splitão (PBS)

| Atividade | Per. |
|---|---|
| Testes de funcionamento | MM |
| Limpeza da bandeja, da mangueira e do ralo de condensado | MM |
| Verificação de tensão, alinhamento e estado das correias dos ventiladores | MM |
| Verificação do visor de líquido | MM |
| Aperto de todos os fusíveis e terminais | MM |
| Substituição do filtro de ar | MM |
| Teste dos controles de segurança | MT |
| Verificação de parafusos dos mancais de polias, com ajuste se necessário | MT |
| Verificação das peças do gabinete do condensador | MT |
| Medição da vazão de ar | MT |
| Limpeza dos evaporadores | MT |
| Além dos serviços de manutenção mensal | MT |
| Verificação das temperaturas de bulbo seco e umidade relativa na entrada e saída dos evaporadores | MT |
| Verificação de tensão e corrente | MT |
| Limpeza dos condensadores | MT |
| Limpeza do rotor e da voluta dos ventiladores | MS |
| Realização de teste de vazamento | MS |
| Reparos em isolamento térmicos e guarnições com defeitos | MS |
| Além dos serviços de manutenção mensal e trimestral | MS |
| Retoque em pintura se necessário | MS |

### 4.6 Ventilador — Renovação de ar (PBS)

| Atividade | Per. |
|---|---|
| Verificação da tensão/corrente | MM |
| Limpeza do ventilador | MB |
| Verificação de ruídos e vibrações | MB |
| Verificação da tensão e estado da correia | MT |
| Verificação dos terminais elétricos | MT |
| Verificação dos rolamentos | MT |
| Verificação de vazamento de ar nas conexões | MT |
| Verificação do relê de proteção | MT |
| Verificação das conexões de força | MS |
| Medição e conferência de vazão de ar | MS |
| Verificação dos estados dos eletrodutos | MS |
| Verificação dos focos de ferrugem | MA |

### 4.7 Em quais meses cada periodicidade cai (lido das fichas)

Mês 1 = primeiro mês da ficha (início da vigência).

| PMOC | MM | MB | MT | MS | MA |
|---|---|---|---|---|---|
| DOK | — | 1, 3, 5, 7, 9, 11 | — | 5, 11 | 11 |
| AUR | — | — | 1, 4, 7, 10 | 6, 12 | 12 |
| CSL | — | — | — | 1, 6, 12 | 12 |
| PBS | 1 a 12 | 2, 4, 6, 8, 10 | 3, 6, 9, 12 | 6, 12 | 12 |

> **Não há uma regra única nos PDFs antigos.** Ver §7, itens A1–A3.
> **Regra adotada no sistema novo (DEC-05):** tudo conta a partir do mês 1. Mensal 1–12; bimestral 1, 3, 5, 7, 9, 11; trimestral 1, 4, 7, 10; semestral 1, 7; anual 1.

### 4.8 Registros de execução encontrados

| PMOC | Situação nas fichas |
|---|---|
| DOK | Todas as ocorrências previstas com OK (Abr/25 a Fev/26) |
| AUR | OK em Set/25 e Dez/25 (itens MT). Ocorrências de Fev/26, Mar/26, Jun/26 e Ago/26 em branco, embora o PDF tenha sido gerado em 16/10/2026 (após o fim da vigência) |
| CSL | OK em Nov/25 e Abr/26 (itens MS). Out/26 em branco. Itens MA nunca registrados |
| PBS | Ago/26: 3 equipamentos com OK (Split piso-teto, Split hi-wall, Split cassete), 1 Splitão OK, 1 Ventilador OK; os outros 19 com NOK. Set/26 em branco (PDF gerado em 30/9/2026) |

---

## 5. Parâmetros de qualidade do ar

**Nenhum dos 4 PDFs contém parâmetros de qualidade do ar nem resultados de análise.** Não há:
- Seção de qualidade do ar, laudo laboratorial, pontos de coleta, valores medidos ou valores de referência.
- Referência à RE 09/2003 da Anvisa.

O que existe de relacionado:

| Onde | Conteúdo | Como é registrado |
|---|---|---|
| Anexo 1 (texto da Portaria 3523 transcrito no PDF) | Menciona renovação de ar "no mínimo de 27 m3/h/pessoa", filtro mínimo "classe G1" na captação de ar externo, e diz que padrões de qualidade do ar serão objeto de outro regulamento | Texto fixo, não é dado |
| Splitão (PBS) | "Verificação das temperaturas de bulbo seco e umidade relativa na entrada e saída dos evaporadores", "Medição da vazão de ar" | Só OK/NOK, **sem valor numérico** |
| Ventilador (PBS) | "Medição e conferência de vazão de ar" | Só OK/NOK |
| VRF Condensador (AUR) | Medições de pressão, temperatura, tensão, corrente, capacidade | Só OK/NOK |

**Decisão (DEC-13):** a empresa não realiza análise de qualidade do ar e essa parte **fica fora do PMOC e do sistema**. As medições de equipamento (tensão, corrente, pressões, temperaturas, vazão, UR) passam a ter valor numérico registrado pelo técnico (DEC-10).

---

## 6. Elementos que o sistema precisará gerar

### 6.1 Documento PMOC (PDF)

| Elemento | Origem do dado | Observação |
|---|---|---|
| Capa | Cliente, vigência, cidade da empresa, data de início | |
| Cabeçalho com logo e dados da empresa | Cadastro da empresa executora | Em todas as páginas exceto fichas |
| Seções 1 a 4 | Cadastro de cliente/instalação, proprietário, empresa, RT | |
| Assinatura do RT | Imagem de assinatura + IP | Ver DEC-16, DEC-23 (§8) e RF-13 (doc 00). A referência anterior "Q8" não existe neste documento |
| Seção 5 – Listagem | Agrupamento do inventário por Tipo + Grupo (+ Marca + Capacidade) | Quantidade em número e por extenso |
| Seção 6 – Cronograma | Plano de atividades por tipo de equipamento, com periodicidade | Uma tabela por tipo |
| Anexo 1 | Texto da Portaria MS 3523/1998 | Texto fixo. Hoje é transcrição com erros (§7, C4) |
| Anexo 2 – Ficha Histórico | Uma página por equipamento: calendário de 12 meses + OK/NOK/Ø | Gerado a partir do plano e dos registros de execução |
| Rodapé | Nº de página / total, data de geração | |

### 6.2 Cronogramas

- Calendário por equipamento × atividade (é o que alimenta a ficha).
- Regra de distribuição dos meses: a partir do mês 1 (DEC-05, ver §9.3).
- Período coberto pelo calendário: toda a duração do contrato (DEC-22, ver §9.3).

### 6.3 Assinaturas

| Quem | Existe nos PDFs? |
|---|---|
| Responsável técnico | Sim: imagem + "Assinado digitalmente IP:{ip}" |
| Cliente/proprietário | Não |
| Técnico executor | Não |
| Data/hora da assinatura | Não |

No sistema novo (DEC-16 e DEC-20): o PMOC é assinado com certificado ICP-Brasil (e-CPF) do RT e também pelo cliente; os relatórios de manutenção são assinados pelo cliente. Ver §9.7.

### 6.4 Anexos

| Anexo | Existe? |
|---|---|
| Anexo 1 – Portaria 3523 | Sim |
| Anexo 2 – Ficha Histórico | Sim |
| ART (documento) | Não, só o número no campo ART. **Decisão (DEC-15):** continua só o número, sem anexar o PDF |
| Laudo de qualidade do ar | Não. **Fora do escopo (DEC-13)** |
| Recomendações para falha e emergência | Não. **Será incluída (DEC-19)**; texto padrão ainda será escrito [A VALIDAR] |

### 6.5 Elementos de identidade visual

- Logo da empresa executora (imagem).
- Logo do software no rodapé (hoje Frigus). No sistema novo: logo do sistema novo (DEC-32).

---

## 7. Pontos ambíguos e dados que parecem faltar

### A. Ambiguidades de regra

| ID | Ponto | Evidência |
|---|---|---|
| A1 | Siglas MM/MB/MT/MS/MA não são definidas no documento | §1.4 |
| A2 | Distribuição dos meses não segue uma regra única: às vezes começa no mês 1 (DOK MB, AUR MT), às vezes termina no mês 12 (AUR MS/MA, PBS) | §4.7 |
| A3 | Contagens incoerentes com o nome da periodicidade: PBS MB ocorre 5× no ano (meses 2–10, não no 12); CSL MS ocorre 3× (meses 1, 6, 12); DOK MA cai no mês 11 | §4.7 |
| A4 | Célula em branco (prevista, sem registro) não está na legenda e não é tratada como NOK, mesmo após o mês passar | AUR, CSL, PBS |
| A5 | Vigência não tem duração padrão: DOK 13 meses (ficha cobre 12), AUR 11 meses (ficha cobre 12), CSL 11 meses, PBS ~11,5 meses | §0 |
| A6 | Mesma atividade pode aparecer em dois tipos com periodicidades diferentes por cliente (Split CSL × PBS) | §4.4 |
| A7 | "Além dos serviços de manutenção mensal" e "…mensal e trimestral" são tratados como atividades (com OK/NOK), mas são instruções de escopo | §4.5 |
| A8 | "Registro" do RT = "Registro CREA" da empresa (138.869-5). Não dá para saber se é registro da pessoa física ou da jurídica | §2.2 |
| A9 | Capacidade sem unidade na ficha; "BTU" na listagem (sem "/h") | §3.2 |
| A10 | Ordem das atividades dentro da ficha muda de um equipamento para outro do mesmo tipo | Fichas AUR e CSL |
| A11 | PDF de AUR foi gerado após o fim da vigência sem nenhum NOK nas ocorrências não registradas | §4.8 |

### B. Dados faltando ou inválidos nos cadastros

| ID | Problema | PMOC |
|---|---|---|
| B1 | `Fone:null` impresso literalmente | AUR, PBS |
| B2 | Campo "CNPJ" contém CPF (proprietário pessoa física) | AUR |
| B3 | CNPJ com 13 dígitos: `28.474.019/0001-9` | PBS |
| B4 | CEP com 7 dígitos: `88.020-30` | DOK |
| B5 | CEP sem máscara: `88210000`; demais com máscaras diferentes | PBS |
| B6 | Endereço sem número (`Nº:` vazio, "s/n" dentro do logradouro) | PBS |
| B7 | Telefone duplicado: `(48) 3259-4000 (48) 3259-4000` | DOK |
| B8 | ART vazia | AUR, CSL, PBS |
| B9 | ART com valor que parece fictício: `BR12345678910` | DOK |
| B10 | Local vazio em todos os 24 equipamentos | PBS |
| B11 | Marca, modelo, série e capacidade vazios | AUR (modelo/série/capacidade), CSL e PBS (todos) |
| B12 | Texto duplicado na listagem: "tipo Tipo Janela", "tipo Tipo Piso-Teto" | CSL, PBS |
| B13 | Concordância: "1 (um) Fancoletes" | DOK |

### C. Problemas de conteúdo do Anexo 1

| ID | Problema |
|---|---|
| C1 | O Art. 2º aparece repetido dentro do Art. 6º |
| C2 | "a. a." no Art. 5º |
| C3 | O texto cita "Anexo I" e "Anexo II" da Portaria, que não estão no PDF |
| C4 | Fidelidade da transcrição ao texto oficial: [A VALIDAR] |

### D. Informações que um PMOC normalmente precisaria e não aparecem

Itens que o **próprio Anexo 1 transcrito** cita como conteúdo do PMOC ("descrição das atividades", "periodicidade", "recomendações a serem adotadas em situações de falha do equipamento e de emergência"):

| ID | Falta |
|---|---|
| D1 | Descrição/procedimento de cada atividade (só há o título) |
| D2 | Data e técnico de cada execução (só mês e OK/NOK) |
| D3 | Recomendações para falha e emergência |
| D4 | Valores medidos (tensão, corrente, pressões, temperaturas, vazão, UR) |
| D5 | Qualidade do ar (§5) |
| D6 | Capacidade total do sistema (o Anexo 1 cita o limite de 5 TR / 60.000 BTU/h para exigir RT) |
| D7 | Identificador único do equipamento |
| D8 | Histórico de revisões do documento (DOK é "R1" só no nome do arquivo) |
| D9 | Ciência/assinatura do cliente |
| D10 | Ações corretivas quando há NOK |

---

## 8. Decisões do usuário (respostas às perguntas)

| ID | Tema | Decisão |
|---|---|---|
| DEC-01 | Escopo | O sistema substitui o Frigus. O layout do PMOC pode ser melhorado (não precisa reproduzir o Frigus). |
| DEC-02 | Código do documento | O código `TH` identifica a proposta comercial (ex.: `TH12326`). `R{n}` é a revisão (ex.: `R1`). Os dois são **cadastrados manualmente** e **devem aparecer no PMOC**. O prefixo `CTR-` não será usado. |
| DEC-03 | Locais | Um cliente pode ter vários locais, mas é **um contrato por local**. |
| DEC-04 | Siglas | MM = mensal, MB = bimestral, MT = trimestral, MS = semestral, MA = anual. |
| DEC-05 | Meses do cronograma | Opção a: todas as periodicidades contam a partir do mês 1. |
| DEC-06 | Vigência | A vigência é do **contrato** e varia por contrato. O PMOC não tem validade própria. Na renovação, cria-se um **PMOC novo**; o anterior fica como histórico. |
| DEC-07 | Quem altera periodicidade | Apenas o **ADM**. O RT **não tem acesso** ao sistema. |
| DEC-08 | Tipos de equipamento | Existem mais tipos que os dos PDFs. Tipos (e suas atividades) podem ser criados, editados e excluídos. |
| DEC-09 | Registro da manutenção | O **técnico** registra a manutenção realizada: equipamentos, atividades, fotos etc. Ao final, o sistema gera um **relatório da manutenção por IA**. |
| DEC-10 | Medições | Itens de medição registram **valor numérico**. **Não** há faixa de aceitação. |
| DEC-11 | NOK e corretiva | **Emendada em 27/10/2026 (AF-13; decisões F1 e R2 1.3).** `OK` = a manutenção preventiva foi executada. `NOK` = a atividade **não foi efetuada**, e o técnico deve registrar uma **observação**. Se a atividade foi executada e o técnico achou um problema, ele marca `OK` com "requer corretiva" e descreve o problema na observação. A manutenção corretiva **não é gerada no sistema**: o relatório aponta a necessidade, e o cliente decide se faz, quando e com quem. (Texto anterior: "NOK e corretiva: o técnico deve registrar uma observação", lido como se NOK apontasse defeito.) |
| DEC-12 | Ocorrência não registrada | Fica **pendente de registro**. O ADM decide se foi esquecimento do técnico (lança o registro) ou se é NOK. É necessário um **painel do ADM** para editar manutenções manualmente (técnico que não lançou no app, cliente que não assinou o relatório etc.). |
| DEC-13 | Qualidade do ar | A empresa não realiza. **Não entra no PMOC nem no sistema.** |
| DEC-14 | RT | Há **apenas um RT**. |
| DEC-15 | ART | Um número de ART por PMOC. **Não** é preciso anexar o PDF da ART. |
| DEC-16 | Assinatura do PMOC | Certificado digital **ICP-Brasil (e-CPF)**, mais as informações do RT obrigatórias no PMOC. O PMOC também é assinado pelo cliente. |
| DEC-17 | Proprietário | **Não** pode ser pessoa física (somente CNPJ). Obrigatórios: os campos sem os quais o PMOC não pode ser feito (CNPJ, razão social, endereço etc.). |
| DEC-18 | Campos do equipamento | Obrigatórios: os essenciais para o fluxo continuar. A **TAG é gerada pelo sistema** seguindo um padrão. |
| DEC-19 | Textos do documento | Manter a Portaria (Anexo 1) e incluir uma seção de recomendações para falha e emergência. O texto padrão ainda será escrito, e isso não afeta o funcionamento do sistema. |
| DEC-20 | Cliente no sistema | O cliente pode **visualizar e baixar** o PMOC e os relatórios, e **assinar** os relatórios e o PMOC. |
| DEC-21 | Código TH | **Opcional.** Cadastrado manualmente quando existir; sem ele, o PMOC é emitido normalmente e nada é impresso no lugar. A revisão (`R{n}`) também é opcional e manual. |
| DEC-22 | Período do cronograma | A ficha histórico cobre **toda a duração do contrato**, não só 12 meses. |
| DEC-23 | Assinatura do RT | O RT não acessa o sistema. A assinatura dele é **padrão e automática** (certificado e-CPF ICP-Brasil guardado no sistema pelo ADM e aplicado na geração do PMOC). |
| DEC-24 | Assinatura do cliente | **Assinatura eletrônica simples** (aceite com identificação do usuário, data, hora e IP), tanto para o PMOC quanto para os relatórios. |
| DEC-25 | Pendente | Uma ocorrência prevista passa a Pendente no **dia seguinte** ao fim do mês previsto. |
| DEC-26 | Obrigatórios e TAG | A lista de obrigatórios da §9.5 está aprovada. TAG no padrão `{código do local}-{sigla do tipo}-{nº sequencial}` (ex.: `L012-SPL-003`) está aprovada. |
| DEC-27 | Procedimento das atividades | Só o **título** da atividade, como hoje. |
| DEC-28 | ART | O PMOC **não é emitido sem número de ART** (interpretação da resposta "não"; ver §10, P1). |
| DEC-29 | Registro do RT | O RT é pessoa física e também dono da empresa. Dados do RT e da empresa aparecem **em campos separados**, e o número do RT fica sempre cadastrado no sistema. |
| DEC-30 | Unidade das medições | O ADM define a **unidade** de cada atividade de medição ao cadastrá-la. |
| DEC-31 | Relatório por IA | Vai **direto para assinatura** do cliente, sem revisão do ADM antes. |
| DEC-32 | Logo do rodapé | Logo do **sistema novo**. |

### 8.1 O que mudou em relação à análise dos PDFs

| Item da análise | Antes (PDFs Frigus) | Agora (decisão) |
|---|---|---|
| §1.4 / A1 Siglas | Não definidas | Definidas (DEC-04) |
| §4.7 / A2–A3 Meses | Sem regra única | A partir do mês 1 (DEC-05) |
| §4.4 / A6 Periodicidade | Variava por cliente sem regra declarada | Padrão por tipo, ajustável por PMOC, só pelo ADM (DEC-07, DEC-08) |
| A4 / A11 Célula em branco | Ficava em branco para sempre | Estado **Pendente**, resolvido pelo ADM (DEC-12) |
| A5 Vigência | Datas inconsistentes no PMOC | Datas do **contrato**; PMOC novo a cada renovação (DEC-06) |
| A8 Registro do RT | Ambíguo (empresa × pessoa) | Um único RT; pessoa e empresa aparecem em campos separados (DEC-29) |
| B2 Proprietário com CPF | Aceito | Proibido (DEC-17) |
| B8–B9 ART | Vazia ou fictícia | Número por PMOC, obrigatório (DEC-15, DEC-28) |
| B10–B11 Equipamento sem local/marca | Aceito | Obrigatórios definidos em §9.5; TAG gerada (DEC-18) |
| §5 / D5 Qualidade do ar | Ausente | Fora do escopo (DEC-13) |
| D1 Procedimento das atividades | Só título | Continua só o título (DEC-27) |
| D2 Data e técnico da execução | Só mês | Registrados pelo técnico a cada visita (DEC-09) |
| D3 Falha e emergência | Ausente | Seção incluída, texto [A VALIDAR] (DEC-19) |
| D4 Valores medidos | Só OK/NOK | Valor numérico (DEC-10) |
| D7 Identificador do equipamento | Ausente | TAG gerada pelo sistema (DEC-18) |
| D8 Revisões | Só no nome do arquivo | Código TH + revisão cadastrados e impressos (DEC-02) |
| D9 Assinatura do cliente | Ausente | Cliente assina PMOC e relatórios (DEC-16, DEC-20) |
| D10 Ações corretivas | Ausente | Fora do sistema; o relatório aponta a necessidade (DEC-11) |
| C1–C3 Erros no texto da Portaria | Presentes | Corrigir no texto padrão; fidelidade ao texto oficial continua [A VALIDAR] (C4) |

---

## 9. Regras derivadas para o sistema

### 9.1 Perfis de usuário

| Perfil | Acesso | Pode |
|---|---|---|
| ADM (empresa de manutenção) | Sim | Cadastrar clientes, locais, contratos, equipamentos, tipos, atividades e periodicidades; gerar PMOC; corrigir manutenções no painel; resolver pendências |
| Técnico | Sim (app) | Registrar manutenções: atividades OK/NOK, valores medidos, observações, fotos |
| Cliente | Sim | Visualizar e baixar PMOC e relatórios; assinar PMOC e relatórios |
| RT | **Não** | Aparece no PMOC e Assina o PMOC por assinatura automática com e-CPF cadastrado pelo ADM (DEC-23) |

### 9.2 Entidades e cardinalidade

| Regra | Origem |
|---|---|
| Cliente (CNPJ) 1 → N Locais | DEC-03 |
| Local 1 → 1 Contrato vigente | DEC-03 |
| Local 1 → N Contratos ao longo do tempo (um vigente; os anteriores ficam como histórico). Contrato 1 → 1 PMOC, com versões (decisão A4 a de 21/10/2026; doc 02 D-02, RN-001). A linha original dizia "Contrato 1 → N PMOCs" | DEC-06 |
| PMOC 1 → N Equipamentos (do local) | PDFs |
| Tipo de equipamento 1 → N Atividades padrão (cada uma com periodicidade padrão) | DEC-08 |
| PMOC × Atividade → periodicidade efetiva (pode sobrescrever o padrão) | DEC-07 |
| Empresa executora 1 → 1 RT | DEC-14 |

### 9.3 Cronograma

1. Periodicidades permitidas: `MM`, `MB`, `MT`, `MS`, `MA` (DEC-04).
2. Mês 1 = mês de calendário da data de início do contrato (DEC-05, DEC-06). O calendário cobre **toda a duração do contrato** (DEC-22).
3. Uma atividade de periodicidade com intervalo `k` meses (MM=1, MB=2, MT=3, MS=6, MA=12) é prevista nos meses `1, 1+k, 1+2k, …` enquanto o mês estiver dentro da duração do contrato. Exemplo: semestral prevista nos meses 1, 7, 13, …; anual nos meses 1, 13, …. Na ficha histórico, os meses são exibidos em blocos de 12 colunas por página quando o contrato passa de 12 meses (layout proposto).
4. Só o ADM altera a periodicidade. A alteração vale para o PMOC em que foi feita.

### 9.4 Estados de uma ocorrência (atividade × equipamento × mês)

| Estado | Quando | Quem define |
|---|---|---|
| Não prevista (Ø) | Mês fora da periodicidade | Sistema |
| Prevista | Mês previsto, ainda não chegou ao fim | Sistema |
| Pendente | Mês previsto, sem registro do técnico. Passa a Pendente **no dia seguinte ao fim do mês previsto** (DEC-25) | Sistema |
| OK | Técnico registrou como executada, ou ADM corrigiu | Técnico / ADM |
| NOK | Técnico registrou como não executada (com observação), ou ADM decidiu que é NOK | Técnico / ADM |

Regras:
- Pendente **nunca** vira NOK automaticamente (DEC-12).
- NOK exige observação (DEC-11).
- Toda alteração feita pelo ADM no painel deve ficar registrada (quem, quando, valor anterior) (inferido; necessário para rastrear correções de DEC-12).

### 9.5 Cadastro: campos obrigatórios

Critério do usuário: obrigatório é o que impede o PMOC ou o fluxo de seguir (DEC-17, DEC-18). Lista confirmada (DEC-26):

| Entidade | Obrigatórios propostos |
|---|---|
| Cliente/Proprietário | Razão social, CNPJ válido, endereço completo (logradouro, nº ou "s/n", cidade, UF, CEP) |
| Local (instalação) | Nome, endereço completo |
| Contrato | Data de início, data de fim, nº ART. **Código TH e revisão são opcionais** (DEC-21) |
| Equipamento | Tipo, grupo, local/ambiente; TAG gerada pelo sistema |
| Empresa executora e RT | Todos os campos da §2.1 |

Validações: CNPJ com dígito verificador; CEP com 8 dígitos; não imprimir `null` (campo vazio fica em branco ou não é impresso).

### 9.6 Visita e relatório de manutenção

1. O técnico registra, por equipamento: estado de cada atividade prevista (OK/NOK), valores numéricos dos itens de medição, observações e fotos (DEC-09, DEC-10, DEC-11).
2. Ao final da visita, o sistema gera o relatório da manutenção **por IA** (DEC-09).
3. O relatório aponta necessidades de manutenção corretiva; a corretiva em si não é registrada no sistema (DEC-11).
4. O cliente assina o relatório (DEC-20). Se não assinar, o ADM pode tratar pelo painel (DEC-12).

### 9.7 Documento PMOC (sistema novo)

| Elemento | Regra |
|---|---|
| Identificação | Imprimir código TH e revisão (ex.: `TH12326-R1`) **somente se informados** (DEC-02, DEC-21). Posição proposta: capa e rodapé |
| Vigência | Datas do contrato (DEC-06) |
| Seções 1–4 | Como nos PDFs, sem `null` e com dados validados |
| Seção 5 – Listagem | Mantida; incluir TAG por equipamento (DEC-18, DEC-26) |
| Seção 6 – Cronograma | Mantida, com regra da §9.3 |
| Recomendações para falha e emergência | Nova seção; texto padrão [A VALIDAR] (DEC-19) |
| Anexo 1 – Portaria 3523 | Mantido, com erros C1–C3 corrigidos (DEC-19) |
| Anexo 2 – Ficha Histórico | Mantida, com o estado Pendente além de OK/NOK/Ø (DEC-12) |
| Qualidade do ar | Não incluir (DEC-13) |
| Assinaturas | RT: assinatura automática com e-CPF ICP-Brasil (DEC-23). Cliente: assinatura eletrônica simples (DEC-24) |

---

## 10. Pendências pequenas (não bloqueiam o PRD)

Nenhuma pergunta estrutural ficou em aberto. Itens abaixo podem ser revisados mais adiante:

| ID | Pendência | Tipo |
|---|---|---|
| P1 | Confirmar a leitura de DEC-28: "ART obrigatória para emitir o PMOC". A resposta dada foi "não" à pergunta "pode emitir sem ART?" | Confirmação rápida |
| P2 | Texto padrão da seção de recomendações para falha e emergência **[A VALIDAR]** (será escrito pelo usuário; DEC-19) | Conteúdo |
| P3 | Fidelidade do texto da Portaria 3523 ao oficial e correção dos erros C1 a C3 **[A VALIDAR]** | Conteúdo |
| P4 | Assinatura automática do RT (DEC-23): tecnicamente só funciona com e-CPF **A1** (arquivo + senha). Certificado em token ou cartão (A3) não permite assinar sozinho. Confirmar qual tipo o RT usa. Se for A3, a alternativa é o RT assinar fora do sistema e o ADM subir o PDF **[A VALIDAR]** | Técnico, tratar na etapa de arquitetura |
| P5 | Texto do aceite da assinatura eletrônica simples do cliente (DEC-24) | Conteúdo |
| P6 | Modelo (prompt) e estrutura do relatório gerado por IA (DEC-09, DEC-31) | Próxima etapa |
| P7 | Valores de periodicidade padrão por tipo de equipamento novo (DEC-08): o ADM define ao cadastrar | Operação |
