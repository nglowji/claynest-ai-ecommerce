import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { AuthError } from '../../auth/api'
import { askAdmin, type AdminAnswer, type AdminQuestion } from './api'

export type AdminExchange = { id: number; question: string; answer: AdminAnswer }
export function useAdminAssistant() {
  const auth = useAuth()
  const request = useRef<AbortController | null>(null)
  const last = useRef<AdminQuestion | null>(null)
  const sequence = useRef(0)
  const [entries, setEntries] = useState<AdminExchange[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => () => request.current?.abort(), [])
  function stop() {
    request.current?.abort()
    request.current = null
    setBusy(false)
    setNotice('Đã dừng yêu cầu. Bạn có thể đặt câu hỏi khác.')
  }
  async function ask(question: AdminQuestion) {
    if (request.current || !question.message.trim()) return false
    const controller = new AbortController()
    request.current = controller
    last.current = question
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const answer = await askAdmin(question, controller.signal)
      if (controller.signal.aborted) return false
      setEntries((current) =>
        [...current, { id: ++sequence.current, question: question.message, answer }].slice(-8),
      )
      return true
    } catch (failure) {
      if (!controller.signal.aborted) {
        if (failure instanceof AuthError && failure.status === 401) auth.expire()
        setError(failure instanceof Error ? failure.message : 'Chưa kết nối được trợ lý quản trị.')
      }
      return false
    } finally {
      if (request.current === controller) {
        request.current = null
        setBusy(false)
      }
    }
  }
  function clear() {
    stop()
    setEntries([])
    last.current = null
    setError('')
    setNotice('Đã bắt đầu phiên hỏi đáp mới.')
  }
  return {
    entries,
    busy,
    error,
    notice,
    ask,
    stop,
    clear,
    retry: () => last.current && void ask(last.current),
  }
}
