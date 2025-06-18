import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { open } from '@tauri-apps/plugin-shell';

interface Props {
    content: string;
}

export const MarkdownViewer: React.FC<Props> = ({ content }) => {
    return (
        <article className="prose prose-slate prose-sm max-w-none">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    a: ({ href, children }) => (
                        <a
                            href={href}
                            onClick={async (e) => {
                                e.preventDefault()
                                if (href) await open(href)
                            }}
                            style={{ cursor: 'pointer' }}
                        >
                            {children}
                        </a>
                    )
                }}>
                {content}
            </ReactMarkdown>
        </article>
    )
}