import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { Toaster } from 'sonner'

export function AppShell() {
  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <Header />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'hsl(var(--card))',
            color: 'hsl(var(--card-foreground))',
            border: '1px solid hsl(var(--border))',
          },
        }}
      />
      <main className="max-w-[1600px] mx-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
