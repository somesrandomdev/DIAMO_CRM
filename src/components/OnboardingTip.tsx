import { useEffect, useState } from 'react'
import { Lightbulb, X } from 'lucide-react'

/**
 * First-use onboarding tip, dismissible and persisted per role in
 * localStorage. Shows once, never again after dismissal.
 */
export function OnboardingTip({ role, message }: { role: string; message: string }) {
  const storageKey = `diamo-onboarding-${role}`
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(window.localStorage.getItem(storageKey) === null)
  }, [storageKey])

  if (!visible) return null

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border-2 border-[#009EFB]/40 bg-[#E3F3FE] p-3">
      <p className="flex items-start gap-2 text-[13px] text-[#12364D]">
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[#009EFB]" aria-hidden="true" />
        {message}
      </p>
      <button
        type="button"
        aria-label="Fermer l'aide"
        onClick={() => {
          window.localStorage.setItem(storageKey, 'seen')
          setVisible(false)
        }}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#1C5376] hover:bg-white/70"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
