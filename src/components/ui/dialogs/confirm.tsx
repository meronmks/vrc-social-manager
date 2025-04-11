import { createCallable } from 'react-call'

interface Props { message: string }
type Response = boolean

const UNMOUNTING_DELAY = 300;

export const Confirm = createCallable<Props, Response>(({ call, message }) => (
  <div className="fixed inset-0 flex z-20 items-center justify-center" role="dialog">
    <div className={`modal modal-open ${call.ended ? 'exit-animation' : ''}`}>
      <div className="modal-box">
        <p className="whitespace-pre-wrap">{message}</p>
        <div className="modal-action">
          <button className="btn btn-primary" onClick={() => call.end(true)}>Yes</button>
          <button className="btn btn-secondary" onClick={() => call.end(false)}>No</button>
        </div>
      </div>
    </div>
  </div>
), UNMOUNTING_DELAY)
