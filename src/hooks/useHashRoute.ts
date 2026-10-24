import { useEffect, useState } from 'react'

export type Route = 'home' | 'text' | 'code' | 'documents' | 'notebooks' | 'images' | 'spreadsheets'

const ROUTES: Route[] = ['home', 'text', 'code', 'documents', 'notebooks', 'images', 'spreadsheets']

function parse(): Route {
  const h = window.location.hash.replace(/^#\/?/, '').split(/[/?]/)[0]
  return (ROUTES as string[]).includes(h) ? (h as Route) : 'home'
}

/** Hash routing keeps the app working on any static host without rewrite rules. */
export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(parse)
  useEffect(() => {
    const on = () => setRoute(parse())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}

export const hrefFor = (r: Route) => (r === 'home' ? '#/' : `#/${r}`)
