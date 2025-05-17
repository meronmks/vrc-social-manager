import { toast } from "react-toastify";
import { logging } from '@/libs/logging';

export function toastNormal(message: string) {
  toast(message, {
    pauseOnFocusLoss: false,
    pauseOnHover: false,
  });
}

export function toastSuccess(message: string) {
  toast.success(message, {
    autoClose: false,
  });
}

export function toastError(message: string) {
  toast.error(message, {
    autoClose: false,
  });
  logging.error(message);
}

export function toastWarn(message: string) {
  toast.warn(message, {
    autoClose: false,
  });
  logging.warn(message);
}