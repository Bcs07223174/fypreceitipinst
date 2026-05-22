import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, set, serverTimestamp } from 'firebase/database';
import firebaseConfigJson from '../firebase-applet-config.json';

type QueueLeaf = Record<string, unknown> & {
  appointmentId?: string;
  doctorId?: string;
  doctorName?: string;
  patientName?: string;
  date?: string;
  appointmentDate?: string;
  queueNumber?: number;
  status?: string;
};

const argv = process.argv.slice(2).filter((value) => value !== '--');
const clinicId = argv[0] || 'demo-clinic-1';
const doctorId = argv[1] || 'all';
const mode = (argv[2] || 'read').toLowerCase();

const app = initializeApp(firebaseConfigJson as never);
const rtdb = getDatabase(app);

const collectLeaves = (node: unknown, branchDoctorId = '', path: string[] = []): QueueLeaf[] => {
  if (!node || typeof node !== 'object') {
    return [];
  }

  const record = node as Record<string, unknown>;

  if (record.appointmentId || record.patientName || record.appointmentKey || record.date || record.slotStartTime) {
    return [{
      ...record,
      appointmentId: String(record.appointmentId || path[path.length - 1] || ''),
      doctorId: String(record.doctorId || branchDoctorId || ''),
    }];
  }

  return Object.entries(record).flatMap(([childKey, childValue]) =>
    collectLeaves(childValue, branchDoctorId || childKey, [...path, childKey])
  );
};

const readQueue = async () => {
  const path = doctorId !== 'all'
    ? `patientQueue/${clinicId}/${doctorId}`
    : `patientQueue/${clinicId}`;

  console.log(`Reading ${path}`);
  const snapshot = await get(ref(rtdb, path));

  if (!snapshot.exists()) {
    console.log('No queue records found.');
    return [];
  }

  const data = snapshot.val();
  const items = doctorId !== 'all'
    ? collectLeaves(data, doctorId)
    : Object.entries(data as Record<string, unknown>).flatMap(([queueDoctorId, doctorQueue]) =>
        collectLeaves(doctorQueue, queueDoctorId)
      );

  console.log(`Found ${items.length} queue record(s).`);
  console.log(JSON.stringify(items, null, 2));
  return items;
};

const writeProbe = async () => {
  const probePath = `queueDebugChecks/${clinicId}/${Date.now()}`;
  const payload = {
    clinicId,
    doctorId,
    createdAt: serverTimestamp(),
    message: 'queue debug probe',
  };

  await set(ref(rtdb, probePath), payload);
  const snapshot = await get(ref(rtdb, probePath));
  console.log(`Wrote probe to ${probePath}`);
  console.log(JSON.stringify(snapshot.val(), null, 2));
};

const main = async () => {
  await readQueue();

  if (mode === 'write' || process.env.QUEUE_DEBUG_WRITE === '1') {
    await writeProbe();
  }
};

main().catch((error) => {
  console.error('Queue debug script failed:', error);
  process.exitCode = 1;
});