import { useCallback, useEffect, useState } from 'react'
import { RotateCcw, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { useToast } from '@/components/Toast'
import { logAudit } from '@/lib/audit'
import { handleSupabaseError, supabase } from '@/lib/supabase'
import { formatPhone } from '@/lib/phone'
import type { UserRole } from '@/stores/authStore'
import { Input } from '@/components/ui/input'

interface DeletedProfileRow {
  id: string
  username: string
  role: UserRole
  phone: string | null
  deleted_at: string
}

const roleLabels: Record<UserRole, string> = {
  administrateur: 'Administrateur',
  commercial: 'Commercial',
  fontainier: 'Fontainier',
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/** Admin corbeille: soft-deleted profiles, restorable or permanently deletable. */
export default function AdminCorbeillePage() {
  const { showToast } = useToast()
  const [rows, setRows] = useState<DeletedProfileRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [restoring, setRestoring] = useState<DeletedProfileRow | null>(null)
  const [isRestoring, setIsRestoring] = useState(false)
  const [deleting, setDeleting] = useState<DeletedProfileRow | null>(null)
  const [confirmName, setConfirmName] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const load = useCallback(async () => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, role, phone, deleted_at')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })

    if (error) {
      console.error('Error loading corbeille:', error.code, error.message)
      showToast({
        type: 'error',
        title: 'Chargement impossible',
        message: 'La corbeille n’a pas pu être chargée. Veuillez réessayer.',
      })
    }
    setRows((data ?? []) as DeletedProfileRow[])
    setIsLoading(false)
  }, [showToast])

  useEffect(() => {
    load()
  }, [load])

  const restore = async () => {
    if (!restoring) return
    setIsRestoring(true)

    const { error } = await supabase
      .from('profiles')
      .update({ deleted_at: null })
      .eq('id', restoring.id)

    setIsRestoring(false)

    if (error) {
      console.error('Restore failed:', error.code, error.message)
      showToast({
        type: 'error',
        title: 'Restauration impossible',
        message:
          error.code === '23505'
            ? 'Impossible : un autre compte utilise déjà ce numéro de téléphone.'
            : handleSupabaseError(error),
      })
      return
    }

    await logAudit('user.restore', 'profiles', restoring.id, { username: restoring.username })
    showToast({
      type: 'success',
      title: 'Utilisateur restauré',
      message: `${restoring.username} est de nouveau actif.`,
    })
    setRestoring(null)
    await load()
  }

  const deletePermanently = async () => {
    if (!deleting) return
    setIsDeleting(true)
    setDeleteError('')

    try {
      const { error: fnError } = await supabase.functions.invoke('admin-delete-user', {
        body: { userId: deleting.id },
      })

      if (fnError) {
        // FunctionsHttpError carries the response status in error.context.
        const status = (fnError as { context?: { status?: number } }).context?.status ?? 0
        let detail = ''
        try {
          const body = await (fnError as unknown as { context: Response }).context.json()
          detail = body?.details ?? body?.error ?? ''
        } catch {
          /* body not JSON */
        }
        console.error('Permanent delete failed:', status, detail)
        setDeleteError(detail || 'La suppression a échoué.')
        showToast({
          type: 'error',
          title: status === 409 ? 'Suppression bloquée' : 'Suppression impossible',
          message:
            status === 409
              ? `Impossible : ${detail || 'cet utilisateur est encore référencé par d’autres données.'}`
              : 'La suppression définitive a échoué. Veuillez réessayer.',
        })
        setIsDeleting(false)
        return
      }

      await logAudit('user.permanent_delete_ack', 'profiles', deleting.id, {
        username: deleting.username,
      })
      showToast({
        type: 'success',
        title: 'Utilisateur supprimé définitivement',
        message: `${deleting.username} a été supprimé définitivement.`,
      })
      setDeleting(null)
      setConfirmName('')
      await load()
    } finally {
      setIsDeleting(false)
    }
  }

  const columns: DataTableColumn<DeletedProfileRow>[] = [
    { key: 'username', header: 'Utilisateur', render: (row) => <span className="font-medium">{row.username}</span>, sortValue: (row) => row.username },
    { key: 'role', header: 'Rôle', render: (row) => <StatusBadge variant={row.role === 'administrateur' ? 'info' : row.role === 'commercial' ? 'success' : 'warning'}>{roleLabels[row.role]}</StatusBadge>, sortValue: (row) => row.role },
    { key: 'phone', header: 'Téléphone', render: (row) => formatPhone(row.phone ?? '') || '—', sortValue: (row) => row.phone ?? '' },
    {
      key: 'deleted_at',
      header: 'Supprimé le',
      render: (row) => formatDate(row.deleted_at),
      sortValue: (row) => row.deleted_at,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline" size="touch"
            onClick={() => setRestoring(row)}
          >
            <RotateCcw className="h-4 w-4" />
            Restaurer
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              setDeleting(row)
              setConfirmName('')
            }}
          >
            <Trash2 className="h-4 w-4" />
            Supprimer définitivement
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-semibold text-text">Corbeille</h1>
        <p className="text-xs text-text-secondary">
          Utilisateurs désactivés. Restaurez-les ou supprimez-les définitivement.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Utilisateurs dans la corbeille</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((item) => <Skeleton key={item} className="h-12" />)}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState title="Corbeille vide" description="Aucun utilisateur désactivé pour le moment." />
          ) : (
            <DataTable columns={columns} data={rows} getRowKey={(row) => row.id} />
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={restoring !== null}
        onOpenChange={(open) => !open && setRestoring(null)}
        title="Restaurer cet utilisateur ?"
        description={`${restoring?.username ?? ''} redeviendra immédiatement actif avec son rôle et son kiosque d'origine.`}
        confirmLabel="Restaurer"
        busyLabel="Restauration…"
        cancelLabel="Annuler"
        isBusy={isRestoring}
        onConfirm={restore}
      />

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && (setDeleting(null), setConfirmName(''))}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Suppression définitive</DialogTitle>
            <DialogDescription>
              {deleting?.username ?? ''} ({roleLabels[deleting?.role ?? 'fontainier']}) sera supprimé
              avec son compte d'authentification. Action IRRÉVERSIBLE — tapez son nom pour
              confirmer.
            </DialogDescription>
          </DialogHeader>
          {deleteError && <p className="text-sm font-medium text-red">{deleteError}</p>}
          <Input fieldSize="lg"
            value={confirmName}
            onChange={(event) => setConfirmName(event.target.value)}
            placeholder={deleting?.username ?? ''}
            aria-label="Tapez le nom de l'utilisateur pour confirmer"
          />
          <Button
            type="button"
            variant="destructive" size="touch"
            className="w-full"
            disabled={confirmName.trim().toLowerCase() !== (deleting?.username ?? '').trim().toLowerCase()}
            loading={isDeleting} loadingText="Suppression…"
            onClick={deletePermanently}
          >
            <Trash2 className="h-4 w-4" />
            Supprimer définitivement
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
