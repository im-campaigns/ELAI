'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'

/**
 * 채팅 말풍선용 마크다운 렌더러. rehype-sanitize로 위험한 태그/속성(script, onClick 등)을
 * 모두 걸러낸 뒤에만 렌더링하고, 링크는 항상 새 탭 + noreferrer로 강제한다.
 * raw HTML을 신뢰해서 그대로 그리는 동작(dangerouslySetInnerHTML 등)은 쓰지 않는다.
 */
export default function ChatMarkdown({ content }: { content: string }) {
  return (
    <div className="space-y-1 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-4 [&_ol]:pl-4 [&_li]:my-0.5 [&_p]:m-0 [&_strong]:font-bold [&_a]:underline [&_a]:break-all">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          a: ({ ...props }) => <a {...props} target="_blank" rel="noreferrer noopener" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
