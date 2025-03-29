import { toast } from "react-toastify";

export function toastNormal(message: string) {
    toast(message, {
        pauseOnFocusLoss: false,
        pauseOnHover: false,
    });
}

export function toastError(message: string) {
    toast.error(message, {
       autoClose: false,
    });
}