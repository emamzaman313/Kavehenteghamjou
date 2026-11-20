export type ToastTone = 'success' | 'error';
export type Notify = (text: string, tone?: ToastTone) => void;
