import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { ClipboardCheck, CarFront } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/painel/recebimento")({
 head:()=>({meta:[{title:"Recebimento de veículos — Cleidson Diesel"},{name:"robots",content:"noindex"}]}),
 component:VehicleIntakePage,
});
type Order={id:string;number:number;customer_name:string;plate:string;vehicle:string;mileage:string|null;status:string};
type Intake={id:string;service_order_id:string;received_at:string;received_by:string;received_by_name:string;delivered_by_name:string;delivery_confirmed:boolean;delivery_confirmed_at:string|null;delivery_consent_text:string|null;odometer:string;fuel_level:string;exterior_condition:string;existing_damage:string|null;accessories:string|null;notes:string|null;photo_urls:string[]};
const inputClass="w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
function VehicleIntakePage(){
 const {isAdmin,isSecretary}=Route.useRouteContext();const qc=useQueryClient();
 const [orderId,setOrderId]=useState("");const [deliveredBy,setDeliveredBy]=useState("");const [receivedByName,setReceivedByName]=useState("");const [deliveryConfirmed,setDeliveryConfirmed]=useState(false);const [odometer,setOdometer]=useState("");const [fuel,setFuel]=useState("nao_informado");const [condition,setCondition]=useState("");const [damage,setDamage]=useState("");const [accessories,setAccessories]=useState("");const [notes,setNotes]=useState("");const [photos,setPhotos]=useState("");const [saving,setSaving]=useState(false);
  useEffect(()=>{let active=true;supabase.auth.getUser().then(({data})=>{if(!active)return;const metadata=data.user?.user_metadata??{};setReceivedByName(String(metadata.full_name??metadata.name??"").trim());});return()=>{active=false;};},[]);
 const query=useQuery({queryKey:["vehicle-intake"],enabled:isAdmin||isSecretary,queryFn:async()=>{
  const [o,i]=await Promise.all([
   supabase.from("service_orders").select("id,number,customer_name,plate,vehicle,mileage,status").neq("status","cancelado").order("number",{ascending:false}).limit(500),
   (supabase as any).from("vehicle_intake_records").select("*").order("received_at",{ascending:false}).limit(500),
  ]);
  if(o.error)throw o.error;if(i.error)throw i.error;
  return {orders:o.data as Order[],records:i.data as Intake[]};
 }});
 if(!isAdmin&&!isSecretary)return <section className="rounded-md border p-6"><h1 className="text-xl font-semibold">Acesso restrito</h1><p className="mt-2 text-sm text-muted-foreground">Somente administração e secretaria podem registrar recebimentos.</p></section>;
 const orders=query.data?.orders??[];const records=query.data?.records??[];const pending=orders.filter(o=>!records.some(r=>r.service_order_id===o.id));
 const selected=orders.find(o=>o.id===orderId);
 async function save(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!selected){toast.error("Selecione uma ordem de serviço.");return;}
  if(deliveredBy.trim().length<2){toast.error("Informe o nome de quem entregou o veículo.");return;}
  if(!receivedByName.trim()){toast.error("Informe o nome de quem recebeu o veículo. Confira seu nome antes de registrar.");return;}
  if(!deliveryConfirmed){toast.error("A pessoa que entregou precisa confirmar o registro.");return;}
  if(!odometer.trim()||condition.trim().length<2){toast.error("Informe hodômetro/horímetro e condição externa.");return;}
  const photoUrls=photos.split(/\n/).map(v=>v.trim()).filter(Boolean);
  if(photoUrls.some(v=>!/^https?:\/\/\S+$/i.test(v))){toast.error("Cada fotografia deve ter um endereço HTTPS ou HTTP válido.");return;}
  setSaving(true);const {data:user}=await supabase.auth.getUser();
  const consentText="Confirmo que entreguei o veículo à oficina e que as informações desta ficha registram as condições informadas e observadas no recebimento.";
  const {error}=await (supabase as any).from("vehicle_intake_records").insert({
   service_order_id:selected.id,received_by:user.user?.id,received_by_name:receivedByName.trim(),delivered_by_name:deliveredBy.trim(),delivery_confirmed:deliveryConfirmed,delivery_consent_text:consentText,odometer:odometer.trim(),fuel_level:fuel,
   exterior_condition:condition.trim(),existing_damage:damage.trim()||null,accessories:accessories.trim()||null,
   notes:notes.trim()||null,photo_urls:photoUrls,
  });
  setSaving(false);if(error){toast.error(error.message);return;}
  toast.success("Recebimento registrado com confirmação de entrega.");setOrderId("");setDeliveredBy("");setDeliveryConfirmed(false);setOdometer("");setFuel("nao_informado");setCondition("");setDamage("");setAccessories("");setNotes("");setPhotos("");
  await qc.invalidateQueries({queryKey:["vehicle-intake"]});
 }
 return <div className="space-y-6">
  <header><p className="text-sm text-muted-foreground">Entrada na oficina</p><h1 className="flex items-center gap-2 text-3xl"><ClipboardCheck className="text-primary"/>Recebimento de veículos</h1><p className="mt-1 text-sm text-muted-foreground">Registre as condições do veículo no momento da entrega à oficina. O registro fica vinculado à OS e não pode ser apagado pela interface.</p></header>
  {query.isLoading?<p className="rounded-md border p-5 text-sm">Carregando ordens…</p>:query.isError?<p className="rounded-md border border-destructive/40 p-5 text-sm">{query.error instanceof Error?query.error.message:"Falha ao carregar ordens."}</p>:<>
   <div className="grid gap-3 sm:grid-cols-2"><Summary label="Aguardando recebimento" value={pending.length}/><Summary label="Recebimentos registrados" value={records.length}/></div>
   <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.8fr)]">
    <form onSubmit={save} className="space-y-4 rounded-md border bg-card p-5">
     <h2 className="font-semibold">Novo registro de recebimento</h2>
     <div className="space-y-2"><Label htmlFor="intake-order">Ordem de serviço</Label><select id="intake-order" required className={inputClass} value={orderId} onChange={e=>{setOrderId(e.target.value);const o=orders.find(x=>x.id===e.target.value);setOdometer(o?.mileage??"");}}><option value="">Selecione a OS</option>{pending.map(o=><option key={o.id} value={o.id}>OS {o.number} · {o.customer_name} · {o.plate} · {o.vehicle}</option>)}</select></div>
     {selected&&<div className="rounded-md bg-muted p-3 text-sm"><p className="font-medium"><CarFront className="mr-1 inline size-4"/>{selected.plate} · {selected.vehicle}</p><p className="text-muted-foreground">{selected.customer_name} · OS {selected.number}</p></div>}
     <div className="space-y-2"><Label htmlFor="intake-received-by">Nome de quem recebeu o veículo *</Label><Input id="intake-received-by" required minLength={2} maxLength={160} value={receivedByName} onChange={e=>setReceivedByName(e.target.value)} placeholder="Nome do funcionário que está registrando a entrada"/></div>
     <div className="space-y-2"><Label htmlFor="intake-delivered-by">Nome de quem entregou o veículo *</Label><Input id="intake-delivered-by" required minLength={2} maxLength={160} value={deliveredBy} onChange={e=>setDeliveredBy(e.target.value)} placeholder="Nome completo da pessoa que trouxe o veículo"/></div>
     <div className="flex items-start gap-2 rounded-md border p-3"><input id="intake-delivery-confirmed" type="checkbox" checked={deliveryConfirmed} onChange={e=>setDeliveryConfirmed(e.target.checked)} className="mt-1 size-4"/><Label htmlFor="intake-delivery-confirmed" className="text-sm leading-5">Confirmo que entreguei o veículo à oficina e que as informações desta ficha registram as condições informadas e observadas no recebimento. *</Label></div>
     <div className="space-y-2"><Label htmlFor="intake-odometer">Hodômetro / horímetro *</Label><Input id="intake-odometer" required maxLength={40} value={odometer} onChange={e=>setOdometer(e.target.value)} placeholder="Ex.: 125.430 km ou 2.350 h"/></div>
     <div className="space-y-2"><Label htmlFor="intake-fuel">Nível de combustível *</Label><select id="intake-fuel" required className={inputClass} value={fuel} onChange={e=>setFuel(e.target.value)}><option value="nao_informado">Não informado</option><option value="vazio">Vazio</option><option value="1/4">1/4</option><option value="1/2">1/2</option><option value="3/4">3/4</option><option value="cheio">Cheio</option></select></div>
     <div className="space-y-2"><Label htmlFor="intake-condition">Condição externa geral *</Label><Textarea id="intake-condition" required minLength={2} maxLength={3000} rows={3} value={condition} onChange={e=>setCondition(e.target.value)} placeholder="Descreva a condição da carroceria, cabine, pintura e componentes visíveis."/></div>
     <div className="space-y-2"><Label htmlFor="intake-damage">Avarias preexistentes</Label><Textarea id="intake-damage" maxLength={3000} rows={3} value={damage} onChange={e=>setDamage(e.target.value)} placeholder="Riscos, amassados, peças ausentes ou outros danos já existentes."/></div>
     <div className="space-y-2"><Label htmlFor="intake-accessories">Acessórios e itens entregues</Label><Textarea id="intake-accessories" maxLength={2000} rows={2} value={accessories} onChange={e=>setAccessories(e.target.value)} placeholder="Chaves, documentos, ferramentas, estepe e outros itens."/></div>
     <div className="space-y-2"><Label htmlFor="intake-notes">Observações</Label><Textarea id="intake-notes" maxLength={3000} rows={2} value={notes} onChange={e=>setNotes(e.target.value)}/></div>
     <div className="space-y-2"><Label htmlFor="intake-photos">Fotografias (opcional)</Label><Textarea id="intake-photos" rows={3} value={photos} onChange={e=>setPhotos(e.target.value)} placeholder="Cole um endereço de imagem por linha (http/https)."/><p className="text-xs text-muted-foreground">Nesta versão, são guardados links de fotografias já hospedadas. O envio direto de arquivos depende de configurar armazenamento seguro.</p></div>
     <Button type="submit" disabled={saving||!selected}>{saving?"Salvando…":"Registrar recebimento"}</Button>
    </form>
    <section className="space-y-3"><h2 className="font-semibold">Histórico de recebimentos</h2>{records.map(r=>{const o=orders.find(x=>x.id===r.service_order_id);return <article key={r.id} className="rounded-md border p-4"><p className="font-semibold">OS {o?.number??"—"} · {o?.customer_name??"Cliente"}</p><p className="text-sm text-muted-foreground">{o?.plate} · {o?.vehicle}</p><p className="mt-2 text-sm">Recebido em {new Date(r.received_at).toLocaleString("pt-BR")}</p><p className="text-sm">Entregue por: {r.delivered_by_name||"Registro anterior sem identificação"}</p><p className="text-sm">Recebido por: {r.received_by_name||r.received_by}</p>{r.delivery_confirmed&&<p className="text-sm">Confirmação da entrega: {r.delivery_confirmed_at?new Date(r.delivery_confirmed_at).toLocaleString("pt-BR"):"Confirmada"}</p>}<p className="text-sm">Hodômetro/horímetro: {r.odometer} · Combustível: {r.fuel_level.replace("_"," ")}</p><p className="mt-1 text-sm">{r.exterior_condition}</p>{r.existing_damage&&<p className="mt-1 text-sm">Avarias: {r.existing_damage}</p>}{r.photo_urls?.length>0&&<p className="mt-1 text-xs text-muted-foreground">{r.photo_urls.length} link(s) de fotografia</p>}</article>;})}{records.length===0&&<p className="rounded-md border p-5 text-sm text-muted-foreground">Ainda não há recebimentos registrados.</p>}</section>
   </div>
  </>}
 </div>;
}
function Summary({label,value}:{label:string;value:number}){return <article className="rounded-md border bg-card p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-semibold tabular-nums">{value}</p></article>}
