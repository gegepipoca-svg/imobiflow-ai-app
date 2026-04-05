import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "@/app/layout/Sidebar";
import { Header } from "@/app/layout/Header";
import { GuidedTour } from "@/shared/components/GuidedTour";
import { useAuth } from "@/features/auth/hooks/useAuth";

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { profile, signOut } = useAuth();

  const user = {
    name: profile?.name ?? "Usuário",
    role: profile?.role ?? "agent",
    email: profile?.email ?? "",
  };

  return (
    <div className="min-h-screen bg-background">
      <GuidedTour />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content area offset by sidebar width on desktop */}
      <div className="lg:pl-64">
        <Header
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          user={user}
          onSignOut={signOut}
        />
        <main className="p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
