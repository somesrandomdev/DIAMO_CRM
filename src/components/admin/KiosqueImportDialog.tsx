import { useEffect, useRef, useState } from 'react'
import Papa from 'papaparse'
import { FileUp, Save } from 'lucide-react'
import { useToast } from '@/components/Toast'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PosLabel } from '@/components/pos'
import { logAudit } from '@/lib/audit'
import { validateKiosqueRows, type KiosqueImportRow } from '@/lib/kiosqueImport'
import { resolveTypeCode, type KiosqueType } from '@/lib/kiosqueTypes'
import { supabase } from '@/lib/supabase'

interface KiosqueImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Noms des kiosques déjà en base (détection de doublons). */
  baseNames: string[]
  /** Types disponibles (résolution type_code du CSV). */
  types: KiosqueType[]
  /** Called after a successful import so the parent can refresh. */
  onImported: () => void
}

interface ParsedRow extends KiosqueImportRow {
  typeRaw: string
}

/**
 * CSV import v2 for kiosques: colonnes nom, adresse, type_code.
 * - type vide → NULL ; code inconnu → essai par label insensible à la casse ;
 *   toujours inconnu → ligne rouge (à créer d'abord via Créer un kiosque).
 * - doublons (fichier + base) en rouge, "ignorer les doublons" par défaut.
 * - audit 'kiosques.import' {nb, nb_sans_type}.
 */
export function KiosqueImportDialog({ open, onOpenChange, baseNames, types, onImported }: KiosqueImportDialogProps) {
  const { showToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [skipDuplicates, setSkipDuplicates] = useState(true)
  const [error, setError] = useState('')
  const [isImporting, setIsImporting] = useState(false)

  useEffect(() => {
    if (!open) return
    setFileName('')
    setRows([])
    setError('')
    setIsImporting(false)
  }, [open])

  const handleFile = (file: File) => {
    setFileName(file.name)
    setError('')

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError(
        "Ouvrez le modèle dans Excel, complétez-le, puis Enregistrer sous → CSV UTF-8. Les fichiers Excel ne sont pas importables directement."
      )
      return
    }

    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const mapped = (results.data ?? [])
          .map((raw) => ({
            nom: String(raw['nom'] ?? raw['Nom'] ?? '').trim(),
            adresse: String(raw['adresse'] ?? raw['Adresse'] ?? '').trim(),
            typeRaw: String(raw['type_code'] ?? raw['type'] ?? '').trim(),
          }))
          .filter((row) => row.nom !== '' || row.adresse !== '')
        setRows(mapped)
      },
      error: () => {
        setError("Le fichier n'a pas pu être lu. Est-ce bien un CSV ?")
      },
    })
  }

  const validation = validateKiosqueRows(rows, baseNames)
  const { duplicateFlags, invalidCount, duplicateCount } = validation

  /** Résolution de type par ligne (flags alignés sur rows). */
  const typeResolutions = rows.map((row) => resolveTypeCode(row.typeRaw, types))
  const unknownTypeFlags = typeResolutions.map((r) => r.unknown)
  const unknownTypeCount = rows.filter((_, index) => unknownTypeFlags[index]).length

  const insertable = rows.filter((_, index) => {
    if (!rows[index].nom) return false
    if (skipDuplicates && duplicateFlags[index]) return false
    if (unknownTypeFlags[index]) return false
    return true
  })
  const sansTypeCount = insertable.filter((row) => !resolveTypeCode(row.typeRaw, types).code).length

  const importKiosques = async () => {
    if (rows.length === 0) {
      setError('Choisissez d’abord un fichier CSV.')
      return
    }
    if (validation.valid.length === 0) {
      setError('Aucune ligne valide (le nom est obligatoire).')
      return
    }
    if (duplicateCount > 0 && !skipDuplicates) {
      setError(
        `${duplicateCount} doublon(s) détecté(s) — cochez « Ignorer les doublons » ou retirez-les du fichier.`
      )
      return
    }
    const firstUnknown = rows.find((_, index) => unknownTypeFlags[index])
    if (firstUnknown) {
      setError(
        `Type inconnu : ${firstUnknown.typeRaw} — ajoutez-le d'abord via Créer un kiosque.`
      )
      return
    }

    setIsImporting(true)
    const { error: insertError } = await supabase
      .from('kiosques')
      .insert(
        insertable.map((row) => ({
          nom: row.nom,
          adresse: row.adresse || null,
          type_code: resolveTypeCode(row.typeRaw, types).code,
        }))
      )
    setIsImporting(false)

    if (insertError) {
      console.error('Kiosque import failed:', insertError)
      setError(insertError.message || "L'import a échoué.")
      return
    }

    await logAudit('kiosques.import', 'kiosques', null, {
      nb: insertable.length,
      nb_sans_type: sansTypeCount,
      doublonsIgnores: skipDuplicates ? duplicateCount : 0,
      fichier: fileName,
    })

    showToast({
      type: 'success',
      title: 'Import réussi',
      message: `${insertable.length} kiosque(s) importé(s), ${duplicateCount} ignoré(s), ${invalidCount + unknownTypeCount} erreur(s).`,
    })
    onOpenChange(false)
    onImported()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importer des kiosques (CSV)</DialogTitle>
          <DialogDescription>
            Colonnes : <span className="font-semibold">nom</span> (obligatoire),{' '}
            <span className="font-semibold">adresse</span> et{' '}
            <span className="font-semibold">type_code</span> (KEP, KEF… — vide = sans type).
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
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="pos-secondary"
              className="flex-1"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileUp className="h-4 w-4" />
              {fileName || 'Choisir un fichier CSV'}
            </Button>
            <Button type="button" variant="default" onClick={downloadTemplate}>
              <Save className="h-4 w-4" />
              Télécharger le modèle
            </Button>
          </div>

          {rows.length > 0 && (
            <div className="rounded-md border border-[#DCE1E5] bg-[#F6F9FB] p-3">
              <PosLabel className="mb-2">Apercu (5 premieres lignes)</PosLabel>
              <div className="space-y-1 text-[13px]">
                {rows.slice(0, 5).map((row, index) => {
                  const unknownType = unknownTypeFlags[index]
                  return (
                    <p key={index} className="truncate">
                      <span
                        className={
                          !row.nom || duplicateFlags[index]
                            ? 'font-semibold text-[#FF4949]'
                            : 'font-semibold text-[#12364D]'
                        }
                      >
                        {row.nom || '(nom manquant — sera ignorée)'}
                        {duplicateFlags[index] ? ' — doublon' : ''}
                      </span>
                      {row.adresse ? <span className="text-[#1C5376]"> - {row.adresse}</span> : null}
                      {unknownType ? (
                        <span className="font-semibold text-[#FF4949]">
                          {' '}
                          — Type inconnu : {row.typeRaw} — ajoutez-le d'abord via Créer un kiosque
                        </span>
                      ) : row.typeRaw ? (
                        <span className="text-[#1C5376]">
                          {' '}
                          [{resolveTypeCode(row.typeRaw, types).code}]
                        </span>
                      ) : (
                        <span className="text-[#7D94A6]"> — (sans type)</span>
                      )}
                    </p>
                  )
                })}
              </div>
              <p className="mt-2 text-xs text-[#1C5376] [font-variant-numeric:tabular-nums]">
                {validation.valid.length} ligne(s) valide(s), {invalidCount} invalide(s)
                {duplicateCount > 0 ? `, ${duplicateCount} doublon(s)` : ''}
                {unknownTypeCount > 0 ? `, ${unknownTypeCount} type(s) inconnu(s)` : ''}.
              </p>
              {duplicateCount > 0 && (
                <label className="mt-2 flex min-h-12 items-center gap-2 text-[13px] text-[#12364D]">
                  <input
                    type="checkbox"
                    checked={skipDuplicates}
                    onChange={(event) => setSkipDuplicates(event.target.checked)}
                    className="h-5 w-5"
                  />
                  Ignorer les doublons
                </label>
              )}
            </div>
          )}

          {error && <p className="text-sm font-medium text-[#FF4949]">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="pos-secondary" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            type="button"
            variant="pos-primary"
            loading={isImporting}
            disabled={rows.length === 0}
            onClick={importKiosques}
          >
            Importer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function downloadTemplate() {
  // UTF-8 BOM so Excel opens accents correctly. 2 lignes d'exemple dont une KEF.
  const bom = '\uFEFF'
  const csv = `${bom}nom,adresse,type_code\nKeur Massar En Propre,Keur massar,KEP\nKiosque Sacre coeur Franchise,Sacre coeur,KEF\n`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'modele-kiosques.csv'
  link.click()
  window.URL.revokeObjectURL(url)
}
