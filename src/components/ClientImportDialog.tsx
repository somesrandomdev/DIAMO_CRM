import { useEffect, useRef, useState } from 'react'
import Papa from 'papaparse'
import { FileUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { normalizePhone } from '@/lib/phone'
import { logAudit } from '@/lib/audit'
import { useToast } from '@/components/Toast'
import { handleSupabaseError, supabase } from '@/lib/supabase'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/input'

interface ClientImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Kiosk the imported clients are attached to. */
  kiosqueId: string
  /** Called after a successful import so the parent can refresh its list. */
  onImported: () => void
}

type FieldKey = 'nom' | 'telephone' | 'email' | 'adresse'

const FIELDS: { key: FieldKey; label: string; guesses: string[] }[] = [
  { key: 'nom', label: 'Nom *', guesses: ['nom', 'name', 'client', 'nom du client'] },
  { key: 'telephone', label: 'Téléphone', guesses: ['telephone', 'tel', 'phone', 'numero', 'mobile'] },
  { key: 'email', label: 'Email', guesses: ['email', 'mail', 'e-mail', 'courriel'] },
  { key: 'adresse', label: 'Adresse', guesses: ['adresse', 'address', 'localite', 'quartier'] },
]
type Row = Record<string, string | undefined>

/**
 * CSV client import: parse with column auto-detection, preview the first
 * rows, map columns manually if needed, validate (nom required), optionally
 * skip invalid rows, then batch-insert.
 */
export function ClientImportDialog({ open, onOpenChange, kiosqueId, onImported }: ClientImportDialogProps) {
  const { showToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [mapping, setMapping] = useState<Record<FieldKey, string>>({
    nom: '',
    telephone: '',
    email: '',
    adresse: '',
  })
  const [skipInvalid, setSkipInvalid] = useState(true)
  const [skipDuplicates, setSkipDuplicates] = useState(true)
  /** Normalized phones already present in the TARGET kiosk (per-kiosk uniqueness). */
  const [kioskPhones, setKioskPhones] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const [isImporting, setIsImporting] = useState(false)

  useEffect(() => {
    if (!open) return
    setFileName('')
    setHeaders([])
    setRows([])
    setMapping({ nom: '', telephone: '', email: '', adresse: '' })
    setError('')
    setIsImporting(false)
    setKioskPhones(new Set())
  }, [open])

  // Existing phones of the target kiosk — duplicates are only flagged against
  // THIS kiosk (the same client in another kiosk is allowed by design).
  useEffect(() => {
    if (!open || !kiosqueId) return
    let cancelled = false
    supabase
      .from('clients')
      .select('telephone')
      .eq('kiosque_id', kiosqueId)
      .then(({ data, error }) => {
        if (cancelled || error) return
        setKioskPhones(new Set((data ?? []).map((row) => normalizePhone(row.telephone))))
      })
    return () => {
      cancelled = true
    }
  }, [open, kiosqueId])

  const handleFile = (file: File) => {
    setFileName(file.name)
    setError('')

    Papa.parse<Row>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const fields = results.meta.fields ?? []
        setHeaders(fields)
        setRows(results.data)

        // Auto-detect each field from common column names (case-insensitive).
        setMapping((current) => {
          const next = { ...current }
          for (const field of FIELDS) {
            const match = fields.find(
              (header) => field.guesses.includes(header.trim().toLowerCase()) ||
                field.guesses.some((guess) => header.trim().toLowerCase() === guess)
            )
            next[field.key] = match ?? ''
          }
          return next
        })
      },
      error: () => {
        setError("Le fichier n'a pas pu être lu. Est-ce bien un CSV ?")
      },
    })
  }

  const mappedRows = rows.map((row) => ({
    nom: (mapping.nom ? row[mapping.nom] ?? '' : '').trim(),
    telephone: (mapping.telephone ? row[mapping.telephone] ?? '' : '').trim() || null,
    email: (mapping.email ? row[mapping.email] ?? '' : '').trim() || null,
    adresse: (mapping.adresse ? row[mapping.adresse] ?? '' : '').trim() || null,
  }))

  // Duplicate = normalized phone already in the target kiosk OR already seen
  // earlier in the CSV itself. Per-kiosk scope: another kiosk's number is fine.
  const seenPhones = new Set<string>()
  const isDuplicate = (row: (typeof mappedRows)[number]): boolean => {
    const phone = normalizePhone(row.telephone)
    if (!phone) return false
    if (kioskPhones.has(phone)) return true
    if (seenPhones.has(phone)) return true
    return false
  }
  const duplicateFlags = mappedRows.map((row) => {
    const dup = isDuplicate(row)
    const phone = normalizePhone(row.telephone)
    if (phone && !dup) seenPhones.add(phone)
    return dup
  })

  const validRows = mappedRows.filter((row) => row.nom.length > 0)
  const invalidCount = mappedRows.length - validRows.length
  const duplicateCount = validRows.filter((_, index) => duplicateFlags[index]).length

  const importClients = async () => {
    if (!mapping.nom) {
      setError('Associez la colonne du nom avant de continuer.')
      return
    }
    if (validRows.length === 0) {
      setError('Aucune ligne valide (le nom est obligatoire).')
      return
    }
    if (invalidCount > 0 && !skipInvalid) {
      setError(`${invalidCount} ligne(s) invalide(s) — cochez « ignorer » ou corrigez le fichier.`)
      return
    }

    const nonDuplicateRows = validRows.filter((_, index) => !duplicateFlags[index])
    if (duplicateCount > 0 && !skipDuplicates) {
      setError(
        `${duplicateCount} doublon(s) détecté(s) dans ce kiosque — cochez « Ignorer les doublons » ou retirez-les du fichier.`
      )
      return
    }

    setIsImporting(true)
    const toInsert = nonDuplicateRows.map((row) => ({
      ...row,
      // Normalized digits: matches duplicate checks and login resolution.
      telephone: normalizePhone(row.telephone),
      kiosque_id: kiosqueId,
    }))

    // Insert in chunks: PostgREST payload limits apply to very large CSVs.
    let inserted = 0
    let failure: { code?: string; message: string } | null = null
    for (let index = 0; index < toInsert.length && !failure; index += 500) {
      const { error: insertError } = await supabase
        .from('clients')
        .insert(toInsert.slice(index, index + 500))
      if (insertError) {
        failure = insertError
      } else {
        inserted += Math.min(500, toInsert.length - index)
      }
    }
    setIsImporting(false)

    if (failure) {
      console.error('Client import failed:', failure)
      setError(handleSupabaseError(failure))
      return
    }

    showToast({
      type: 'success',
      title: 'Import réussi',
      message:
        `${inserted} client(s) importé(s)` +
        (duplicateCount > 0 && skipDuplicates ? `, ${duplicateCount} doublon(s) ignoré(s)` : '') +
        (invalidCount > 0 ? `, ${invalidCount} ligne(s) invalide(s) ignorée(s)` : '') +
        '.',
    })
    await logAudit('clients.import', 'clients', kiosqueId, {
      nb: inserted,
      doublonsIgnores: duplicateCount,
      invalidesIgnores: invalidCount,
      fichier: fileName,
    })
    onOpenChange(false)
    onImported()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importer des clients (CSV)</DialogTitle>
          <DialogDescription>
            Colonnes reconnues automatiquement : nom, téléphone, email, adresse. Le nom est
            obligatoire.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) handleFile(file)
            }}
          />
          <Button
            type="button"
            variant="outline" size="touch"
            className="w-full"
            onClick={() => fileInputRef.current?.click()}
          >
            <FileUp className="h-4 w-4" />
            {fileName || 'Choisir un fichier CSV'}
          </Button>

          {headers.length > 0 && (
            <>
              <div className="space-y-3">
                <Label variant="caps">Colonnes du fichier</Label>
                {FIELDS.map((field) => (
                  <div key={field.key} className="space-y-1.5">
                    <Label variant="caps" htmlFor={`map-${field.key}`}>{field.label}</Label>
                    <Select fieldSize="lg"
                      id={`map-${field.key}`}
                      value={mapping[field.key]}
                      onChange={(event) =>
                        setMapping((current) => ({ ...current, [field.key]: event.target.value }))
                      }
                    >
                      <option value="">—</option>
                      {headers.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </Select>
                  </div>
                ))}
              </div>

              <div className="rounded-md border border-border bg-bg p-3">
                <Label variant="caps" className="mb-2">Aperçu (5 premières lignes)</Label>
                <div className="space-y-1 text-sm">
                  {mappedRows.slice(0, 5).map((row, index) => (
                    <p key={index} className="truncate">
                      <span
                        className={
                          !row.nom || duplicateFlags[index]
                            ? 'font-semibold text-red'
                            : 'font-semibold text-text'
                        }
                      >
                        {row.nom || '(sans nom — sera ignorée)'}
                        {duplicateFlags[index] ? ' — doublon dans ce kiosque' : ''}
                      </span>
                      {row.telephone ? <span className="text-text-secondary"> - {row.telephone}</span> : null}
                    </p>
                  ))}
                </div>
                <p className="mt-2 text-xs text-text-secondary [font-variant-numeric:tabular-nums]">
                  {validRows.length} ligne(s) valide(s), {invalidCount} invalide(s)
                  {duplicateCount > 0 ? `, ${duplicateCount} doublon(s)` : ''}.
                </p>
                {duplicateCount > 0 && (
                  <label className="mt-2 flex min-h-12 items-center gap-2 text-sm text-text">
                    <input
                      type="checkbox"
                      checked={skipDuplicates}
                      onChange={(event) => setSkipDuplicates(event.target.checked)}
                      className="h-5 w-5"
                    />
                    Ignorer les doublons
                  </label>
                )}
                {invalidCount > 0 && (
                  <label className="mt-2 flex min-h-12 items-center gap-2 text-sm text-text">
                    <input
                      type="checkbox"
                      checked={skipInvalid}
                      onChange={(event) => setSkipInvalid(event.target.checked)}
                      className="h-5 w-5"
                    />
                    Ignorer les lignes invalides
                  </label>
                )}
              </div>
            </>
          )}

          {error && <p className="text-sm font-medium text-red">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" size="touch" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            type="button"
            variant="primary" size="touch"
            loading={isImporting} loadingText="Import…"
            disabled={rows.length === 0}
            onClick={importClients}
          >
            Importer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
