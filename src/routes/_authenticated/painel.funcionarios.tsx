import { createFileRoute, redirect } from "@tanstack/react-router";
import { Users } from "lucide-react";

import { StaffInvitations } from "@/components/painel/staff-invitations";
import { StaffManagement } from "@/components/painel/staff-management";

export const Route = createFileRoute("/_authenticated/painel/funcionarios")({
  beforeLoad: ({ context }) => {
    if (!context.isAdmin) throw redirect({ to: "/painel" });
  },
  component: StaffRegistryPage,
});

function StaffRegistryPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Cadastros</p>
        <h1 className="flex items-center gap-2 text-2xl font-semibold"><Users className="size-6" /> Funcionários</h1>
        <p className="mt-1 text-sm text-muted-foreground">Convide funcionários e gerencie os acessos cadastrados na oficina.</p>
      </div>
      <StaffInvitations />
      <StaffManagement />
    </div>
  );
}
