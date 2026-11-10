import { createFileRoute } from "@tanstack/react-router";
import { RegistryPage } from "@/components/painel/registry-page";
import { customersQuery, vehiclesQuery } from "@/lib/registry";
export const Route = createFileRoute("/_authenticated/painel/veiculos")({
  head: () => ({ meta: [{ title: "Veículos — Cleidson Diesel" }, { name: "description", content: "Cadastro de veículos e proprietários da Cleidson Diesel." }, { property: "og:title", content: "Veículos — Cleidson Diesel" }, { property: "og:description", content: "Veículos atendidos pela oficina." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  loader: async ({ context }) => { await Promise.all([context.queryClient.ensureQueryData(customersQuery()), context.queryClient.ensureQueryData(vehiclesQuery())]); },
  component: () => <RegistryPage mode="vehicles" />,
});