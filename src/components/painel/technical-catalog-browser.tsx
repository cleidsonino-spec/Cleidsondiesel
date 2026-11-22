import { useMemo, useState } from 'react';
import { useSuspenseQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Copy, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { technicalCatalogQuery } from '@/lib/technical-queries';
import { matchesTechnicalSearch } from '@/lib/technical-reference';
import { COMPLETE_PUMP_TYPES, canEmbedDocument, consultableHotspot, coverageLabel, referenceDescription, referencePart, safeSource, searchCatalog, type TechnicalHotspot } from '@/lib/technical-catalog';
import type { PartDraft } from '@/lib/parts';
import { TechnicalFigureViewer } from './technical-figure-viewer';
import { TechnicalHotspotEditor } from './technical-hotspot-editor';

export function TechnicalCatalogBrowser({userId,isAdmin=false,onAdd,onAddToMaterialList}: {userId:string;isAdmin?:boolean;onAdd?:(part:PartDraft)=>void;onAddToMaterialList?:(part:PartDraft,quantity:number,pumpCode:string)=>void|Promise<void>}) {
  const query = technicalCatalogQuery(userId);
  const {data} = useSuspenseQuery(query);
  const qc = useQueryClient();
  const [search,setSearch] = useState('');
  const [partSearch,setPartSearch] = useState('');
  const [componentId,setComponentId] = useState('');
  const [referenceId,setReferenceId] = useState('');
  const [hotspotId,setHotspotId] = useState<string|null>(null);
  const [documentId,setDocumentId] = useState('');
  const [page,setPage] = useState(1);
  const [pageCount,setPageCount] = useState<number|null>(null);
  const [review,setReview] = useState(false);
  const [materialQuantity,setMaterialQuantity] = useState('1');
  const extras = useMemo(()=>{
    const map = new Map<string,string[]>();
    const add = (id:string|null, values:(string|null|undefined)[]) => {if(id) map.set(id,[...(map.get(id)??[]),...values.filter((v):v is string=>Boolean(v))]);};
    data.references.forEach(r=>add(r.component_id,[r.reference_code,r.technical_manufacturers?.name]));
    data.applications.forEach(a=>add(a.component_id,[a.equipment_model,a.equipment_manufacturer,a.technical_engines?.model,a.technical_engines?.family,a.technical_engines?.engine_code]));
    return map;
  },[data]);
  const completePumpTypes = COMPLETE_PUMP_TYPES;
  const isCompletePump = (type: string) => completePumpTypes.has(type);
  const matches = searchCatalog(data.components,data.references,search,c=>[c.name,c.model,c.component_code,c.description,c.component_type,c.technical_manufacturers?.name,c.technical_categories?.name,...(extras.get(c.id)??[])]);
  const component = data.components.find(c=>c.id===componentId);
  const refs = data.references.filter(r=>r.component_id===componentId);
  const rawHotspots = data.hotspots.filter(h=>h.component_id===componentId);
  const filteredRefs = refs.filter(r=>!partSearch.trim() || matchesTechnicalSearch([
    referenceDescription(r), r.catalog_position, r.reference_code, r.technical_manufacturers?.name,
    ...rawHotspots.filter(h=>h.reference_id===r.id).map(h=>h.catalog_position),
  ],partSearch));
  const apps = data.applications.filter(a=>a.component_id===componentId);
  const docs = data.documents.filter(d=>d.component_id===componentId || rawHotspots.some(h=>h.document_id===d.id) || apps.some(a=>a.engine_id===d.engine_id&&Boolean(a.engine_id)));
  const figureDocs = docs.filter(d=>d.component_id===componentId&&d.is_active);
  const document = figureDocs.find(d=>d.id===documentId);
  const verified = rawHotspots.filter(h=>consultableHotspot(h,refs,docs));
  const displayedHotspots = isAdmin&&review ? rawHotspots : verified;
  const selected = refs.find(r=>r.id===referenceId);
  const selectedHotspot = rawHotspots.find(h=>h.id===hotspotId&&h.reference_id===referenceId);
  function selectHotspot(h:TechnicalHotspot) {setReferenceId(h.reference_id??'');setHotspotId(h.id);}
  function selectRef(id:string) {
    setReferenceId(id);
    setMaterialQuantity('1');
    const h = displayedHotspots.find(h=>h.reference_id===id);
    setHotspotId(h?.id??null);
    if(h) {setDocumentId(h.document_id);setPage(h.pdf_page_number);setPageCount(null);}
  }
  function open(id:string) {
    setComponentId(id);setReferenceId('');setHotspotId(null);setReview(false);setPageCount(null);
    const related = data.documents.filter(d=>d.component_id===id&&d.is_active);
    const h = data.hotspots.find(h=>h.component_id===id&&consultableHotspot(h,data.references,data.documents));
    setDocumentId(h?.document_id??related[0]?.id??'');setPage(h?.pdf_page_number??1);
  }
  async function copy() {
    if(!selected||!component)return;
    try {await navigator.clipboard.writeText(JSON.stringify(referencePart(selected,component,docs.find(d=>d.id===selectedHotspot?.document_id)),null,2));toast.success('Peça copiada com metadados técnicos.');}catch{toast.error('O dispositivo não permitiu copiar a peça.');}
  }
  return <div className="space-y-5">
    <header className="flex items-center gap-2"><BookOpen/><h1 className="text-2xl">Central Técnica</h1></header>
    <div className="space-y-2">
      <Input aria-label="Número ou código da bomba" placeholder="Digite o número ou código da bomba (ex.: Bosch 9 460 613 532)" value={search} onChange={e=>setSearch(e.target.value)}/>
      <p className="text-xs text-muted-foreground">Digite o código ou modelo da bomba. As peças só aparecem depois que você abrir uma bomba encontrada.</p>
    </div>
    {component ? <section className="space-y-4" aria-label="Ficha técnica">
      <div className="flex items-start justify-between gap-2"><div><h2 className="text-xl">{component.name}</h2><p className="text-sm text-muted-foreground">{[component.component_code,component.model,component.technical_manufacturers?.name,component.component_type.replaceAll('_',' ')].filter(Boolean).join(' · ')}</p></div><Button variant="ghost" size="icon" title="Fechar ficha" aria-label="Fechar ficha" onClick={()=>setComponentId('')}><X/></Button></div>
      <p className="text-sm text-warning">{coverageLabel(refs,docs,rawHotspots)}</p>
      {component.description&&<p className="text-sm">{component.description}</p>}
      <div className="flex flex-wrap gap-3 items-center"><h3>Figura / documento</h3>{isAdmin&&<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={review} onChange={e=>setReview(e.target.checked)}/>Revisar posições pendentes</label>}</div>
      {figureDocs.length ? <>
        <select aria-label="Documento da figura" className="w-full rounded-md border bg-background p-2" value={documentId} onChange={e=>{setDocumentId(e.target.value);setPage(1);setPageCount(null);setHotspotId(null);}}>{figureDocs.map(d=><option key={d.id} value={d.id}>{d.title} · {d.information_status}</option>)}</select>
        <label className="flex items-center gap-2 text-sm">Página física<Input aria-label="Página física" className="w-24" type="number" min={1} max={pageCount??undefined} value={page} onChange={e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>0&&(!pageCount||n<=pageCount))setPage(n);}}/>{pageCount?`/ ${pageCount}`:null}</label>
        {document&&<TechnicalFigureViewer document={document} page={page} hotspots={displayedHotspots} selectedId={hotspotId} onSelect={selectHotspot} onPageCount={setPageCount}/>}
        {isAdmin&&review&&<p className="text-sm text-warning">Prévia administrativa: posições pendentes não são informação confirmada.</p>}
      </> : <p className="text-sm text-muted-foreground">{refs.length?'Referências disponíveis, figura não mapeada.':'Aguardando documentação.'}</p>}
      <div className="space-y-2">
        <h3>Buscar peça nesta bomba ({filteredRefs.length} de {refs.length})</h3>
        <Input aria-label="Buscar peça por nome, posição ou código" placeholder="Digite o nome da peça, posição ou código" value={partSearch} onChange={e=>setPartSearch(e.target.value)}/>
        <p className="text-xs text-muted-foreground">Pesquise pelo nome da peça ou pela posição indicada na figura. Selecione o resultado para localizar a posição e consultar o código.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 max-h-96 overflow-y-auto">
        {[...filteredRefs].sort((a,b)=>(a.catalog_position??'').localeCompare(b.catalog_position??'','pt-BR',{numeric:true})).map(r=><Button key={r.id} variant="outline" className={`h-auto min-h-20 flex-col items-start whitespace-normal text-left ${r.id===referenceId?'border-primary bg-primary/10':''}`} onClick={()=>selectRef(r.id)}><span className="text-sm font-semibold leading-snug text-white">{referenceDescription(r)}</span><span className="text-xs text-muted-foreground">{[r.catalog_position?`Pos. ${r.catalog_position}`:null,r.reference_code].filter(Boolean).join(' · ')}</span><span className="text-xs text-muted-foreground">{r.information_status==='documented'?'Documentado':'Pendente de validação'}</span></Button>)}
        {!filteredRefs.length&&<p className="text-sm text-muted-foreground">Nenhuma peça encontrada com esse nome, posição ou código.</p>}
      </div>
      {selected&&<article className="space-y-2 border-l-2 border-primary pl-3" aria-label="Peça selecionada"><h4 className="text-lg font-semibold leading-snug text-white">{referenceDescription(selected)}</h4><p>{[selected.reference_code,selected.technical_manufacturers?.name,`Posição ${selectedHotspot?.catalog_position??selected.catalog_position??'não informada'}`,`Quantidade ${selected.catalog_quantity??'não informada'}`].filter(Boolean).join(' · ')}</p><p className="text-sm text-muted-foreground">{selected.information_status==='documented'?'Documentado':'Pendente de validação'}{selectedHotspot?` · página física ${selectedHotspot.pdf_page_number}${selectedHotspot.printed_page_number?` · impressa ${selectedHotspot.printed_page_number}`:''}`:''}</p>{selected.notes&&<p className="text-sm">{selected.notes}</p>}<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={copy}><Copy/>Copiar peça com metadados</Button>{onAddToMaterialList&&<div className="flex flex-wrap items-center gap-2"><label className="text-sm" htmlFor="material-quantity">Quantidade necessária</label><Input id="material-quantity" aria-label="Quantidade necessária para compra" className="w-24" type="number" min={1} step={1} value={materialQuantity} onChange={e=>setMaterialQuantity(e.target.value)}/><Button onClick={()=>{const quantity=Number(materialQuantity);if(!Number.isInteger(quantity)||quantity<1){toast.error('Informe uma quantidade válida.');return;}void Promise.resolve(onAddToMaterialList(referencePart(selected,component,docs.find(d=>d.id===selectedHotspot?.document_id)),quantity,component.component_code||component.name));}}><Plus/>Adicionar à lista de materiais</Button></div>}{onAdd&&<Button onClick={()=>onAdd(referencePart(selected,component,docs.find(d=>d.id===selectedHotspot?.document_id)))}><Plus/>Adicionar à OS / orçamento</Button>}</div></article>}
      <h3>Aplicações ({apps.length})</h3>{apps.length?apps.map(a=><p key={a.id} className="text-sm">{[a.technical_engines?.model,a.technical_engines?.family,a.equipment_manufacturer,a.equipment_model,a.application_notes].filter(Boolean).join(' · ')}</p>):<p className="text-sm text-muted-foreground">Nenhuma aplicação cadastrada.</p>}
      <h3>Fontes ({docs.length})</h3>{docs.map(d=><div key={d.id} className="text-sm">{safeSource(d.source_url)?<a className="text-primary underline" href={safeSource(d.source_url)} target="_blank" rel="noreferrer">{d.title}</a>:d.title} · {d.source_name} · {d.access_type} · {d.information_status}{d.copyright_notes&&<p className="text-xs text-muted-foreground">{d.copyright_notes}</p>}</div>)}
      {isAdmin&&review&&<TechnicalHotspotEditor key={componentId} componentId={componentId} references={refs} documents={docs} hotspots={rawHotspots} onSaved={()=>{void qc.invalidateQueries({queryKey:query.queryKey});}}/>}
    </section> : <>
      {!search.trim() ? <p className="text-sm text-muted-foreground">Aguardando o número ou código da bomba.</p> : <>
         <p className="text-sm text-muted-foreground">{matches.length} {matches.some(c=>!isCompletePump(c.component_type))?'registros encontrados':'bombas encontradas'}</p>
        {!matches.length&&<p role="status">Nenhuma bomba ou peça encontrada para esse número ou código.</p>}
        <div className="grid gap-3 md:grid-cols-2">{matches.map(c=><Button key={c.id} variant="outline" onClick={()=>open(c.id)} className="h-auto min-h-28 flex-col items-start whitespace-normal text-left p-4"><strong>{c.name}</strong><span className="text-sm text-muted-foreground">{[c.component_code,c.model,c.technical_manufacturers?.name,c.component_type.replaceAll('_',' ')].filter(Boolean).join(' · ')}</span><span className="text-xs text-warning">{coverageLabel(data.references.filter(r=>r.component_id===c.id),data.documents.filter(d=>d.component_id===c.id),data.hotspots.filter(h=>h.component_id===c.id))}</span></Button>)}</div>
      </>}
    </>}
  </div>;
}
