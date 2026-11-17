import { useEffect, useRef, useState } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { Maximize, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { canEmbedDocument, pageHotspots, safeSource, type TechnicalDocument, type TechnicalHotspot } from '@/lib/technical-catalog';

export function TechnicalFigureViewer({document, page, hotspots, selectedId, onSelect, onPageCount}: {
  document: TechnicalDocument; page: number; hotspots: TechnicalHotspot[]; selectedId: string | null;
  onSelect: (h: TechnicalHotspot) => void; onPageCount: (count: number) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [size, setSize] = useState({width: 900, height: 1273});
  const countCallback = useRef(onPageCount); countCallback.current = onPageCount;
  const allowed = canEmbedDocument(document);
  useEffect(() => {
    let active = true;
    let cleanup: (() => void) | undefined;
    setReady(false); setError('');
    if (!allowed) return;
    void (async () => {
      // Browser-only import: never evaluate PDF.js in SSR. Fetch the authorized URL directly; no copying/storage/proxy.
      const pdfjs = await import('pdfjs-dist');
      const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
      if (!active) return;
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      const task = pdfjs.getDocument({url: document.source_url});
      cleanup = () => { void task.destroy(); };
      const pdf = await task.promise;
      if (!active) return;
      countCallback.current(pdf.numPages);
      if (page > pdf.numPages) throw new Error('Página não existe neste documento.');
      const pdfPage = await pdf.getPage(page);
      const original = pdfPage.getViewport({scale: 1});
      const viewport = pdfPage.getViewport({scale: 1200 / original.width});
      const el = canvas.current; if (!el || !active) return;
      el.width = viewport.width; el.height = viewport.height;
      setSize({width: viewport.width, height: viewport.height});
      await pdfPage.render({canvas: el, viewport}).promise;
      if (active) setReady(true);
    })().catch(e => { if (active) setError(e instanceof Error ? e.message : 'Não foi possível incorporar o documento.'); });
    return () => { active = false; cleanup?.(); };
  }, [document.id, document.source_url, page, allowed]);
  const url = safeSource(document.source_url);
  return <div className="space-y-2">
    {url && <a href={`${url.split('#')[0]}#page=${page}`} target="_blank" rel="noreferrer" className="text-sm text-primary underline">Abrir fonte autorizada · {document.title} · página {page}</a>}
    {document.copyright_notes && <p className="text-xs text-muted-foreground">{document.copyright_notes}</p>}
    {!allowed ? <p className="text-sm text-warning">Consulta somente pela fonte autorizada. Incorporação indisponível para este documento.</p> : <>
      {error && <p role="alert" className="text-sm text-warning">Não foi possível exibir a página: {error}. Consulte a fonte autorizada; as referências continuam disponíveis.</p>}
      {!ready && !error && <p role="status" className="text-sm text-muted-foreground">Carregando página {page}…</p>}
      <TransformWrapper key={`${document.id}:${page}`} minScale={1} maxScale={6} wheel={{step: 0.08}}>
        {({zoomIn,zoomOut,resetTransform}) => <>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="icon" title="Ampliar" aria-label="Ampliar" onClick={() => zoomIn()}><Plus /></Button>
            <Button type="button" variant="outline" size="icon" title="Reduzir" aria-label="Reduzir" onClick={() => zoomOut()}><Minus /></Button>
            <Button type="button" variant="outline" size="icon" title="Ajustar página" aria-label="Ajustar página" onClick={() => resetTransform()}><Maximize /></Button>
          </div>
          <div className={ready ? 'overflow-hidden border border-border' : 'hidden'}>
            <TransformComponent wrapperStyle={{width:'100%'}} contentStyle={{width:'100%'}}>
              <div className="relative w-full" style={{aspectRatio:`${size.width}/${size.height}`}}>
                <canvas ref={canvas} className="block h-full w-full" />
                {ready && <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="absolute inset-0 h-full w-full pointer-events-none" aria-label="Posições da figura">
                  {pageHotspots(hotspots,document.id,page).map(h => {
                    const props = {tabIndex:0, role:'button', 'aria-label':`Posição ${h.catalog_position}`, onClick:() => onSelect(h), onKeyDown:(e: React.KeyboardEvent) => {if(e.key === 'Enter' || e.key === ' ') {e.preventDefault(); onSelect(h);}}, className:`pointer-events-auto cursor-pointer stroke-primary ${selectedId === h.id ? 'fill-primary/30' : 'fill-primary/10'}`, strokeWidth:0.003};
                    return h.shape === 'circle' ? <ellipse key={h.id} {...props} cx={h.x+h.width/2} cy={h.y+h.height/2} rx={h.width/2} ry={h.height/2}><title>Posição {h.catalog_position}</title></ellipse> : <rect key={h.id} {...props} x={h.x} y={h.y} width={h.width} height={h.height}><title>Posição {h.catalog_position}</title></rect>;
                  })}
                </svg>}
              </div>
            </TransformComponent>
          </div>
        </>}
      </TransformWrapper>
    </>}
  </div>;
}
