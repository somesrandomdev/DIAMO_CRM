import type { UserRole } from '@/stores/authStore'

export const roleHome: Record<UserRole, string> = {
  fontainier: '/ventes/nouvelle',
  commercial: '/analyses',
  administrateur: '/admin/dashboard',
}

export function getRoleHome(role?: UserRole | null): string {
  return role ? roleHome[role] : '/login'
}

export function isKnownRole(role: string | null | undefined): role is UserRole {
  return role === 'fontainier' || role === 'commercial' || role === 'administrateur'
}
