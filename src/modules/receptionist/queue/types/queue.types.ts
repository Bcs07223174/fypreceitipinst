import type { Appointment } from '@/styles/types';

export type QueueItem = Appointment & {
  queueNumber?: number;
  checkedInBy?: string;
};
