import type { UserRole } from '@/stores/authStore'

export const roleHome: Record<UserRole, string> = {
  fontainier: '/ventes/nouvelle',
  commercial: '/commercial',
  administrateur: '/admin/dashboard',
}

export function getRoleHome(role?: UserRole | null): string {
  return role ? roleHome[role] : '/login'
}
