# Firebase Realtime Database Implementation Guide

## Overview
This document describes the complete migration from Firestore + WebSockets to Firebase Realtime Database (RTDB) for real-time appointment management.

## Database Structure

### Directory Structure in RTDB

```
firebase-rtdb/
├── appointments/
│   └── {clinicId}/
│       └── {date}/
│           └── {appointmentId}
│               ├── patientId: string
│               ├── patientName: string
│               ├── patientPhone: string
│               ├── doctorId: string
│               ├── doctorName: string
│               ├── date: string (yyyy-MM-dd)
│               ├── slotStartTime: string
│               ├── slotEndTime: string
│               ├── status: string (pending|booked|confirmed|checked_in|waiting|called|in_consultation|completed|cancelled)
│               ├── qrVerified: boolean
│               ├── queueNumber: number
│               ├── checkedInAt: timestamp
│               ├── checkedInBy: string
│               ├── appointmentKey: string
│               ├── createdAt: timestamp
│               └── updatedAt: timestamp
│
├── appointmentsByKey/
│   └── {appointmentKey}
│       ├── clinicId: string
│       ├── date: string
│       ├── appointmentId: string
│       └── createdAt: timestamp
│
├── patientQueue/
│   └── {clinicId}/
│       └── {doctorId}/
│           └── {appointmentId}
│               ├── appointmentId: string
│               ├── patientId: string
│               ├── patientName: string
│               ├── patientPhone: string
│               ├── doctorId: string
│               ├── doctorName: string
│               ├── date: string
│               ├── queueNumber: number
│               ├── status: string
│               ├── checkedInAt: timestamp
│               ├── checkedInBy: string
│               └── createdAt: timestamp
│
└── docQueues/
    └── {clinicId}/
        └── {doctorId}/
            └── {date}
                ├── currentQueueNumber: number
                └── updatedAt: timestamp
```

## Service Functions

### Listening to Appointments

```typescript
// Get real-time updates for appointments on a specific date
getAppointmentsByDate(
  clinicId: string,
  date: string,
  doctorIds: string[],
  callback: (appointments: Appointment[]) => void
): Unsubscribe
```

**Example Usage:**
```typescript
const unsub = getAppointmentsByDate('clinic-001', '2024-05-09', ['doc-1', 'doc-2'], (appointments) => {
  console.log('Updated appointments:', appointments);
});

// When done listening:
unsub();
```

### Quick Appointment Lookup (QR Code)

```typescript
// Fast lookup by appointment key (for QR scanning)
getAppointmentByKeyFromRTDB(
  clinicId: string,
  appointmentKey: string
): Promise<Appointment | null>
```

**Example Usage:**
```typescript
const appointment = await getAppointmentByKeyFromRTDB('clinic-001', 'APT-12345-67890');
if (appointment) {
  console.log('Found appointment:', appointment.patientName);
}
```

### Check-in Management

```typescript
// Confirm check-in and add to patient queue
approveCheckIn(
  clinicId: string,
  appointmentId: string,
  appointment: Appointment,
  receptionistId: string
): Promise<void>
```

**What it does:**
1. Updates appointment status to 'confirmed'
2. Assigns queue number
3. Adds appointment to patient queue
4. Updates doctor's queue counter

**Example Usage:**
```typescript
await approveCheckIn('clinic-001', 'apt-123', appointmentData, 'receptionist-001');
```

### Status Updates

```typescript
// Update appointment status (auto-syncs everywhere)
updateAppointmentStatus(
  clinicId: string,
  appointmentId: string,
  appointment: Appointment,
  status: AppointmentStatus
): Promise<void>
```

**Example Usage:**
```typescript
await updateAppointmentStatus('clinic-001', 'apt-123', appointmentData, 'called');
// Automatically updates in: appointments, and patientQueue
```

## Real-time Listeners in Components

### AppointmentList Component
- Listens to appointments for a specific date
- Auto-updates when appointments change
- Unsubscribes on cleanup

### QueueManagement Component
- Shows live queue for patients present in clinic
- Auto-updates status from real-time database
- Displays queue numbers and wait times

### QRScannerPage Component
- Scans QR codes containing appointment keys
- Looks up appointment quickly via appointmentsByKey index
- Auto-approves check-in and adds to queue

## Important Notes

### Appointment Date Format
All dates must be in `yyyy-MM-dd` format:
```typescript
const date = new Date().toISOString().split('T')[0]; // 2024-05-09
```

### Real-time Sync Behavior
- All listeners automatically unsubscribe on component unmount
- Status updates sync across all connected clients in real-time
- Patient queue updates immediately when appointments change

### Queue Management
- Queue numbers are assigned per doctor per date
- Numbers automatically increment when new patients check in
- Completed/cancelled appointments automatically remove from queue

### Security Rules (Recommended)
```json
{
  "rules": {
    "appointments": {
      "$clinicId": {
        ".read": "auth != null && root.child('clinics').child($clinicId).child('receptionists').child(auth.uid).exists()",
        ".write": "auth != null && root.child('clinics').child($clinicId).child('receptionists').child(auth.uid).exists()"
      }
    },
    "patientQueue": {
      "$clinicId": {
        ".read": "auth != null && root.child('clinics').child($clinicId).child('receptionists').child(auth.uid).exists()",
        ".write": "auth != null && root.child('clinics').child($clinicId).child('receptionists').child(auth.uid).exists()"
      }
    }
  }
}
```

## Migration from Firestore Appointments

If migrating existing Firestore appointments to RTDB:

1. Export Firestore appointments
2. Transform to RTDB structure (group by clinicId and date)
3. Bulk import to RTDB
4. Create appointmentsByKey index for fast lookup
5. Test with QR scanner

## Testing the Implementation

### 1. Test Real-time Updates
```typescript
// Open two browser tabs
// Modify appointment in tab 1
// Should reflect in tab 2 immediately
```

### 2. Test Queue Management
```typescript
// Check in patient
// Verify queue number assigned
// Verify appears in patient queue
// Change status → verify updates everywhere
```

### 3. Test QR Scanner
```typescript
// Generate QR code with appointment key
// Scan in app
// Should auto-approve and add to queue
```

## Performance Considerations

- **Appointments by Date**: O(1) lookup, scales with date size
- **Quick Lookup Index**: O(1) by appointment key
- **Queue Updates**: Real-time, ~100ms latency
- **Doctor Queue Counters**: No race conditions with RTDB transactions

## Troubleshooting

### Appointments Not Appearing
- Check clinic ID matches
- Verify date is in yyyy-MM-dd format
- Check browser console for listener errors

### Queue Number Not Assigned
- Verify receptionistId is correct
- Check doctor ID exists
- Verify date is valid

### Real-time Updates Not Syncing
- Check network connection
- Verify RTDB rules allow read/write
- Clear browser cache and reload

## Related Files
- `/src/lib/firebase.ts` - Firebase initialization
- `/src/services/realtimeDatabaseService.ts` - RTDB operations
- `/src/services/clinicService.ts` - Service layer
- `/src/pages/receptionist/AppointmentList.tsx` - Appointment list UI
- `/src/pages/receptionist/QueueManagement.tsx` - Queue UI
- `/src/pages/receptionist/QRScannerPage.tsx` - QR scanner UI
