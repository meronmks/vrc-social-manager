import { createCallable } from 'react-call'
import { useTranslation } from 'react-i18next'

interface Props {
  version: string
  releaseNotes?: string
}

type Response = boolean

const UNMOUNTING_DELAY = 300;

export const UpdateConfirm = createCallable<Props, Response>(({ call, version, releaseNotes }) => {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 flex z-20 items-center justify-center" role="dialog">
      <div className={`modal modal-open ${call.ended ? 'exit-animation' : ''}`}>
        <div className="modal-box">
          <h3 className="text-xl font-bold mb-4">{t('updateConfirm.title')}</h3>
          <div className="space-y-4">
            <p className="text-lg">{t('updateConfirm.newVersion', { version })}</p>
            {releaseNotes && (
              <div className="bg-base-200 p-4 rounded-lg">
                <h4 className="font-semibold mb-2">{t('updateConfirm.releaseNotes')}</h4>
                <p className="whitespace-pre-wrap text-sm">{releaseNotes}</p>
              </div>
            )}
            <p className="text-sm opacity-75">{t('updateConfirm.restartMessage')}</p>
          </div>
          <div className="modal-action">
            <button 
              className="btn btn-primary"
              onClick={() => call.end(true)}
            >
              {t('updateConfirm.updateNow')}
            </button>
            <button 
              className="btn btn-ghost"
              onClick={() => call.end(false)}
            >
              {t('updateConfirm.later')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}, UNMOUNTING_DELAY)
