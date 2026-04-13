import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { Toaster } from 'sonner'
import Container from 'react-bootstrap/Container'

export function AppShell() {
  return (
    <>
      <Header />
      <Toaster position="top-right" richColors />
      <Container fluid className="py-4 px-3 px-md-4" style={{ maxWidth: 1400 }}>
        <Outlet />
      </Container>
    </>
  )
}
