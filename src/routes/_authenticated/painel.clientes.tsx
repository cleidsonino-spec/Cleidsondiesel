import { createFileRoute, redirect } from "@tanstack/react-router";
import { RegistryPage } from "@/components/painel/registry-page";
import { customersQuery, vehiclesQuery } from "@/lib/registry";
import { warrantiesQuery } from "@/lib/warranty";
export const Route = createFileRoute("/_authenticated/painel/clientes")({
  head: () => ({ meta: [{ title: "Clientes — Cleidson Diesel" }, { name: "description", content: "Cadastro de clientes da oficina Cleidson Diesel." }, { property: "og:title", content: "Clientes — Cleidson Diesel" }, { property: "og:description", content: "Clientes e contatos da oficina." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  loader: async ({ context }) => { await Promise.all([context.queryClient.ensureQueryData(customersQuery()), context.queryClient.ensureQueryData(vehiclesQuery()), context.queryClient.ensureQueryData(warrantiesQuery())]); },
  beforeLoad: ({ context }) => {
    if (!context.isAdmin && !context.isSecretaria) throw redirect({ to: "/painel" });
  },
  component: () => <RegistryPage mode="customers" />,
});