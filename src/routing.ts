import { useCallback, useEffect, useState } from 'react'

export type AppRoute = '/review' | '/results'

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '')

export function appUrl(route: AppRoute) {
  return `${basePath}${route}` || route
}

function currentRoute(): AppRoute {
  const path = window.location.pathname.slice(basePath.length) || '/review'
  return path === '/results' ? '/results' : '/review'
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
