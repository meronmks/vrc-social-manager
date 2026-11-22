import { MarkdownViewer } from '@/libs/markdownviewer'
import { createCallable } from 'react-call'
import { useTranslation } from 'react-i18next'

interface Props {
  version: string
  releaseNotes?: string
}

type Response = boolean

const UNMOUNTING_DELAY = 300;

// アップデートの確認ダイアログ。見た目は styles.css の .app-dialog（アプリのカードと同じ配色）。
export const UpdateConfirm = createCallable<Props, Response>(({ call, version, releaseNotes }) => {
  const { t } = useTranslation();

  return (
    <div
      className={`app-dialog ${call.ended ? 'exit-animation' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="update-confirm-title"
    >
      <div className="app-dialog-card">
        <h2 id="update-confirm-title">{t('updateConfirm.title')}</h2>
        <p>{t('updateConfirm.newVersion', { version })}</p>
        {releaseNotes && (
          <section className="app-dialog-notes">
            <h3>{t('updateConfirm.releaseNotes')}</h3>
            <MarkdownViewer content={releaseNotes} />
          </section>
        )}
        <p className="app-dialog-hint">{t('updateConfirm.restartMessage')}</p>
        <div className="app-dialog-actions">
          <button className="quiet-action" onClick={() => call.end(false)}>
            {t('updateConfirm.later')}
          </button>
          <button className="primary-action" onClick={() => call.end(true)} autoFocus>
            {t('updateConfirm.updateNow')}
          </button>
        </div>
      </div>
    </div>
  );
}, UNMOUNTING_DELAY)
