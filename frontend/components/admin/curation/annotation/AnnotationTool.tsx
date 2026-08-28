// components/admin/curation/annotation/AnnotationTool.tsx
'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useAuthStore } from '@/store/authStore'
import { useQueryClient } from '@tanstack/react-query'
import ImageCanvas from './ImageCanvas'
import ACRFeatureForm from './ACRFeatureForm'
import {
  ACRFeatures,
  BBoxData,
  AnnotationState,
  calculatePoints,
  calculateTirads,
} from './types'
import { CurationLabel } from '../types'
import {
  ChevronLeft,
  SkipForward,
  XCircle,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react'
import { goeyToast as toast } from '@/components/ui/goey-toaster'

const supabase = createClient()

const EMPTY_FEATURES: ACRFeatures = {
  composition:    null,
  echogenicity:   null,
  shape:          null,
  margin:         null,
  echogenic_foci: null,
}

interface Props {
  label:       CurationLabel
  rawImageUrl: string | null
  gradcamUrl:  string | null
  aiBbox:      BBoxData | null
}

export default function AnnotationTool({
  label,
  rawImageUrl,
  gradcamUrl,
  aiBbox,
}: Props) {
  const router      = useRouter()
  const { user }    = useAuthStore()
  const queryClient = useQueryClient()

  const [annotation, setAnnotation] = useState<AnnotationState>({
    bbox:     null,
    features: EMPTY_FEATURES,
    notes:    label.notes ?? '',
    tirads:   label.tirads ?? null,
    points:   0,
  })

  const [isSubmitting,     setIsSubmitting]     = useState(false)
  const [showRejectModal,  setShowRejectModal]  = useState(false)
  const [rejectReason,     setRejectReason]     = useState('')

  // ── Update tirads + points when features change ───────────
  useEffect(() => {
    const points = calculatePoints(annotation.features)
    const tirads = calculateTirads(points)
    setAnnotation(prev => ({ ...prev, points, tirads }))
  }, [annotation.features])

  // ── Release claim on unmount ──────────────────────────────
  useEffect(() => {
    return () => {
      if (user?.id) {
        supabase.rpc('release_training_label_claim', {
          p_label_id: label.id,
          p_admin_id: user.id,
        }).then(() => {
          queryClient.invalidateQueries({ queryKey: ['curation-queue'] })
          queryClient.invalidateQueries({ queryKey: ['curation-stats'] })
        })
      }
    }
  }, [label.id, user?.id, queryClient])

  // ── Keyboard shortcuts ────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement  ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) return

      if (e.key === 'a' || e.key === 'A') handleApprove()
      if (e.key === 'r' || e.key === 'R') setShowRejectModal(true)
      if (e.key === 's' || e.key === 'S') handleSkip()
      if (e.key === 'Escape') router.push('/admin/curation')
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [annotation]) // eslint-disable-line

  // ── Validate before approve ───────────────────────────────
  const validate = (): string | null => {
    const needsBbox   = label.metadata?.needs_bbox_correction
    const needsTirads = label.metadata?.needs_tirads_correction

    if (needsBbox && !annotation.bbox) {
      return 'Please draw a bounding box for the nodule location.'
    }
    if (needsTirads) {
      const allSelected = Object.values(annotation.features).every(f => f !== null)
      if (!allSelected) {
        return 'Please select all 5 ACR features to calculate TI-RADS score.'
      }
    }
    return null
  }

  // ── Approve ───────────────────────────────────────────────
  const handleApprove = useCallback(async () => {
    const validationError = validate()
    if (validationError) {
      toast.warning("Incomplete Annotation", {
        description: validationError
      })
      return
    }

    setIsSubmitting(true)

    try {
      await supabase.rpc('approve_training_label', {
        p_label_id:           label.id,
        p_admin_id:           user?.id,
        p_tirads:             annotation.tirads,
        p_bounding_boxes:     annotation.bbox,
        p_corrected_features: annotation.features,
        p_notes:              annotation.notes || null,
      })

      toast.success("Label Approved", {
        description: `Nodule annotation saved with TI-RADS ${tirads}.`
      })
      router.push('/admin/curation')
    } catch (err: any) {
      toast.error("Approval Failed", {
        description: err.message || 'Failed to approve label'
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [annotation, label.id, user?.id, queryClient, router])

  // ── Reject ────────────────────────────────────────────────
  const handleReject = useCallback(async () => {
    if (!rejectReason.trim()) {
      toast.warning("Reason Required", {
        description: 'Please provide a reason for rejection.'
      })
      return
    }

    setIsSubmitting(true)

    try {
      await supabase.rpc('reject_training_label', {
        p_label_id: label.id,
        p_admin_id: user?.id,
        p_reason:   rejectReason,
      })

      toast.success("Label Rejected", {
        description: "The label has been removed from the curation queue."
      })
      router.push('/admin/curation')
    } catch (err: any) {
      toast.error("Rejection Failed", {
        description: err.message || 'Failed to reject label'
      })
    } finally {
      setIsSubmitting(false)
      setShowRejectModal(false)
    }
  }, [rejectReason, label.id, user?.id, queryClient, router])

  // ── Skip ──────────────────────────────────────────────────
  const handleSkip = useCallback(async () => {
    if (!user?.id) return
    await supabase.rpc('release_training_label_claim', {
      p_label_id: label.id,
      p_admin_id: user.id,
    })
    queryClient.invalidateQueries({ queryKey: ['curation-queue'] })
    router.push('/admin/curation')
  }, [label.id, user?.id, queryClient, router])

  const tirads = calculateTirads(calculatePoints(annotation.features))

  return (
    <>
      {/*
        ── Full screen overlay — sits above everything ──
        fixed inset-0 ensures no parent scroll bleeds in
      */}
      <div className="fixed inset-0 flex flex-col bg-[#080d14] z-40">

        {/* ── Top bar — fixed, never scrolls ── */}
        <div className="shrink-0 flex items-center justify-between
                         px-4 py-2.5 border-b border-[#1e2736] bg-[#0f1623]">

          <div className="flex items-center gap-3">
            {/* Back */}
            <button
              onClick={() => router.push('/admin/curation')}
              className="flex items-center gap-1.5 text-sm
                         text-muted-foreground hover:text-white
                         transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>

            <div className="h-4 w-px bg-[#2d3748]" />

            {/* What needs doing */}
            <div className="flex items-center gap-2">
              {label.metadata?.needs_bbox_correction && (
                <span className="text-xs px-2 py-1 rounded
                                  bg-blue-500/10 text-blue-400
                                  border border-blue-500/20">
                  BBox needed
                </span>
              )}
              {label.metadata?.needs_tirads_correction && (
                <span className="text-xs px-2 py-1 rounded
                                  bg-purple-500/10 text-purple-400
                                  border border-purple-500/20">
                  TI-RADS needed
                </span>
              )}
            </div>
          </div>

          {/* Keyboard shortcuts */}
          <div className="hidden md:flex items-center gap-3
                           text-xs text-muted-foreground">
            {[
              { key: 'A', label: 'Approve' },
              { key: 'R', label: 'Reject'  },
              { key: 'S', label: 'Skip'    },
              { key: 'Esc', label: 'Back'  },
            ].map(({ key, label: lbl }) => (
              <span key={key}>
                <kbd className="px-1.5 py-0.5 bg-[#1e2736]
                                 rounded text-xs font-mono">
                  {key}
                </kbd>
                {' '}{lbl}
              </span>
            ))}
          </div>
        </div>

        {/* ── Body — fills remaining height, no overflow ── */}
        <div className="flex flex-1 min-h-0">

          {/* ════════ LEFT PANEL — canvas ════════ */}
          <div className="flex flex-col flex-1 min-w-0 min-h-0
                           border-r border-[#1e2736]">

            {/* Doctor context strip — fixed height */}
            <div className="shrink-0 m-3 p-3 rounded-lg
                             bg-[#1e2736]/50 border border-[#2d3748]">
              <p className="text-[10px] text-muted-foreground uppercase
                             tracking-wider font-semibold mb-1.5">
                Doctor's Feedback
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1
                               text-sm">
                <span className="text-muted-foreground">
                  AI:
                  <span className="text-white font-bold ml-1">
                    TR{label.ai_tirads ?? '?'}
                  </span>
                </span>
                {label.doctor_tirads && (
                  <span className="text-muted-foreground">
                    Doctor:
                    <span className="text-yellow-400 font-bold ml-1">
                      TR{label.doctor_tirads}
                    </span>
                  </span>
                )}
                {label.bbox_issue && (
                  <span className="text-xs text-blue-400">
                    📍 {label.bbox_issue.replace(/_/g, ' ')}
                  </span>
                )}
                {label.notes && label.notes !== 'na' && (
                  <span className="text-xs text-muted-foreground">
                    💬 "{label.notes}"
                  </span>
                )}
              </div>
            </div>

            {/* Canvas — flex-1 fills all remaining left panel space */}
            <div className="flex-1 min-h-0 px-3 pb-3">
              <ImageCanvas
                rawImageUrl={rawImageUrl}
                gradcamUrl={gradcamUrl}
                aiBbox={aiBbox}
                currentBbox={annotation.bbox}
                onChange={(bbox) =>
                  setAnnotation(prev => ({ ...prev, bbox }))
                }
              />
            </div>
          </div>

          {/* ════════ RIGHT PANEL — form ════════ */}
          <div className="shrink-0 w-[360px] flex flex-col min-h-0">

            {/* Scrollable form content */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5
                             custom-scrollbar">

              {/* ACR Features */}
              <div>
                <h3 className="text-sm font-semibold text-white mb-3">
                  ACR TI-RADS Features
                </h3>
                <ACRFeatureForm
                  features={annotation.features}
                  onChange={(features) =>
                    setAnnotation(prev => ({ ...prev, features }))
                  }
                />
              </div>

              {/* Admin notes */}
              <div className="space-y-2">
                <label className="text-[10px] uppercase text-muted-foreground
                                   font-bold tracking-wider">
                  Admin Notes (optional)
                </label>
                <textarea
                  value={annotation.notes}
                  onChange={(e) =>
                    setAnnotation(prev => ({ ...prev, notes: e.target.value }))
                  }
                  placeholder="Any notes about this annotation..."
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-lg border
                             border-[#2d3748] bg-[#1e2736] text-sm
                             text-white placeholder:text-muted-foreground
                             focus:outline-none focus:border-[#4d5768]
                             resize-none"
                />
              </div>

            </div>

            {/* ── Action buttons — always visible at bottom ── */}
            <div className="shrink-0 px-4 py-3 border-t border-[#1e2736]
                             bg-[#0f1623] space-y-2.5">

              {/* Approve */}
              <button
                onClick={handleApprove}
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2
                           py-2.5 rounded-lg font-medium text-sm
                           bg-green-500/20 border border-green-500/40
                           text-green-400 hover:bg-green-500/30
                           transition-colors cursor-pointer
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle className="w-4 h-4" />
                {isSubmitting ? 'Saving...' : `Approve — TR${tirads}`}
              </button>

              {/* Reject + Skip */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setShowRejectModal(true)}
                  disabled={isSubmitting}
                  className="flex items-center justify-center gap-2
                             py-2.5 rounded-lg text-sm font-medium
                             bg-red-500/10 border border-red-500/20
                             text-red-400 hover:bg-red-500/20
                             transition-colors cursor-pointer
                             disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <XCircle className="w-4 h-4" />
                  Reject
                </button>
                <button
                  onClick={handleSkip}
                  disabled={isSubmitting}
                  className="flex items-center justify-center gap-2
                             py-2.5 rounded-lg text-sm font-medium
                             bg-[#1e2736] border border-[#2d3748]
                             text-muted-foreground hover:text-white
                             hover:bg-[#2d3748] transition-colors cursor-pointer
                             disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <SkipForward className="w-4 h-4" />
                  Skip
                </button>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* ── Reject modal ── */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm
                         flex items-center justify-center z-50 p-4">
          <div className="bg-[#0f1623] border border-[#1e2736] rounded-xl
                           p-6 w-full max-w-md space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">
              Reject Label
            </h3>
            <p className="text-sm text-muted-foreground">
              Please provide a reason. This helps track data quality issues.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Image too blurry, incorrect patient data, duplicate..."
              rows={4}
              autoFocus
              className="w-full px-3 py-2.5 rounded-lg border border-[#2d3748]
                         bg-[#1e2736] text-sm text-white
                         placeholder:text-muted-foreground
                         focus:outline-none focus:border-[#4d5768] resize-none"
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false)
                  setRejectReason('')
                }}
                className="flex-1 py-2.5 rounded-lg bg-[#1e2736]
                           border border-[#2d3748] text-muted-foreground
                           text-sm hover:text-white transition-colors
                           cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={isSubmitting || !rejectReason.trim()}
                className="flex-1 py-2.5 rounded-lg bg-red-500/20
                           border border-red-500/40 text-red-400 text-sm
                           font-medium hover:bg-red-500/30 transition-colors
                           cursor-pointer disabled:opacity-50
                           disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Rejecting...' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}