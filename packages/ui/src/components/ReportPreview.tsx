import ReactMarkdown from 'react-markdown'

interface Props {
  content: string
}

export function ReportPreview({ content }: Props) {
  if (!content) {
    return (
      <div style={emptyStyle}>
        No report generated yet. Click <strong>Generate All</strong>.
      </div>
    )
  }

  return (
    <div style={wrapStyle}>
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  )
}

const emptyStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: 200,
  color: '#94a3b8',
  fontSize: '0.9rem',
}

const wrapStyle: React.CSSProperties = {
  padding: '1.5rem',
  overflow: 'auto',
  fontSize: '0.9rem',
  lineHeight: 1.6,
}
