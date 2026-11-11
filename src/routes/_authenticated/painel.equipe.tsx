import { useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LockKeyhole, ShieldCheck, UserPlus, UserRound, UserX } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/painel/equipe")({
  beforeLoad: ({ context }) => {
    if (!context.isAdmin) throw redirect({ to: "/painel" });
  },
  component: StaffManagementPage,
});

type StaffMember = {
  id: string;
  username: string;
  full_name: string;
  role: "secretaria" | "mecanico";
  status: "active" | "blocked" | "removed";
  created_at: string;
};

type Action = "list" | "create" | "block" | "unblock" | "remove";

async function staffAction(action: Action, payload: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("manage-staff", {
    body: { action, ...payload },
  });
  if (error) throw new Error("Não foi possível conectar ao gerenciamento seguro de funcionários.");
  if (data?.error) {
    const messages: Record<string, string> = {
      USERNAME_TAKEN: "Esse nome de usuário já está em uso.",
      INVALID_USERNAME: "Use de 3 a 32 caracteres: letras, números, ponto, hífen ou sublinhado.",
      WEAK_PASSWORD: "A senha precisa ter pelo menos 12 caracteres.",
      CANNOT_MANAGE_SELF: "Não é permitido alterar a própria conta por esta tela.",
      ADMIN_REQUIRED: "Somente o administrador pode gerenciar funcionários.",
    };
    throw new Error(messages[data.error] ?? "A operação não foi concluída. Tente novamente.");
  }
  return data;
}

function StaffManagementPage() {
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"secretaria" | "mecanico">("mecanico");

  const staffQuery = useQuery({
    queryKey: ["staff-management"],
    queryFn: async () => {
      const data = await staffAction("list");
      return (data.staff ?? []) as StaffMember[];
    },
  });

  const mutation = useMutation({
    mutationFn: ({ action, member, values }: {
      action: Action;
      member?: StaffMember;
      values?: Record<string, unknown>;
    }) => staffAction(action, { ...(member ? { user_id: member.id } : {}), ...values }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["staff-management"] });
      await queryClient.invalidateQueries({ queryKey: ["staff-mechanics"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível concluir a operação."),
  });

  async function createStaff(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.mutate({
      action: "create",
      values: { full_name: fullName, username, password, role },
    }, {
      onSuccess: () => {
        toast.success("Funcionário cadastrado com segurança.");
        setFullName("");
        setUsername("");
        setPassword("");
        setRole("mecanico");
      },
    });
  }

  function manage(member: StaffMember, action: "block" | "unblock" | "remove") {
    const message = action === "block"
      ? `Bloquear o acesso de ${member.full_name} durante as férias/afastamento?`
      : action === "unblock"
        ? `Reativar o acesso de ${member.full_name}?`
        : `Excluir ${member.full_name} da equipe? O acesso será encerrado e o nome de usuário liberado. O histórico técnico e as ordens de serviço serão preservados.`;
    if (!window.confirm(message)) return;
    mutation.mutate({ action, member }, {
      onSuccess: () => toast.success(
        action === "block" ? "Conta bloqueada. O histórico foi preservado."
          : action === "unblock" ? "Conta reativada."
            : "Funcionário removido da equipe. O histórico foi preservado.",
      ),
    });
  }

  const members = staffQuery.data ?? [];
  const active = members.filter((member) => member.status === "active");
  const blocked = members.filter((member) => member.status === "blocked");

  return (
    <div className="space-y-7">
      <div>
        <p className="text-sm text-muted-foreground">Acesso administrativo</p>
        <h1 className="text-3xl">Gerenciar equipe</h1>
        <p className="mt-1 text-sm text-muted-foreground">Cadastre usuários individuais, bloqueie acessos temporariamente ou remova funcionários.</p>
      </div>

      <section className="rounded-md border border-border bg-card p-4 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <UserPlus className="size-5 text-primary" />
          <h2 className="text-lg font-semibold">Cadastrar funcionário</h2>
        </div>
        <form onSubmit={createStaff} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="staff-name">Nome completo</Label>
            <Input id="staff-name" value={fullName} onChange={(event) => setFullName(event.target.value)} minLength={2} maxLength={100} autoComplete="name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="staff-username">Nome de usuário</Label>
            <Input id="staff-username" value={username} onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))} minLength={3} maxLength={32} autoComplete="off" autoCapitalize="none" spellCheck={false} required />
            <p className="text-xs text-muted-foreground">3 a 32 caracteres. O funcionário não precisa de e-mail.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="staff-password">Senha inicial</Label>
            <Input id="staff-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={12} maxLength={128} autoComplete="new-password" required />
            <p className="text-xs text-muted-foreground">Mínimo de 12 caracteres. Entregue a senha diretamente ao funcionário.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="staff-role">Função</Label>
            <select id="staff-role" value={role} onChange={(event) => setRole(event.target.value as "secretaria" | "mecanico")} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="mecanico">Mecânico</option>
              <option value="secretaria">Secretária</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={mutation.isPending}>
              <UserPlus className="size-4" /> {mutation.isPending ? "Processando..." : "Cadastrar funcionário"}
            </Button>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div><h2 className="text-xl font-semibold">Funcionários cadastrados</h2><p className="text-sm text-muted-foreground">{active.length} ativo(s) · {blocked.length} bloqueado(s)</p></div>
          <Button variant="outline" size="sm" onClick={() => void staffQuery.refetch()} disabled={staffQuery.isFetching}>Atualizar lista</Button>
        </div>
        {staffQuery.isLoading ? <p className="py-8 text-center text-sm text-muted-foreground">Carregando equipe...</p>
          : staffQuery.isError ? <p role="alert" className="rounded-md border border-destructive/30 p-4 text-sm text-destructive">{staffQuery.error.message}</p>
            : members.length === 0 ? <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Nenhum funcionário cadastrado ainda.</div>
              : <div className="divide-y divide-border overflow-hidden rounded-md border border-border bg-card">
                {members.map((member) => <article key={member.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="rounded-full bg-secondary p-2"><UserRound className="size-5" /></div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{member.full_name}</p>
                      <p className="text-sm text-muted-foreground">@{member.username ? `@${member.username}` : "Usuário liberado"} · {member.role === "mecanico" ? "Mecânico" : "Secretária"}</p>
                      <p className={`mt-1 flex items-center gap-1 text-xs ${member.status === "active" ? "text-success" : member.status === "blocked" ? "text-warning" : "text-muted-foreground"}`}>
                        {member.status === "active" ? <ShieldCheck className="size-3" /> : <LockKeyhole className="size-3" />}
                        {member.status === "active" ? "Ativo" : member.status === "blocked" ? "Bloqueado" : "Removido"}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    {member.status === "active" && <Button type="button" size="sm" variant="outline" onClick={() => manage(member, "block")} disabled={mutation.isPending}><LockKeyhole className="size-4" /> Bloquear</Button>}
                    {member.status === "blocked" && <Button type="button" size="sm" onClick={() => manage(member, "unblock")} disabled={mutation.isPending}><ShieldCheck className="size-4" /> Reativar</Button>}
                    {member.status !== "removed" && <Button type="button" size="sm" variant="destructive" onClick={() => manage(member, "remove")} disabled={mutation.isPending}><UserX className="size-4" /> Excluir</Button>}
                  </div>
                </article>)}
              </div>}
      </section>

      <div className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        <strong className="text-foreground">Sobre a exclusão:</strong> para preservar a integridade das ordens de serviço e dos registros técnicos, a remoção encerra e bloqueia a conta, retira as permissões e libera o nome de usuário. O vínculo histórico permanece guardado e não permite novo acesso.
      </div>
    </div>
  );
}
