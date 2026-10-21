import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router-dom'
import { Spinner } from '@/components/ui/controls'
import { useAuth } from '@/features/auth/auth'
import { NotFound } from '@/pages/not-found'

const Landing = lazy(() => import('@/pages/public/landing'))
const Cotar = lazy(() => import('@/pages/public/cotar'))
const Pedido = lazy(() => import('@/pages/public/pedido'))
const Cotacao = lazy(() => import('@/pages/public/cotacao'))
const Login = lazy(() => import('@/pages/auth/login'))
const Entrar = lazy(() => import('@/pages/public/entrar'))
const MinhasCotacoes = lazy(() => import('@/pages/public/minhas-cotacoes'))
const Recuperar = lazy(() => import('@/pages/auth/recuperar'))
const NovaSenha = lazy(() => import('@/pages/auth/nova-senha'))

const PainelLayout = lazy(() => import('@/pages/painel/layout'))
const Dashboard = lazy(() => import('@/pages/painel/dashboard'))
const Tarefas = lazy(() => import('@/pages/painel/tarefas'))
const Tarefa = lazy(() => import('@/pages/painel/tarefa'))
const Compras = lazy(() => import('@/pages/painel/compras'))
const Clientes = lazy(() => import('@/pages/painel/clientes'))
const Cliente = lazy(() => import('@/pages/painel/cliente'))
const BoasVindas = lazy(() => import('@/pages/painel/boas-vindas'))

const AdminLayout = lazy(() => import('@/pages/admin/layout'))
const AdminHome = lazy(() => import('@/pages/admin/home'))
const AdminEmpresa = lazy(() => import('@/pages/admin/empresa'))
const AdminCobranca = lazy(() => import('@/pages/admin/cobranca'))
const AdminCotacao = lazy(() => import('@/pages/admin/regras'))
const AdminLanding = lazy(() => import('@/pages/admin/landing'))
const AdminMensagens = lazy(() => import('@/pages/admin/mensagens'))
const AdminIntegracoes = lazy(() => import('@/pages/admin/integracoes'))
const AdminEquipe = lazy(() => import('@/pages/admin/equipe'))
const AdminCategorias = lazy(() => import('@/pages/admin/categorias'))
const AdminFornecedores = lazy(() => import('@/pages/admin/fornecedores'))
const AdminLogs = lazy(() => import('@/pages/admin/logs'))

export function PageLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner />
    </div>
  )
}

function Lazy() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Outlet />
    </Suspense>
  )
}

function RequireStaff() {
  const { session, profile, loading } = useAuth()
  const location = useLocation()
  if (loading) return <PageLoader />
  if (!session) return <Navigate to="/admin" replace state={{ from: location.pathname }} />
  if (!profile) return <Navigate to="/admin?sem-acesso=1" replace />
  return <Outlet />
}

function RequireAdmin() {
  const { isAdmin, loading } = useAuth()
  if (loading) return <PageLoader />
  if (!isAdmin) return <Navigate to="/painel" replace />
  return <Outlet />
}

export const router = createBrowserRouter([
  {
    element: <Lazy />,
    children: [
      { path: '/', element: <Landing /> },
      { path: '/cotar', element: <Cotar /> },
      { path: '/pedido/:codigo', element: <Pedido /> },
      { path: '/cotacao/:token', element: <Cotacao /> },
      { path: '/login', element: <Entrar /> },
      { path: '/minhas-cotacoes', element: <MinhasCotacoes /> },
      // Equipe: sem link no site, acesso digitando /admin
      { path: '/admin', element: <Login /> },
      { path: '/admin/recuperar-senha', element: <Recuperar /> },
      { path: '/admin/nova-senha', element: <NovaSenha /> },
      {
        element: <RequireStaff />,
        children: [
          {
            path: '/painel',
            element: <PainelLayout />,
            children: [
              { index: true, element: <Dashboard /> },
              { path: 'tarefas', element: <Tarefas /> },
              { path: 'tarefas/:id', element: <Tarefa /> },
              { path: 'compras', element: <Compras /> },
              { path: 'clientes', element: <Clientes /> },
              { path: 'clientes/:id', element: <Cliente /> },
              {
                element: <RequireAdmin />,
                children: [
                  { path: 'boas-vindas', element: <BoasVindas /> },
                  {
                    path: 'admin',
                    element: <AdminLayout />,
                    children: [
                      { index: true, element: <AdminHome /> },
                      { path: 'empresa', element: <AdminEmpresa /> },
                      { path: 'cobranca', element: <AdminCobranca /> },
                      { path: 'cotacao', element: <AdminCotacao /> },
                      { path: 'landing', element: <AdminLanding /> },
                      { path: 'mensagens', element: <AdminMensagens /> },
                      { path: 'integracoes', element: <AdminIntegracoes /> },
                      { path: 'equipe', element: <AdminEquipe /> },
                      { path: 'categorias', element: <AdminCategorias /> },
                      { path: 'fornecedores', element: <AdminFornecedores /> },
                      { path: 'logs', element: <AdminLogs /> },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
])
