import { catalogRequest } from '../../catalog/api'
export type AdminQuestion = { message: string; days: number }
export type AdminAnswer = {
  message: string
  from: string
  to: string
  generatedAt: string
  isDemo: boolean
  insights: { id: string; title: string; value: string; detail: string; url: string }[]
  sources: { title: string; version: string; content: string; url: string }[]
}
export const askAdmin = (question: AdminQuestion, signal: AbortSignal) =>
  catalogRequest<AdminAnswer>(
    'admin/assistant',
    {
      method: 'POST',
      body: JSON.stringify(question),
      signal,
    },
    60000,
  )
