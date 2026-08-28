// components/admin/curation/CurationQueue.tsx
'use client'

import { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  MapPin,
  BarChart2,
  Layers,
  Clock,
  User,
  ChevronRight,
  Inbox,
} from 'lucide-react'
import { CurationLabel } from './types'

interface Props {
  labels: CurationLabel[]
  isRefreshing: boolean
  onClaim: (labelId: string) => Promise<any>
  currentAdminId: string
  claimingId: string | null
}

// ── Claim status helpers ──────────────────────────────────
function getClaimTimeRemaining(claimedAt: string): string {
  const claimed = new Date(claimedAt)
  const expiry  = new Date(claimed.getTime() + 30 * 60 * 1000)
  const remaining = expiry.getTime() - Date.now()

  if (remaining <= 0) return 'Expiring...'
  const mins = Math.floor(remaining / 60000)
  const secs = Math.floor((remaining % 60000) / 1000)
  return `${mins}m ${secs}s`
}

function isClaimExpired(claimedAt: string): boolean {
  const claimed = new Date(claimedAt)
  const expiry  = new Date(claimed.getTime() + 30 * 60 * 1000)
  return Date.now() > expiry.getTime()
}

// ── Annotation type badge ─────────────────────────────────
function AnnotationTypeBadge({ label }: { label: CurationLabel }) {
  const needsBbox   = label.metadata?.needs_bbox_correction
  const needsTirads = label.metadata?.needs_tirads_correction

  if (needsBbox && needsTirads) {
    return (
      <Badge className="bg-orange-500/10 text-orange-400 border-orange-500/20
                        text-xs gap-1">
        <Layers className="w-3 h-3" />
        Both
      </Badge>
    )
  }
  if (needsBbox) {
    return (
      <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20
                        text-xs gap-1">
        <MapPin className="w-3 h-3" />
        BBox
      </Badge>
    )
  }
  if (needsTirads) {
    return (
      <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20
                        text-xs gap-1">
        <BarChart2 className="w-3 h-3" />
        TI-RADS
      </Badge>
    )
  }
  return (
    <Badge className="bg-[#1e2736] text-muted-foreground border-[#2d3748]
                      text-xs">
      Review
    </Badge>
  )
}

// ── Claim indicator ───────────────────────────────────────
function ClaimIndicator({
  label,
  currentAdminId,
}: {
  label: CurationLabel
  currentAdminId: string
}) {
  const [, forceUpdate] = useState(0)

  // ✅ useEffect for timer — not useState
  useEffect(() => {
    if (!label.claimed_at) return
    const interval = setInterval(() => forceUpdate(n => n + 1), 1000)
    return () => clearInterval(interval)
  }, [label.claimed_at])

  if (!label.claimed_by || !label.claimed_at) return null
  if (isClaimExpired(label.claimed_at)) return null

  const isYou    = label.claimed_by === currentAdminId
  const timeLeft = getClaimTimeRemaining(label.claimed_at)

  return (
    <div className={`flex items-center gap-1.5 text-xs
                     ${isYou ? 'text-green-400' : 'text-yellow-400'}`}>
      <Clock className="w-3 h-3" />
      {isYou
        ? `You · ${timeLeft}`
        : `${label.claimer_name ?? 'Admin'} · ${timeLeft}`
      }
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-48 gap-3">
      <Inbox className="w-8 h-8 text-muted-foreground opacity-40" />
      <p className="text-sm text-muted-foreground font-medium">
        No labels pending review
      </p>
      <span className="text-xs text-muted-foreground text-center max-w-xs">
        Labels appear here after doctors submit incorrect feedback
        and the curation script runs.
      </span>
    </div>
  )
}

// ── Single queue row ──────────────────────────────────────
function QueueRow({
  label,
  currentAdminId,
  onClaim,
  isClaiming,
}: {
  label: CurationLabel
  currentAdminId: string
  onClaim: (id: string) => Promise<any>
  isClaiming: boolean
}) {
  const isClaimed = label.claimed_by !== null
    && label.claimed_at !== null
    && !isClaimExpired(label.claimed_at)

  const isClaimedByMe    = label.claimed_by === currentAdminId
  const isClaimedByOther = isClaimed && !isClaimedByMe

  return (
    <div
      className={`flex items-center gap-4 p-4 rounded-lg border
                  transition-colors
                  ${isClaimedByOther
                    ? 'bg-yellow-500/5 border-yellow-500/10 opacity-60'
                    : isClaimedByMe
                    ? 'bg-green-500/5 border-green-500/20'
                    : 'bg-[#0f1623] border-[#1e2736] hover:border-[#2d3748]'
                  }`}
    >
      {/* Image thumbnail */}
      <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden
                      bg-[#1e2736] border border-[#2d3748]">
        {label.image_url ? (
          <img
            src={label.image_url}
            alt="US scan"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-xs text-muted-foreground">No img</span>
          </div>
        )}
      </div>

      {/* Label info */}
      <div className="flex-1 min-w-0 space-y-1.5">

        {/* Row 1: annotation type + claim indicator */}
        <div className="flex items-center gap-2 flex-wrap">
          <AnnotationTypeBadge label={label} />
          <ClaimIndicator label={label} currentAdminId={currentAdminId} />
        </div>

        {/* Row 2: AI vs doctor */}
        <div className="flex items-center gap-4 text-xs">
          <span className="text-muted-foreground">
            AI: <span className="text-white font-medium">
              TR{label.ai_tirads ?? '?'}
            </span>
          </span>
          {label.doctor_tirads && (
            <span className="text-muted-foreground">
              Doctor: <span className="text-yellow-400 font-medium">
                TR{label.doctor_tirads}
              </span>
            </span>
          )}
          {label.bbox_issue && (
            <span className="text-blue-400 text-xs">
              "{label.bbox_issue.replace(/_/g, ' ')}"
            </span>
          )}
        </div>

        {/* Row 3: notes */}
        {label.notes && (
          <p className="text-xs text-muted-foreground truncate max-w-md">
            💬 {label.notes}
          </p>
        )}

        {/* Row 4: metadata */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {label.labeled_by}
          </span>
          <span>
            {new Date(label.created_at).toLocaleDateString([], {
              month: 'short',
              day:   'numeric',
            })}
          </span>
        </div>

      </div>

      {/* Action button */}
      <div className="shrink-0">
        {isClaimedByOther ? (
          <span className="text-xs text-yellow-400 px-3 py-2">
            In Review
          </span>
        ) : (
          <button
            onClick={() => onClaim(label.id)}
            disabled={isClaiming}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm
                        rounded-lg border transition-colors cursor-pointer
                        disabled:opacity-50 disabled:cursor-not-allowed
                        ${isClaimedByMe
                          ? 'bg-green-500/10 border-green-500/20 text-green-400'
                          : 'bg-[#1e2736] border-[#2d3748] text-white hover:bg-[#2d3748]'
                        }`}
          >
            {isClaiming ? (
              <span className="h-4 w-4 animate-spin rounded-full
                               border-2 border-current border-t-transparent" />
            ) : (
              <>
                {isClaimedByMe ? 'Continue' : 'Review'}
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        )}
      </div>

    </div>
  )
}

// ── Main component ────────────────────────────────────────
export default function CurationQueue({
  labels,
  isRefreshing,
  onClaim,
  currentAdminId,
  claimingId,
}: Props) {
  return (
    <Card className={`bg-[#0f1623] border-[#1e2736] transition-opacity
                      ${isRefreshing ? 'opacity-70' : 'opacity-100'}`}>
      <CardContent className="p-4 space-y-3">
        {labels.length === 0 ? (
          <EmptyState />
        ) : (
          labels.map((label) => (
            <QueueRow
              key={label.id}
              label={label}
              currentAdminId={currentAdminId}
              onClaim={onClaim}
              isClaiming={claimingId === label.id}
            />
          ))
        )}
      </CardContent>
    </Card>
  )
}