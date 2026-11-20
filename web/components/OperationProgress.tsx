'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { advanceOperationPercent, formatOperationPercent } from '@/lib/operation-progress';

type OperationStatus = 'running' | 'success' | 'error';
type OperationItem = {
  id: number;
  title: string;
  detail: string;
  progress: number;
  status: OperationStatus;
};
type Advance = (progress: number, detail: string) => void;
type OperationContextValue = {
  runOperation: <T>(title: string, task: (advance: Advance) => Promise<T>) => Promise<T>;
};
const OperationContext = createContext<OperationContextValue | null>(null);

export function OperationProgressProvider({ children }: { children: ReactNode }) {
  const [operations, setOperations] = useState<OperationItem[]>([]);
  const sequence = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  useEffect(() => () => {
    timers.current.forEach((timer) => clearTimeout(timer));
    timers.current.clear();
  }, []);

  const runOperation = useCallback(async <T,>(title: string, task: (advance: Advance) => Promise<T>): Promise<T> => {
    const id = ++sequence.current;
    setOperations((current) => [...current.filter((item) => item.status === 'running'), {
      id, title, detail: 'آماده‌سازی عملیات', progress: 6, status: 'running' as const,
    }].slice(-4));

    const advance: Advance = (progress, detail) => {
      setOperations((current) => current.map((item) => item.id === id && item.status === 'running'
        ? { ...item, progress: advanceOperationPercent(item.progress, progress), detail }
        : item));
    };

    try {
      const result = await task(advance);
      setOperations((current) => current.map((item) => item.id === id
        ? { ...item, progress: 100, detail: 'با موفقیت تکمیل شد', status: 'success' }
        : item));
      const timer = setTimeout(() => {
        setOperations((current) => current.filter((item) => item.id !== id));
        timers.current.delete(id);
      }, 1700);
      timers.current.set(id, timer);
      return result;
    } catch (error) {
      setOperations((current) => current.map((item) => item.id === id
        ? { ...item, detail: 'عملیات ناموفق بود؛ جزئیات خطا در همان بخش نمایش داده می‌شود', status: 'error' }
        : item));
      const timer = setTimeout(() => {
        setOperations((current) => current.filter((item) => item.id !== id));
        timers.current.delete(id);
      }, 5200);
      timers.current.set(id, timer);
      throw error;
    }
  }, []);

  const value = useMemo(() => ({ runOperation }), [runOperation]);

  return (
    <OperationContext.Provider value={value}>
      {children}
      <div className="operation-progress-stack" aria-live="polite" aria-relevant="additions text">
        {operations.map((operation) => (
          <section className={`operation-progress-card operation-${operation.status}`} key={operation.id} role="status">
            <div className="operation-progress-heading">
              <span className="operation-progress-icon">
                {operation.status === 'success' ? <CheckCircle2 size={19}/> : operation.status === 'error' ? <XCircle size={19}/> : <span className="operation-pulse" aria-hidden="true"/>}
              </span>
              <div className="operation-progress-copy">
                <strong>{operation.title}</strong>
                <small>{operation.detail}</small>
              </div>
              <b>{operation.status === 'running' ? 'در حال انجام' : operation.status === 'error' ? 'خطا' : formatOperationPercent(operation.progress)}</b>
            </div>
            <div className="operation-progress-track" role="progressbar" aria-label={operation.title} aria-valuemin={0} aria-valuemax={100} aria-valuenow={operation.progress}>
              <i className={operation.status === 'running' ? 'operation-indeterminate' : ''} style={{ width: operation.status === 'running' ? '34%' : `${operation.progress}%` }}/>
            </div>
          </section>
        ))}
      </div>
    </OperationContext.Provider>
  );
}

export function useOperationProgress() {
  const context = useContext(OperationContext);
  if (!context) throw new Error('useOperationProgress must be used inside OperationProgressProvider');
  return context;
}
