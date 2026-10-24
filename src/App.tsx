import { lazy, Suspense } from 'react'
import { Dialogs } from './components/layout/Dialogs'
import { ErrorBoundary } from './components/layout/ErrorBoundary'
import { Footer } from './components/layout/Footer'
import { Header } from './components/layout/Header'
import { Spinner } from './components/ui/Controls'
import { useHashRoute, type Route } from './hooks/useHashRoute'
import { useHotkeys } from './hooks/useHotkeys'
import { useUi } from './lib/ui-context'

const pages: Record<Route, React.LazyExoticComponent<React.ComponentType>> = {
  home: lazy(() => import('./pages/Home')),
  text: lazy(() => import('./pages/TextPage')),
  code: lazy(() => import('./pages/CodePage')),
  documents: lazy(() => import('./pages/DocumentsPage')),
  notebooks: lazy(() => import('./pages/NotebooksPage')),
  images: lazy(() => import('./pages/ImagesPage')),
  spreadsheets: lazy(() => import('./pages/SpreadsheetsPage')),
}

export default function App() {
  const route = useHashRoute()
  const { openDialog } = useUi()
  useHotkeys([{ combo: 'mod+/', handler: () => openDialog('shortcuts') }])
  const Page = pages[route]
  return (
    <div className="flex min-h-dvh flex-col">
      <Header route={route} />
      <main id="main" className="flex-1" tabIndex={-1}>
        <ErrorBoundary key={route}>
          <Suspense
            fallback={
              <div className="flex h-64 items-center justify-center">
                <Spinner size={28} />
              </div>
            }
          >
            <Page />
          </Suspense>
        </ErrorBoundary>
      </main>
      <Footer />
      <Dialogs />
    </div>
  )
}
