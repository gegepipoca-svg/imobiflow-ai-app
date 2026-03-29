import { useContext } from "react";
import { AuthContext } from "@/features/auth/components/AuthProvider";
import type { AuthContextType } from "@/features/auth/components/AuthProvider";

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }
  return context;
}
