import { catalogRequest, type PageResult } from '../../catalog/api'
export type KnowledgeRow = { id: string; title: string; revision: number; activeVersion: string | null; updatedAt: string; versionId: string; version: number; indexStatus: string; topic: string; productSlug: string | null; activeVersionNumber: number | null }
export type Version = { id: string; number: number; content: string; sourceLabel: string; topic: string; productSlug: string | null; evidenceType: string; indexStatus: string; createdAt: string; chunkCount: number; job: { id: string; status: string; attempts: number; errorCode: string | null } | null }
export type KnowledgeDocument = { id: string; title: string; revision: number; activeVersion: string | null; updatedAt: string; versions: Version[]; history: { action: string; versionId: string; actorId: string; createdAt: string }[] }
export type Excerpt = { chunkId: string; title: string; version: number; section: string; content: string; sourceLabel: string; productSlug: string | null }
export const topics: Record<string,string> = { care: 'Chăm sóc & bảo quản', materials: 'Chất liệu', returns: 'Đổi trả', shipping: 'Giao hàng', safety: 'Chứng cứ an toàn', about: 'Về cửa hàng', general: 'Hướng dẫn khác' }
export const statuses: Record<string,string> = { queued: 'Chờ xử lý', running: 'Đang lập chỉ mục', ready: 'Sẵn sàng duyệt', failed: 'Xử lý thất bại' }
export const listKnowledge = (page: number, signal?: AbortSignal) => catalogRequest<PageResult<KnowledgeRow>>('admin/knowledge?page='+page, { signal })
export const getKnowledge = (id: string, signal?: AbortSignal) => catalogRequest<KnowledgeDocument>('admin/knowledge/'+id, { signal })
export const knowledgeCommand = (action: string, payload: unknown) => catalogRequest<KnowledgeDocument>('admin/knowledge'+(action === 'save' ? '' : '/'+action), { method: 'POST', body: JSON.stringify(payload) })
