import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowRight,
  ArrowLeft,
  X,
  Sparkles,
  LayoutDashboard,
  FileText,
  Users,
  Settings,
  CreditCard,
  Calculator,
  HelpCircle,
} from "lucide-react";

const TOUR_STORAGE_KEY = "comissaopro_tour_completed";

interface TourStep {
  title: string;
  description: string;
  icon: React.ReactNode;
  route: string;
  highlight?: string;
}

const tourSteps: TourStep[] = [
  {
    title: "Bem-vindo ao ComissaoPro!",
    description:
      "Este tour vai te mostrar as principais funcionalidades do sistema. Leva menos de 2 minutos. Vamos la?",
    icon: <Sparkles className="h-6 w-6" />,
    route: "/",
  },
  {
    title: "Dashboard",
    description:
      "Aqui voce tem a visao geral de tudo: total de creditos, comissoes geradas, pagas e pendentes. Os graficos mostram a distribuicao por participante, tipo de produto e evolucao mensal.",
    icon: <LayoutDashboard className="h-6 w-6" />,
    route: "/",
  },
  {
    title: "Participantes",
    description:
      "Cadastre consultores, parceiros, escritorios e intermediarios. Cada pessoa que recebe comissao precisa estar aqui. Voce pode organizar hierarquias (ex: consultor dentro de um escritorio).",
    icon: <Users className="h-6 w-6" />,
    route: "/participants",
  },
  {
    title: "Regras de Comissao",
    description:
      "Defina modelos de comissao por tipo de produto. Ex: 'Imovel 15% em 3 parcelas'. Ao criar uma operacao, basta selecionar a regra e tudo e preenchido automaticamente.",
    icon: <Settings className="h-6 w-6" />,
    route: "/commission-rules",
  },
  {
    title: "Operacoes",
    description:
      "Cada venda/transacao e uma operacao. Voce informa o valor do credito, seleciona a regra de comissao, adiciona os participantes com seus percentuais, e o sistema calcula tudo automaticamente.",
    icon: <FileText className="h-6 w-6" />,
    route: "/operations",
  },
  {
    title: "Pagamentos",
    description:
      "Aqui voce registra os pagamentos de comissao. Na aba 'Distribuicoes' veja o que esta pendente e registre pagamentos (pode ser parcial). Na aba 'Historico' veja tudo que ja foi pago.",
    icon: <CreditCard className="h-6 w-6" />,
    route: "/payments",
  },
  {
    title: "Simulacao",
    description:
      "Teste cenarios antes de criar operacoes reais. Informe valores e participantes hipoteticos para ver como ficaria a distribuicao de comissoes. Nada e salvo — e so para testar!",
    icon: <Calculator className="h-6 w-6" />,
    route: "/simulation",
  },
  {
    title: "Central de Ajuda",
    description:
      "Sempre que tiver duvida, acesse a Central de Ajuda no menu lateral. La tem guias detalhados de cada modulo e perguntas frequentes. Bom trabalho!",
    icon: <HelpCircle className="h-6 w-6" />,
    route: "/help",
  },
];

export function GuidedTour() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const completed = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!completed && location.pathname !== "/login") {
      const timer = setTimeout(() => setIsOpen(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [location.pathname]);

  const step = tourSteps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === tourSteps.length - 1;

  const goToStep = useCallback(
    (index: number) => {
      setCurrentStep(index);
      const targetRoute = tourSteps[index].route;
      if (location.pathname !== targetRoute) {
        navigate(targetRoute);
      }
    },
    [navigate, location.pathname]
  );

  const handleNext = () => {
    if (isLast) {
      handleClose();
    } else {
      goToStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirst) {
      goToStep(currentStep - 1);
    }
  };

  const handleClose = () => {
    localStorage.setItem(TOUR_STORAGE_KEY, "true");
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm" />

      {/* Tour Card */}
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <Card className="w-full max-w-lg shadow-2xl animate-in fade-in-0 zoom-in-95">
          <CardHeader className="relative pb-3">
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute right-4 top-4"
              onClick={handleClose}
            >
              <X className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                {step.icon}
              </div>
              <div>
                <CardTitle className="text-lg">{step.title}</CardTitle>
                <CardDescription>
                  Passo {currentStep + 1} de {tourSteps.length}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {step.description}
            </p>

            {/* Progress dots */}
            <div className="flex justify-center gap-1.5">
              {tourSteps.map((_, i) => (
                <button
                  key={i}
                  className={`h-2 rounded-full transition-all ${
                    i === currentStep
                      ? "w-6 bg-primary"
                      : i < currentStep
                      ? "w-2 bg-primary/40"
                      : "w-2 bg-muted-foreground/20"
                  }`}
                  onClick={() => goToStep(i)}
                />
              ))}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="text-muted-foreground"
              >
                Pular tour
              </Button>
              <div className="flex gap-2">
                {!isFirst && (
                  <Button variant="outline" size="sm" onClick={handlePrev}>
                    <ArrowLeft className="mr-1 h-4 w-4" />
                    Anterior
                  </Button>
                )}
                <Button size="sm" onClick={handleNext}>
                  {isLast ? (
                    "Concluir"
                  ) : (
                    <>
                      Proximo
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

/** Button to restart the tour manually */
export function RestartTourButton() {
  const handleRestart = () => {
    localStorage.removeItem(TOUR_STORAGE_KEY);
    window.location.reload();
  };

  return (
    <Button variant="outline" size="sm" onClick={handleRestart} className="gap-2">
      <Sparkles className="h-4 w-4" />
      Refazer tour guiado
    </Button>
  );
}
