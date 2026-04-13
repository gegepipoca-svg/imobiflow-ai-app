import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  Users,
  Settings,
  CreditCard,
  Calculator,
  Settings2,
  HelpCircle,
  UserPlus,
  FileBarChart,
  X,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/hooks/useAuth";
import type { AppRole } from "@/features/auth/components/AuthProvider";

interface NavItem {
  label: string;
  icon: typeof LayoutDashboard;
  to: string;
  roles: AppRole[];
}

const navItems: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/", roles: ["admin", "consultor"] },
  { label: "Minhas Operações", icon: FileText, to: "/operations", roles: ["consultor"] },
  { label: "Operações", icon: FileText, to: "/operations", roles: ["admin"] },
  { label: "Participantes", icon: Users, to: "/participants", roles: ["admin"] },
  { label: "Regras de Comissão", icon: Settings, to: "/commission-rules", roles: ["admin"] },
  { label: "Minhas Comissões", icon: CreditCard, to: "/payments", roles: ["consultor"] },
  { label: "Pagamentos", icon: CreditCard, to: "/payments", roles: ["admin"] },
  { label: "Meu Relatório", icon: FileBarChart, to: "/reports", roles: ["consultor"] },
  { label: "Relatórios", icon: FileBarChart, to: "/reports", roles: ["admin"] },
  { label: "Simulação", icon: Calculator, to: "/simulation", roles: ["admin", "consultor"] },
  { label: "Gerenciar Usuários", icon: UserPlus, to: "/users", roles: ["admin"] },
  { label: "Configurações", icon: Settings2, to: "/settings", roles: ["admin"] },
  { label: "Ajuda", icon: HelpCircle, to: "/help", roles: ["admin", "consultor"] },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { profile, signOut } = useAuth();
  const userRole = profile?.role ?? "consultor";

  const visibleItems = navItems.filter((item) => item.roles.includes(userRole));

  return (
    <>
      {/* Overlay mobile */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-200 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand */}
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-6">
          <span className="text-xl font-bold tracking-tight text-sidebar-primary">ComissãoPro</span>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-sidebar-foreground hover:bg-sidebar-accent lg:hidden"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )
              }
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-sidebar-border px-3 py-4 space-y-3">
          {profile && (
            <div className="px-3">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {profile.full_name || "Usuário"}
              </p>
              <p className="text-xs text-sidebar-foreground/50 truncate">
                {profile.email}
              </p>
            </div>
          )}
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            <span>Sair</span>
          </button>
          <p className="px-3 text-xs text-sidebar-foreground/50">
            ComissãoPro v1.0
          </p>
        </div>
      </aside>
    </>
  );
}
