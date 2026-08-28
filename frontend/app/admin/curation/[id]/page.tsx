// app/admin/curation/[id]/page.tsx
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'
import AnnotationTool from '@/components/admin/curation/annotation/AnnotationTool'
import { BBoxData } from '@/components/admin/curation/annotation/types'

interface Props {
  params: Promise<{ id: string }>
}

export default async function AnnotationPage({ params }: Props) {
  const { id }         = await params
  const supabase       = await createClient()
  const supabaseAdmin  = await createAdminClient()  // ← bypasses RLS

  // ── Fetch label ───────────────────────────────────────────
  const { data: labelData } = await supabaseAdmin
    .from('training_labels')
    .select('*')
    .eq('id', id)
    .single()

  if (!labelData) notFound()

  // ── Fetch raw image — needs admin client (RLS blocks anon) ─
  const { data: rawImage } = await supabaseAdmin
    .from('raw_images')
    .select('file_url, id')
    .eq('id', labelData.raw_image_id)
    .single()

  console.log('rawImage:', rawImage?.file_url)

  // ── Fetch prediction ──────────────────────────────────────
  const { data: predictions } = await supabaseAdmin
    .from('predictions')
    .select('id, bounding_box, tirads, confidence, explanation_metadata')
    .eq('raw_image_id', labelData.raw_image_id)
    .order('created_at', { ascending: false })
    .limit(1)

  const prediction = predictions?.[0] ?? null

  // ── Fetch feedback for context ────────────────────────────
  const { data: feedbacks } = await supabaseAdmin
    .from('prediction_feedback')
    .select('corrected_tirads, corrected_features, comments, is_correct')
    .eq('prediction_id', prediction?.id ?? '')
    .limit(1)

  const feedback = feedbacks?.[0] ?? null

  // ── Generate signed URLs ────────────────────────────────
  const resolveUrl = async (urlOrPath: string | null) => {
    if (!urlOrPath) return null
    if (urlOrPath.startsWith('http')) return urlOrPath
    
    const { data } = await supabaseAdmin
      .storage
      .from('thyrovision-images')
      .createSignedUrl(urlOrPath, 3600)
    return data?.signedUrl ?? null
  }

  const imageUrl = await resolveUrl(rawImage?.file_url)
  
  // Try gradcam path first, fallback to url field
  const gradcamSource = prediction?.explanation_metadata?.gradcam_image_path || 
                       prediction?.explanation_metadata?.gradcam_image_url
  const gradcamUrl = await resolveUrl(gradcamSource)

  const aiBbox = prediction?.bounding_box as BBoxData ?? null

  // ── Build label with joined context ──────────────────────
  const label = {
    ...labelData,
    image_url:     imageUrl,
    ai_tirads:     prediction?.tirads ?? null,
    doctor_tirads: feedback?.corrected_tirads ?? null,
    bbox_issue:    feedback?.corrected_features?.bbox_issue ?? null,
    claimer_name:  null,
  }

  return (
    <AnnotationTool
      label={label}
      rawImageUrl={imageUrl}
      gradcamUrl={gradcamUrl}
      aiBbox={aiBbox}
    />
  )
}