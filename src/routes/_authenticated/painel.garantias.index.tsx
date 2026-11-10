import { createFileRoute } from "@tanstack/react-router";
import { WarrantyList } from "./painel.garantias";
import { warrantiesQuery } from "@/lib/warranty";
export const Route = createFileRoute("/_authenticated/painel/garantias/")({
  head: () => ({ meta: [{ title: "Garantias — Cleidson Diesel" }, { name: "description", content: "Emissão e acompanhamento de garantias da Cleidson Diesel." }, { property: "og:title", content: "Garantias — Cleidson Diesel" }, { property: "og:description", content: "Prazos e certificados de garantia dos serviços." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(warrantiesQuery()),
  component: WarrantyList,
});