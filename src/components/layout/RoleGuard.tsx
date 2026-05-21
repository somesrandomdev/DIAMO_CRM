import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore, type UserRole } from '@/stores/authStore'

interface RoleGuardProps {
  allowedRoles: UserRole[]
  children?: ReactNode
}

export function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const { profile } = useAuthStore()
  const location = useLocation()

  if (!profile) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (!allowedRoles.includes(profile.role)) {
    return <Navigate to="/unauthorized" replace state={{ from: location.pathname }} />
  }

  return children ? <>{children}</> : <Outlet />
}
