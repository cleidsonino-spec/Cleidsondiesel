-- Catálogo técnico: imagens originais de despieces e componentes.
-- Migration preparada para revisão; não aplicada automaticamente ao banco ativo.

CREATE TABLE IF NOT EXISTS public.technical_component_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id uuid NOT NULL REFERENCES public.technical_components(id) ON DELETE CASCADE,
  image_type text NOT NULL CHECK (image_type IN ('exploded_view', 'component_photo')),
  storage_path text NOT NULL UNIQUE,
  caption text,
  source_url text,
  information_status text NOT NULL DEFAULT 'pending_validation'
    CHECK (information_status IN ('pending_validation', 'documented')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS technical_component_images_component_idx
  ON public.technical_component_images(component_id, image_type);

ALTER TABLE public.technical_component_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS technical_component_images_read ON public.technical_component_images;
CREATE POLICY technical_component_images_read
  ON public.technical_component_images
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
    OR public.has_role(auth.uid(), 'mecanico'::public.app_role)
  );

DROP POLICY IF EXISTS technical_component_images_admin_manage ON public.technical_component_images;
CREATE POLICY technical_component_images_admin_manage
  ON public.technical_component_images
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'technical-catalog',
  'technical-catalog',
  false,
  20971520,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS technical_catalog_images_read ON storage.objects;
CREATE POLICY technical_catalog_images_read
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'technical-catalog'
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
      OR public.has_role(auth.uid(), 'mecanico'::public.app_role)
    )
  );

DROP POLICY IF EXISTS technical_catalog_images_admin_insert ON storage.objects;
CREATE POLICY technical_catalog_images_admin_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'technical-catalog'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS technical_catalog_images_admin_update ON storage.objects;
CREATE POLICY technical_catalog_images_admin_update
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'technical-catalog' AND public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (bucket_id = 'technical-catalog' AND public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS technical_catalog_images_admin_delete ON storage.objects;
CREATE POLICY technical_catalog_images_admin_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'technical-catalog' AND public.has_role(auth.uid(), 'admin'::public.app_role));
