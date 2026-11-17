import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { canEmbedDocument, validHotspotBounds, validHotspotLinks, type TechnicalDocument, type TechnicalReference, type TechnicalHotspot } from '@/lib/technical-catalog';

export function TechnicalHotspotEditor({componentId,documents,references,hotspots,onSaved}: {componentId:string;documents:TechnicalDocument[];references:TechnicalReference[];hotspots:TechnicalHotspot[];onSaved:()=>void}) {
  const empty = {id:'',document_id:'',reference_id:'',catalog_position:'',pdf_page_number:1,printed_page_number:'',x:0,y:0,width:0.1,height:0.1,shape:'rect',is_active:true};
  const [draft,setDraft] = useState(empty);
  const [confirmed,setConfirmed] = useState(false);
  const [saving,setSaving] = useState(false);
  const set = (key: keyof typeof empty,value:string|number|boolean) => {setDraft(p=>({...p,[key]:value}));setConfirmed(false);};
  async function save(status:'pending_validation'|'documented') {
    const document = documents.find(d=>d.id===draft.document_id);
    const reference = references.find(r=>r.id===draft.reference_id);
    const h = {...draft,component_id:componentId,information_status:status,printed_page_number:draft.printed_page_number ? Number(draft.printed_page_number) : null} as unknown as TechnicalHotspot;
    if(!draft.catalog_position.trim() || !validHotspotBounds(h) || !validHotspotLinks(h,reference,document)) {toast.error('Confira posição, página, limites e vínculos da referência e documento.');return;}
    if (h.printed_page_number !== null && (!Number.isInteger(h.printed_page_number) || h.printed_page_number < 1)) {toast.error('Página impressa inválida.');return;}
    if(status==='documented' && (!confirmed || reference?.information_status!=='documented' || document?.information_status!=='documented' || !document.is_active || !canEmbedDocument(document))) {toast.error('Confirme a conferência humana na fonte e use referência/documento documentados, com incorporação permitida.');return;}
    setSaving(true);
    try {
      const payload = {component_id:componentId,document_id:draft.document_id,reference_id:draft.reference_id,catalog_position:draft.catalog_position.trim(),pdf_page_number:draft.pdf_page_number,printed_page_number:h.printed_page_number,x:draft.x,y:draft.y,width:draft.width,height:draft.height,shape:draft.shape,is_active:draft.is_active,information_status:status};
      const result = draft.id ? await supabase.from('technical_figure_hotspots').update(payload).eq('id',draft.id).eq('component_id',componentId) : await supabase.from('technical_figure_hotspots').insert(payload);
      if(result.error) throw result.error;
      toast.success(status==='documented'?'Posição validada individualmente.':'Posição salva como pendente.');onSaved();setConfirmed(false);
    } catch(e) {toast.error(e instanceof Error?e.message:'Não foi possível salvar a posição.');} finally {setSaving(false);}
  }
  return <section className="space-y-3 border-t border-border pt-4" aria-label="Revisão administrativa de posições">
    <h3 className="text-lg">Revisão administrativa de posições</h3>
    <select aria-label="Posição para revisar" className="w-full rounded-md border bg-background p-2" value={draft.id} onChange={e=>{const h=hotspots.find(h=>h.id===e.target.value);setDraft(h?{...empty,...h,reference_id:h.reference_id??'',printed_page_number:h.printed_page_number?String(h.printed_page_number):''}:empty);setConfirmed(false);}}><option value="">Nova posição</option>{hotspots.map(h=><option key={h.id} value={h.id}>{h.catalog_position} · pág. {h.pdf_page_number} · {h.information_status}</option>)}</select>
    <div className="grid gap-3 sm:grid-cols-2">
      <label>Documento<select aria-label="Documento da posição" className="block w-full rounded-md border bg-background p-2" value={draft.document_id} onChange={e=>set('document_id',e.target.value)}><option value="">Selecione</option>{documents.filter(d=>d.component_id===componentId).map(d=><option key={d.id} value={d.id}>{d.title}</option>)}</select></label>
      <label>Referência<select aria-label="Referência da posição" className="block w-full rounded-md border bg-background p-2" value={draft.reference_id} onChange={e=>set('reference_id',e.target.value)}><option value="">Selecione</option>{references.map(r=><option key={r.id} value={r.id}>{r.reference_code} · {r.information_status}</option>)}</select></label>
      <label>Posição<Input value={draft.catalog_position} onChange={e=>set('catalog_position',e.target.value)}/></label>
      <label>Página física do PDF<Input type="number" min={1} value={draft.pdf_page_number} onChange={e=>set('pdf_page_number',Number(e.target.value))}/></label>
      <label>Página impressa (opcional)<Input type="number" min={1} value={draft.printed_page_number} onChange={e=>set('printed_page_number',e.target.value)}/></label>
      <label>Forma<select className="block w-full rounded-md border bg-background p-2" value={draft.shape} onChange={e=>set('shape',e.target.value)}><option value="rect">Retângulo</option><option value="circle">Círculo</option></select></label>
      {(['x','y','width','height'] as const).map(key=><label key={key}>{({x:'X',y:'Y',width:'Largura',height:'Altura'})[key]} (0–1)<Input aria-label={key} type="number" min={0} max={1} step={0.001} value={draft[key]} onChange={e=>set(key,Number(e.target.value))}/></label>)}
    </div>
    <label className="flex gap-2"><input type="checkbox" checked={draft.is_active} onChange={e=>set('is_active',e.target.checked)}/>Ativa</label>
    <label className="flex gap-2"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Conferi visualmente esta posição, a página e a referência na fonte autorizada.</label>
    <div className="flex flex-wrap gap-2"><Button disabled={saving} variant="outline" onClick={()=>save('pending_validation')}>Salvar pendente</Button><Button disabled={saving||!confirmed} onClick={()=>save('documented')}>Validar posição</Button></div>
  </section>;
}
