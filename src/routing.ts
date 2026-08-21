import { useCallback, useEffect, useState } from 'react'

export type AppRoute = '/review' | '/review/new' | '/results' | `/review/${string}` | `/rules/${string}`

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '')

export function appUrl(route: AppRoute) {
  return `${basePath}${route}` || route
}

function currentRoute(): AppRoute {
  const path = window.location.pathname.slice(basePath.length) || '/review'
  if (path === '/results' || path === '/review/new' || path.startsWith('/review/') || path.startsWith('/rules/')) {
    return path as AppRoute
  }
  return '/review'
}

export function ruleSetIdFromRoute(route: string) {
  const match = route.match(/^\/rules\/([^/]+)$/)
  return match ? decodeURIComponent(match[1]) : null
}

export function useAppRoute() {
  const [route, setRoute] = useState<AppRoute>(currentRoute)

  useEffect(() => {
    const onPopState = () => setRoute(currentRoute())
    window.addEventListener('popstate', onPopState)
    if (window.location.pathname !== appUrl(route)) {
      window.history.replaceState({}, '', appUrl(route))
    }
    return () => window.removeEventListener('popstate', onPopState)
  }, [route])

  const navigate = useCallback((nextRoute: AppRoute, replace = false) => {
    window.history[replace ? 'replaceState' : 'pushState']({}, '', appUrl(nextRoute))
    setRoute(nextRoute)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  return { route, navigate }
}
