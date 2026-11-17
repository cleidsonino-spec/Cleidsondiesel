import { createFileRoute } from '@tanstack/react-router';
import { toast } from 'sonner';
import { TechnicalCatalogBrowser } from '@/components/painel/technical-catalog-browser';
import { technicalCatalogQuery } from '@/lib/technical-queries';
import { addPartToMaterialList } from '@/lib/material-lists';
export const Route = createFileRoute('/_authenticated/painel/central-tecnica')({
  head: () => ({meta:[
    {title:'Central Técnica — Cleidson Diesel'},
    {name:'description',content:'Catálogo interno de bombas, referências, aplicações e figuras documentadas da Cleidson Diesel.'},
    {property:'og:title',content:'Central Técnica — Cleidson Diesel'},
    {property:'og:description',content:'Consulta técnica interna por código, fabricante e família.'},
    {property:'og:type',content:'website'}, {name:'twitter:card',content:'summary'}, {name:'robots',content:'noindex'},
  ]}),
  loader: async ({context}) => {await context.queryClient.ensureQueryData(technicalCatalogQuery(context.user.id));},
  component: Page,
});
function Page() {const {user,isAdmin,isSecretary}=Route.useRouteContext();return <TechnicalCatalogBrowser userId={user.id} isAdmin={isAdmin} onAddToMaterialList={async (part,quantity,pumpCode)=>{try{await addPartToMaterialList(part,pumpCode,quantity);toast.success('Peça salva na lista de materiais.');}catch(error){toast.error(error instanceof Error?error.message:'Não foi possível adicionar a peça.');}}}/>;}
