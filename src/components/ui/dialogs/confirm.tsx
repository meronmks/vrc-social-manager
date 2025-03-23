import { createCallable } from 'react-call'

interface Props { message: string }
type Response = boolean

export const Confirm = createCallable<Props, Response>(({ call, message }) => (
    <div className="fixed inset-0 flex z-20 items-center justify-center" role="dialog">
        <div className="modal modal-open">
            <div className="modal-box">
                <p className="whitespace-pre-wrap">{message}</p>
                <div className="modal-action">
                    <button className="btn btn-primary" onClick={() => call.end(true)}>Yes</button>
                    <button className="btn btn-secondary" onClick={() => call.end(false)}>No</button>
                </div>
            </div>
        </div>
    </div>
))