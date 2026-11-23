import { Link } from 'react-router-dom'
import type { AdminExchange } from '../features/admin-ai/useAdminAssistant'

const date = (value: string) => value.split('-').reverse().join('/')
export default function AdminAiAnswer({ entry }: { entry: AdminExchange }) {
  const { answer } = entry
  return (
    <article className="admin-ai-exchange" aria-labelledby={'admin-question-' + entry.id}>
      <div className="admin-ai-question">
        <span>Bạn</span>
        <h2 id={'admin-question-' + entry.id}>{entry.question}</h2>
      </div>
      <div className="admin-ai-answer">
        <div className="admin-ai-answer-label">
          <span>Trợ lý Nàng Gốm</span>
          <time dateTime={answer.generatedAt}>
            {new Date(answer.generatedAt).toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'Asia/Ho_Chi_Minh',
            })}
          </time>
        </div>
        <p>{answer.message}</p>
        <small className="admin-ai-period">
          Kỳ doanh thu {date(answer.from)} – {date(answer.to)} · Tồn kho và hàng đợi tại thời điểm
          trả lời{answer.isDemo ? ' · Dữ liệu DEMO' : ''}
        </small>
        {answer.insights.length > 0 && (
          <div className="admin-ai-facts">
            {answer.insights.map((fact) => (
              <Link to={fact.url} key={fact.id}>
                <span>{fact.title}</span>
                <strong>{fact.value}</strong>
                <p>{fact.detail}</p>
                <small>Xem dữ liệu liên quan</small>
              </Link>
            ))}
          </div>
        )}
        {!!answer.plans?.length && (
          <section className="admin-ai-sources" aria-label="Giải pháp đề xuất">
            <h3>Phân tích & giải pháp</h3>
            {answer.plans.map((plan, index) => (
              <div className="admin-ai-question" key={index}>
                <h3>{plan.title}</h3>
                <p>{plan.reason}</p>
                <ol>
                  {plan.steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
                <small>
                  Căn cứ:{' '}
                  {plan.factIds
                    .map((id) => answer.insights.find((f) => f.id === id))
                    .filter((f) => !!f)
                    .map((f) => `${f.title}: ${f.value}`)
                    .join(' · ')}
                </small>
              </div>
            ))}
          </section>
        )}
        {answer.sources.length > 0 && (
          <section className="admin-ai-sources" aria-label="Nguồn câu trả lời">
            <h3>Định nghĩa & nguồn đối chiếu</h3>
            {answer.sources.map((source) => (
              <details key={source.url + source.version} open>
                <summary>
                  {source.title}
                  <small>{source.version}</small>
                </summary>
                <blockquote>{source.content}</blockquote>
                <Link to={source.url}>Mở nguồn & màn hình liên quan</Link>
              </details>
            ))}
          </section>
        )}
      </div>
    </article>
  )
}
