import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/shared/components/PageHeader";
import { RestartTourButton } from "@/shared/components/GuidedTour";
import {
  LayoutDashboard,
  FileText,
  Users,
  Settings,
  CreditCard,
  Calculator,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  ArrowRight,
  FileBarChart,
  UserPlus,
} from "lucide-react";

interface FaqItem {
  question: string;
  answer: string;
}

function FaqSection({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div
          key={index}
          className="rounded-lg border bg-card"
        >
          <button
            className="flex w-full items-center justify-between p-4 text-left font-medium hover:bg-muted/50 transition-colors"
            onClick={() => setOpenIndex(openIndex === index ? null : index)}
          >
            <span>{item.question}</span>
            {openIndex === index ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
          </button>
          {openIndex === index && (
            <div className="border-t px-4 py-3 text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {item.answer}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function StepGuide({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-3 my-4">
      {steps.map((step, i) => (
        <li key={i} className="flex items-start gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
            {i + 1}
          </span>
          <span className="text-sm leading-relaxed pt-0.5">{step}</span>
        </li>
      ))}
    </ol>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-accent/30 border border-accent p-4 my-4">
      <Lightbulb className="h-5 w-5 shrink-0 text-accent-foreground mt-0.5" />
      <p className="text-sm leading-relaxed">{children}</p>
    </div>
  );
}

export default function HelpPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <PageHeader
          title="Central de Ajuda"
          description="Guias, tutoriais e perguntas frequentes sobre o ComissãoPro"
        />
        <RestartTourButton />
      </div>

      {/* Quick Start */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5 text-primary" />
            Primeiros Passos
          </CardTitle>
          <CardDescription>
            Siga esta ordem para configurar o sistema pela primeira vez
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StepGuide
            steps={[
              "Cadastre os Participantes (consultores, parceiros, escritorios) no menu Participantes",
              "Crie as Regras de Comissao no menu Regras de Comissao (ex: 15% para imoveis, 10% para autos)",
              "Registre uma Operacao no menu Operacoes, vinculando participantes, regra de comissao e o nome do cliente",
              "Acompanhe as comissoes geradas no Dashboard",
              "Quando o cliente pagar, marque como 'Pago' na pagina da operacao — isso libera a comissao do consultor",
              "Registre pagamentos no menu Pagamentos conforme forem realizados",
              "Use Relatorios para filtrar e exportar comissoes em CSV",
            ]}
          />
          <Tip>
            Use o menu Simulacao para testar cenarios antes de criar operacoes reais.
          </Tip>
        </CardContent>
      </Card>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="dashboard" className="gap-1.5">
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="operations" className="gap-1.5">
            <FileText className="h-4 w-4" />
            Operacoes
          </TabsTrigger>
          <TabsTrigger value="participants" className="gap-1.5">
            <Users className="h-4 w-4" />
            Participantes
          </TabsTrigger>
          <TabsTrigger value="rules" className="gap-1.5">
            <Settings className="h-4 w-4" />
            Regras
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-1.5">
            <CreditCard className="h-4 w-4" />
            Pagamentos
          </TabsTrigger>
          <TabsTrigger value="simulation" className="gap-1.5">
            <Calculator className="h-4 w-4" />
            Simulacao
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-1.5">
            <FileBarChart className="h-4 w-4" />
            Relatorios
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5">
            <UserPlus className="h-4 w-4" />
            Usuarios
          </TabsTrigger>
          <TabsTrigger value="faq" className="gap-1.5">
            <HelpCircle className="h-4 w-4" />
            FAQ
          </TabsTrigger>
        </TabsList>

        {/* DASHBOARD */}
        <TabsContent value="dashboard">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LayoutDashboard className="h-5 w-5" />
                Dashboard
              </CardTitle>
              <CardDescription>
                Visao geral de todas as comissoes e operacoes do sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <h4 className="font-semibold">Indicadores (KPIs)</h4>
              <p className="text-sm text-muted-foreground">
                Na parte superior voce encontra 5 cards com os principais indicadores:
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-lg border p-3">
                  <p className="font-medium text-sm">Total de Credito</p>
                  <p className="text-xs text-muted-foreground">Soma de todos os valores de credito das operacoes</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="font-medium text-sm">Comissao Gerada</p>
                  <p className="text-xs text-muted-foreground">Total de comissao calculada em todas as operacoes</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="font-medium text-sm">Comissao Paga</p>
                  <p className="text-xs text-muted-foreground">Quanto ja foi efetivamente pago aos participantes</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="font-medium text-sm">Comissao Pendente</p>
                  <p className="text-xs text-muted-foreground">Valor que ainda precisa ser pago</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="font-medium text-sm">Passivo Futuro</p>
                  <p className="text-xs text-muted-foreground">Projecao de pagamentos futuros baseado em parcelas pendentes</p>
                </div>
              </div>

              <Separator />

              <h4 className="font-semibold">Graficos</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                  <span><strong>Comissao por Participante:</strong> Grafico de barras mostrando quanto cada participante tem de comissao total</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                  <span><strong>Comissao por Tipo de Produto:</strong> Grafico de pizza dividido por Imovel, Automovel, Servico e Outros</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                  <span><strong>Evolucao Mensal:</strong> Grafico de linha comparando comissoes geradas vs pagas mes a mes</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        {/* OPERACOES */}
        <TabsContent value="operations">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Operacoes
              </CardTitle>
              <CardDescription>
                Cada operacao representa uma venda/transacao com calculo automatico de comissoes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <h4 className="font-semibold">Como criar uma operacao</h4>
              <StepGuide
                steps={[
                  "Clique em '+ Nova Operacao' na pagina de Operacoes",
                  "Preencha o codigo (gerado automaticamente), data e tipo de produto (Imovel, Automovel, Servico ou Outros)",
                  "Selecione uma Regra de Comissao — ela preenche automaticamente o percentual e as parcelas",
                  "Informe o Valor do Credito — a comissao total e calculada em tempo real",
                  "Preencha o Nome do Cliente vinculado a esta operacao",
                  "Adicione os Participantes com seus percentuais de participacao (devem somar 100%)",
                  "Confira o Preview da Comissao com a matriz de distribuicao antes de salvar",
                  "Clique em 'Criar Operacao'",
                ]}
              />

              <Separator />

              <h4 className="font-semibold">Controle de pagamento do cliente</h4>
              <p className="text-sm text-muted-foreground">
                Cada operacao pode ter um cliente vinculado. Na lista de operacoes, voce ve o nome do cliente e se ele ja pagou ou esta pendente. Na pagina de detalhes da operacao, use o botao para alternar entre "Pago" e "Pendente".
              </p>
              <ul className="space-y-1 text-sm text-muted-foreground mt-2">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 mt-0.5" />
                  <span><strong>Pago:</strong> O cliente pagou — a comissao do consultor pode ser liberada</span>
                </li>
                <li className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                  <span><strong>Pendente:</strong> Aguardando pagamento do cliente — comissao em aberto</span>
                </li>
              </ul>

              <Separator />

              <h4 className="font-semibold">Status das operacoes</h4>
              <div className="flex flex-wrap gap-2 my-2">
                <Badge variant="outline">Rascunho</Badge>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <Badge className="bg-blue-500 text-white">Ativa</Badge>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <Badge className="bg-green-500 text-white">Concluida</Badge>
              </div>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li><strong>Rascunho:</strong> Pode ser editada ou excluida. Nao gera comissoes.</li>
                <li><strong>Ativa:</strong> Comissoes estao sendo distribuidas. Pode ser concluida ou cancelada.</li>
                <li><strong>Concluida:</strong> Operacao finalizada. Pode ser estornada se necessario.</li>
                <li><strong>Cancelada:</strong> Operacao cancelada. Status final.</li>
                <li><strong>Estornada:</strong> Operacao revertida. Status final.</li>
              </ul>

              <Tip>
                So operacoes em "Rascunho" podem ser editadas ou excluidas. Apos ativar, use a mudanca de status na pagina de detalhes.
              </Tip>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PARTICIPANTES */}
        <TabsContent value="participants">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Participantes
              </CardTitle>
              <CardDescription>
                Gerencie consultores, parceiros, escritorios e intermediarios
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <h4 className="font-semibold">Tipos de participante</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <Badge className="mb-2">Consultor</Badge>
                  <p className="text-xs text-muted-foreground">Vendedor direto que realiza a operacao. Geralmente recebe a maior parte da comissao.</p>
                </div>
                <div className="rounded-lg border p-3">
                  <Badge className="mb-2" variant="secondary">Parceiro</Badge>
                  <p className="text-xs text-muted-foreground">Parceiro comercial que indica ou apoia na venda.</p>
                </div>
                <div className="rounded-lg border p-3">
                  <Badge className="mb-2" variant="outline">Escritorio</Badge>
                  <p className="text-xs text-muted-foreground">Escritorio ou imobiliaria que gerencia os consultores.</p>
                </div>
                <div className="rounded-lg border p-3">
                  <Badge className="mb-2" variant="outline">Intermediario</Badge>
                  <p className="text-xs text-muted-foreground">Pessoa ou empresa que facilita a conexao entre partes.</p>
                </div>
              </div>

              <Separator />

              <h4 className="font-semibold">Como cadastrar</h4>
              <StepGuide
                steps={[
                  "Clique em '+ Novo Participante'",
                  "Preencha Nome (obrigatorio) e Tipo",
                  "Opcionalmente adicione Documento (CPF/CNPJ), E-mail e Telefone",
                  "Clique em 'Criar Participante'",
                ]}
              />

              <Tip>
                Voce pode definir hierarquia entre participantes usando o campo "Participante Pai" na edicao. Isso permite organizar consultores dentro de escritorios.
              </Tip>
            </CardContent>
          </Card>
        </TabsContent>

        {/* REGRAS DE COMISSAO */}
        <TabsContent value="rules">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Regras de Comissao
              </CardTitle>
              <CardDescription>
                Defina modelos de comissao por tipo de produto com parcelas configuráveis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <h4 className="font-semibold">O que e uma regra de comissao?</h4>
              <p className="text-sm text-muted-foreground">
                Uma regra define o percentual de comissao e como ela sera dividida em parcelas. Por exemplo: "15% do valor do credito, dividido em 3 parcelas de 5% cada".
              </p>

              <Separator />

              <h4 className="font-semibold">Como criar uma regra</h4>
              <StepGuide
                steps={[
                  "Clique em '+ Nova Regra'",
                  "De um nome descritivo (ex: 'Comissao Padrao Imovel 15%')",
                  "Selecione o Tipo de Produto (Imovel, Automovel, Servico ou Outros)",
                  "Defina o Modelo de Comissao em percentual (ex: 15%)",
                  "Configure as Parcelas — cada parcela define um percentual do credito",
                  "O total das parcelas deve ser no maximo 100% do credito",
                  "Clique em 'Criar Regra'",
                ]}
              />

              <div className="flex items-start gap-3 rounded-lg bg-destructive/10 border border-destructive/20 p-4 my-4">
                <AlertCircle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
                <p className="text-sm leading-relaxed">
                  <strong>Atencao:</strong> Se o total das parcelas ultrapassar 100%, o sistema exibira um aviso em vermelho. Ajuste os percentuais antes de salvar.
                </p>
              </div>

              <Tip>
                Ao criar uma operacao, voce pode selecionar uma regra existente e ela preenchera automaticamente o percentual de comissao e as parcelas.
              </Tip>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PAGAMENTOS */}
        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Pagamentos
              </CardTitle>
              <CardDescription>
                Registre e acompanhe pagamentos de comissoes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <h4 className="font-semibold">Duas abas</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <p className="font-medium text-sm">Distribuicoes</p>
                  <p className="text-xs text-muted-foreground">
                    Lista todas as distribuicoes de comissao pendentes, parciais e pagas.
                    Aqui voce registra novos pagamentos clicando em "Registrar".
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="font-medium text-sm">Historico de Pagamentos</p>
                  <p className="text-xs text-muted-foreground">
                    Registro completo de todos os pagamentos ja realizados, com data, valor, metodo e referencia.
                  </p>
                </div>
              </div>

              <Separator />

              <h4 className="font-semibold">Como registrar um pagamento</h4>
              <StepGuide
                steps={[
                  "Va na aba 'Distribuicoes'",
                  "Encontre a distribuicao pendente (use o filtro por status se necessario)",
                  "Clique no botao 'Registrar' ao lado da distribuicao",
                  "Informe o valor (pode ser parcial), data, metodo de pagamento (PIX, Transferencia, Dinheiro, Cheque)",
                  "Opcionalmente adicione uma referencia e notas",
                  "Clique em 'Registrar Pagamento'",
                ]}
              />

              <h4 className="font-semibold">Status das distribuicoes</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li><Badge variant="outline" className="mr-2">Pendente</Badge> Nenhum pagamento realizado ainda</li>
                <li><Badge variant="outline" className="mr-2 border-amber-500 text-amber-600">Parcial</Badge> Pagamento parcial registrado</li>
                <li><Badge variant="outline" className="mr-2 border-green-500 text-green-600">Pago</Badge> Valor total ja foi pago</li>
                <li><Badge variant="outline" className="mr-2 border-orange-500 text-orange-600">Estornado</Badge> Pagamento foi revertido</li>
              </ul>

              <Tip>
                Voce pode fazer pagamentos parciais! O sistema calcula automaticamente o saldo restante e atualiza o status para "Parcial".
              </Tip>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SIMULACAO */}
        <TabsContent value="simulation">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Simulacao
              </CardTitle>
              <CardDescription>
                Teste cenarios de comissao antes de criar operacoes reais
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <h4 className="font-semibold">Para que serve?</h4>
              <p className="text-sm text-muted-foreground">
                A simulacao permite testar diferentes cenarios de comissao sem criar uma operacao real.
                Ideal para mostrar ao cliente ou parceiro quanto cada um receberia em uma operacao hipotetica.
              </p>

              <Separator />

              <h4 className="font-semibold">Como usar</h4>
              <StepGuide
                steps={[
                  "Informe o valor do credito e o percentual de comissao (ou carregue uma regra existente)",
                  "Adicione os participantes com seus nomes e percentuais de participacao",
                  "Configure as parcelas com os percentuais do credito",
                  "Clique em 'Simular' para ver a distribuicao completa",
                  "Use 'Iniciar Comparacao' para comparar dois cenarios lado a lado",
                ]}
              />

              <Tip>
                A simulacao nao salva dados no sistema. Voce pode testar a vontade sem afetar nada!
              </Tip>
            </CardContent>
          </Card>
        </TabsContent>

        {/* RELATORIOS */}
        <TabsContent value="reports">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileBarChart className="h-5 w-5" />
                Relatorios
              </CardTitle>
              <CardDescription>
                Filtre, visualize e exporte dados de comissoes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <h4 className="font-semibold">Filtros disponiveis</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <p className="font-medium text-sm">Busca por texto</p>
                  <p className="text-xs text-muted-foreground">Pesquise por nome do participante, codigo da operacao ou notas</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="font-medium text-sm">Por consultor</p>
                  <p className="text-xs text-muted-foreground">Selecione um participante especifico (somente admin)</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="font-medium text-sm">Por status</p>
                  <p className="text-xs text-muted-foreground">Pendente, Parcial, Pago ou Estornado</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="font-medium text-sm">Por periodo</p>
                  <p className="text-xs text-muted-foreground">Data inicial e final para filtrar por vencimento</p>
                </div>
              </div>

              <Separator />

              <h4 className="font-semibold">Exportar CSV</h4>
              <p className="text-sm text-muted-foreground">
                Clique no botao "Exportar CSV" para baixar os dados filtrados. O arquivo abre direto no Excel com formatacao brasileira (separador ponto-e-virgula, valores em Real, encoding UTF-8).
              </p>

              <Tip>
                O consultor ve apenas seu proprio relatorio. O administrador pode filtrar por qualquer participante.
              </Tip>
            </CardContent>
          </Card>
        </TabsContent>

        {/* USUARIOS */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Gerenciar Usuarios
              </CardTitle>
              <CardDescription>
                Crie contas para consultores acessarem o sistema (somente admin)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <h4 className="font-semibold">Como criar um usuario</h4>
              <StepGuide
                steps={[
                  "Va no menu 'Gerenciar Usuarios'",
                  "Clique em '+ Novo Usuario'",
                  "Preencha o nome completo e e-mail do consultor",
                  "Defina uma senha (ou use a gerada automaticamente)",
                  "Selecione a funcao: Admin ou Consultor",
                  "Clique em 'Criar Usuario'",
                  "Copie as credenciais clicando em 'Copiar para WhatsApp' e envie ao consultor",
                ]}
              />

              <Separator />

              <h4 className="font-semibold">Funcoes</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                  <span><strong>Administrador:</strong> Acesso total ao sistema — cria operacoes, gerencia participantes, regras, pagamentos, relatorios e usuarios</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                  <span><strong>Consultor:</strong> Ve apenas suas proprias operacoes, comissoes e relatorio. Ideal para o consultor acompanhar o que tem a receber</span>
                </li>
              </ul>

              <Tip>
                O consultor e vinculado automaticamente ao participante pelo e-mail. Certifique-se de que o e-mail do usuario seja o mesmo cadastrado no participante.
              </Tip>
            </CardContent>
          </Card>
        </TabsContent>

        {/* FAQ */}
        <TabsContent value="faq">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5" />
                Perguntas Frequentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FaqSection
                items={[
                  {
                    question: "Como funciona o calculo de comissao?",
                    answer: "A comissao e calculada assim:\n\n1. O Valor do Credito e multiplicado pelo Modelo de Comissao (%). Ex: R$ 200.000 x 15% = R$ 30.000 de comissao total.\n\n2. Esse valor e dividido entre os participantes conforme seus percentuais de participacao. Ex: Consultor 60% = R$ 18.000, Escritorio 40% = R$ 12.000.\n\n3. O pagamento pode ser parcelado conforme as parcelas definidas na regra de comissao.",
                  },
                  {
                    question: "Os percentuais dos participantes precisam somar 100%?",
                    answer: "Sim! Ao criar uma operacao, os percentuais de participacao de todos os participantes devem somar exatamente 100%. O sistema mostra um indicador visual em tempo real — verde quando esta correto, amarelo quando esta incompleto.",
                  },
                  {
                    question: "Posso editar uma operacao depois de criada?",
                    answer: "Somente operacoes com status 'Rascunho' podem ser editadas ou excluidas. Apos mudar o status para 'Ativa', a operacao fica bloqueada para edicao. Se precisar corrigir algo, voce pode estornar a operacao e criar uma nova.",
                  },
                  {
                    question: "O que acontece quando cancelo ou estorno uma operacao?",
                    answer: "Cancelar ou estornar uma operacao sao acoes finais — nao e possivel reverter. As comissoes vinculadas deixam de estar ativas, mas o historico de pagamentos ja realizados e mantido para referencia.",
                  },
                  {
                    question: "Posso fazer pagamentos parciais?",
                    answer: "Sim! Ao registrar um pagamento, voce pode informar qualquer valor ate o saldo restante. O sistema atualiza automaticamente o status da distribuicao para 'Parcial' e calcula quanto ainda falta pagar.",
                  },
                  {
                    question: "Como vejo quanto ja paguei para um participante?",
                    answer: "Existem duas formas:\n\n1. No Dashboard, o grafico 'Comissao por Participante' mostra os totais.\n\n2. No menu Pagamentos, aba 'Historico de Pagamentos', voce pode buscar pelo nome do participante e ver todos os pagamentos realizados.",
                  },
                  {
                    question: "Qual a diferenca entre Consultor, Parceiro, Escritorio e Intermediario?",
                    answer: "Sao categorias para organizar os participantes:\n\n- Consultor: Vendedor direto que realiza a operacao\n- Parceiro: Parceiro comercial que indica ou apoia\n- Escritorio: Empresa/imobiliaria que gerencia consultores\n- Intermediario: Facilitador entre as partes\n\nVoce pode usar a hierarquia (Participante Pai) para organizar consultores dentro de escritorios.",
                  },
                  {
                    question: "Para que serve o campo 'Nome do Cliente' na operacao?",
                    answer: "O campo 'Nome do Cliente' vincula a operacao ao cliente final. Na lista de operacoes, voce ve o nome do cliente e se ele ja pagou ou nao. Na pagina de detalhes, voce pode marcar o cliente como 'Pago' ou 'Pendente'. Quando o cliente paga, isso indica que a comissao do consultor pode ser liberada.",
                  },
                  {
                    question: "Como marco que o cliente pagou?",
                    answer: "Abra a operacao clicando em 'Ver'. No card 'Dados do Cliente', clique no botao 'Marcar como Pago'. Para reverter, clique em 'Marcar como Pendente'. O status aparece na lista de operacoes como badge verde (Pago) ou amarelo (Pendente).",
                  },
                  {
                    question: "Como exportar dados do sistema?",
                    answer: "Va no menu Relatorios. La voce pode filtrar por consultor, periodo, status de pagamento e texto livre. Depois de aplicar os filtros, clique no botao 'Exportar CSV' para baixar o relatorio. O arquivo abre direto no Excel com formatacao brasileira (separador ponto-e-virgula, valores em Real).",
                  },
                  {
                    question: "Quem pode acessar o sistema?",
                    answer: "O acesso e controlado por duas funcoes:\n\n- Administrador: Acesso total — operacoes, participantes, regras, pagamentos, relatorios, gerenciamento de usuarios e configuracoes.\n\n- Consultor: Acesso limitado — ve apenas suas proprias operacoes, comissoes e relatorio. Nao pode criar operacoes nem gerenciar participantes.\n\nO administrador cria contas de consultor no menu 'Gerenciar Usuarios' e envia as credenciais por WhatsApp.",
                  },
                  {
                    question: "Como crio uma conta para um consultor?",
                    answer: "Va no menu 'Gerenciar Usuarios' (disponivel apenas para administradores). Clique em '+ Novo Usuario', preencha o nome, e-mail e senha, selecione a funcao 'Consultor' e clique em 'Criar'. O sistema mostra as credenciais com um botao 'Copiar para WhatsApp' para enviar facilmente ao consultor.",
                  },
                  {
                    question: "Como altero minha senha?",
                    answer: "Va em Configuracoes (ultimo item do menu lateral), aba 'Perfil', e clique em 'Alterar Senha'. Digite a nova senha duas vezes e clique em 'Salvar Senha'.",
                  },
                ]}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
