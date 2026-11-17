import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { TechnicalComponent, TechnicalReference, TechnicalDocument, TechnicalHotspot } from './technical-catalog';
export function technicalCatalogQuery(userId: string) {
  return queryOptions({ queryKey: ['technical-catalog', userId], staleTime: 60000, queryFn: async () => {
    const pageAll = async <T,>(fetch: (from: number) => PromiseLike<{data: T[] | null; error: unknown}>) => {
      const all: T[] = [];
      for (let from = 0; ; from += 1000) { const {data, error} = await fetch(from); if (error) throw error; all.push(...(data ?? [])); if (!data || data.length < 1000) return all; }
    };
    const [components, references, documents, hotspots, applications] = await Promise.all([
      pageAll<TechnicalComponent>(f => supabase.from('technical_components').select('*,technical_manufacturers(name),technical_categories(name)').order('id').range(f,f+999)),
      pageAll<TechnicalReference>(f => supabase.from('technical_references').select('*,technical_manufacturers(name)').order('id').range(f,f+999)),
      pageAll<TechnicalDocument>(f => supabase.from('technical_documents').select('*').order('id').range(f,f+999)),
      pageAll<TechnicalHotspot>(f => supabase.from('technical_figure_hotspots').select('*').order('id').range(f,f+999)),
      pageAll(f => supabase.from('technical_applications').select('*,technical_engines(id,model,family,engine_code,technical_manufacturers(name))').order('id').range(f,f+999)),
    ]);
    return {components, references, documents, hotspots, applications};
  }});
}
