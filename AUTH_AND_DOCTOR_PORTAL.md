# Authentication & Doctor Portal - Complete Guide

## Overview
This document describes the new email/password authentication, forgot password functionality, and the Doctor Reception Portal for confirming appointments.

---

## 1. Email/Password Authentication

### Features Added
- ✅ **Email/Password Login** - Users can login with email and password
- ✅ **Email/Password Sign Up** - Create new receptionist accounts
- ✅ **Doctor Sign Up** - Create doctor accounts with specialization
- ✅ **Forgot Password** - Firebase sends password reset email

### Service Functions

#### `loginWithEmail(email: string, password: string)`
Login with email and password credentials.

```typescript
import { loginWithEmail } from './services/authService';

try {
  const user = await loginWithEmail('user@example.com', 'password123');
  console.log('Logged in:', user.email);
} catch (error) {
  console.error('Login failed:', error.message);
}
```

#### `signUpWithEmail(email: string, password: string, fullName: string, clinicId?: string)`
Create a new receptionist account.

```typescript
try {
  const user = await signUpWithEmail(
    'receptionist@clinic.com',
    'SecurePass123!',
    'John Smith',
    'clinic-001'
  );
  console.log('Account created:', user.email);
} catch (error) {
  if (error.message.includes('already in use')) {
    console.error('Email already registered');
  }
}
```

#### `signUpDoctorWithEmail(...)`
Create a new doctor account.

```typescript
try {
  const user = await signUpDoctorWithEmail(
    'doctor@clinic.com',
    'SecurePass123!',
    'Dr. Ahmad Khan',
    'Cardiologist',
    'Room 101',
    'clinic-001'
  );
} catch (error) {
  console.error('Doctor signup failed:', error.message);
}
```

#### `sendResetPasswordEmail(email: string)`
Send password reset email to user.

```typescript
try {
  await sendResetPasswordEmail('user@example.com');
  console.log('Reset email sent! Check your inbox.');
} catch (error) {
  if (error.message.includes('not found')) {
    console.error('No account with this email');
  }
}
```

---

## 2. Login Page - Multi-Method Authentication

### UI Components
The enhanced login page has 4 tabs:

1. **Google Login** - Traditional Google OAuth
2. **Email Login** - Email/password login
3. **Sign Up** - Create new receptionist account
4. **Forgot Password** - Reset password via email

### File
`src/pages/receptionist/LoginPage.tsx`

### Features
- Tabbed interface for different auth methods
- Form validation for email and password
- Real-time error messages
- Success notifications
- Password strength requirement (min 6 characters)

### UI/UX Flow

```
┌─────────────────────────────────────┐
│     Medicare Clinic Login            │
│  Google │ Email Login │ Sign Up │    │
├─────────────────────────────────────┤
│                                     │
│  [Google Button]                    │
│                                     │
│  ────── or use email below ────     │
│                                     │
│  [Email Login Button]               │
│                                     │
└─────────────────────────────────────┘
```

---

## 3. Doctor Reception Portal

### Purpose
Allows doctors to view pending appointments for their patients and confirm or reject them.

### URL
`/doctor/appointments`

### Features
- Real-time appointment updates via RTDB
- Filter by date
- View patient details:
  - Patient name & ID
  - Contact phone
  - Time slot
  - Appointment status
- Actions:
  - **Confirm** - Accept appointment
  - **Reject** - Decline appointment

### File
`src/pages/doctor/DoctorReceptionPage.tsx`

### UI Layout

```
┌─────────────────────────────────────────┐
│ Doctor Portal - Dr. Ahmad Khan          │
│ [Logout Button]                         │
├─────────────────────────────────────────┤
│ Date: [2024-05-09]  │ 3 Appointments   │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────────┐  ┌──────────────┐   │
│  │ 🔔 Pending   │  │ 📅 Booked    │   │
│  │ Ali Jawad    │  │ Sara Ahmed   │   │
│  │ 09:00-09:15  │  │ 10:00-10:15  │   │
│  │ [Confirm]    │  │ [Confirm]    │   │
│  │ [Reject]     │  │ [Reject]     │   │
│  └──────────────┘  └──────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

### Doctor Workflow

1. **Doctor Login**
   - Use email/password or Google
   - System identifies doctor role
   - Redirected to `/doctor/appointments`

2. **View Appointments**
   - Sees all pending and booked appointments for selected date
   - Shows patient info and time slots
   - Real-time updates from RTDB

3. **Confirm Appointment**
   - Click "Confirm" button
   - Status changes from "pending"/"booked" → "confirmed"
   - Patient queue is updated
   - Receptionists see updated status in real-time

4. **Reject Appointment**
   - Click "Reject" button
   - Appointment moves to "rejected" status
   - Patient can rebook with different doctor

---

## 4. Role-Based Routing

### System Automatically Routes Users Based on Role

| User Role | Login Path | Redirect Path | Portal |
|-----------|-----------|---------------|---------|
| Receptionist | `/login` | `/receptionist/dashboard` | Appointment Management |
| Doctor | `/login` | `/doctor/appointments` | Confirmation Portal |
| Admin | `/login` | `/receptionist/dashboard` | Admin Panel |

### Route Protection
```typescript
// Doctor portal only for doctors
<Route path="/doctor/appointments" 
  element={user && profile?.role === 'doctor' ? 
    <DoctorReceptionPage profile={profile} /> : 
    <Navigate to="/login" />} 
/>
```

---

## 5. Password Reset Flow

### Step 1: User Clicks "Forgot Password?"
- Navigates to forgot password form
- Enters email address

### Step 2: Firebase Sends Email
- User receives email from Firebase (noreply@...)
- Email contains password reset link
- Link is valid for 24 hours

### Step 3: User Clicks Link
- Opens reset page on Firebase Hosting
- Creates new password
- Confirms password

### Step 4: Return to Login
- User can now login with new password

### Email Template Example
```
Subject: Reset your Medicare Clinic password

Hi [User Name],

We received a request to reset your password. 
Click the link below to set a new password:

[Reset Link]

This link expires in 24 hours.

If you didn't request this, ignore this email.

--- Medicare Clinic Support
```

---

## 6. Database Schema

### Users Collection (Firestore)
```json
{
  "uid": "firebase-uid",
  "email": "user@clinic.com",
  "role": "receptionist|doctor",
  "clinicId": "clinic-001",
  "status": "active",
  "profileCompleted": false,
  "createdAt": 1715250000000
}
```

### Clinic - Doctors (Firestore)
```json
{
  "uid": "doctor-uid",
  "fullName": "Dr. Ahmad Khan",
  "specialization": "Cardiologist",
  "roomNumber": "Room 101",
  "status": "active",
  "email": "doctor@clinic.com",
  "createdAt": 1715250000000
}
```

### Clinic - Receptionists (Firestore)
```json
{
  "uid": "receptionist-uid",
  "clinicId": "clinic-001",
  "fullName": "John Smith",
  "email": "receptionist@clinic.com",
  "phone": "+92 300 1234567",
  "assignedDoctorIds": ["doc-1", "doc-2"],
  "status": "active",
  "createdAt": 1715250000000,
  "updatedAt": 1715250000000
}
```

### Appointments (RTDB)
```
appointments/
├── {clinicId}/
│   └── {date}/
│       └── {appointmentId}
│           ├── patientId: "pat-001"
│           ├── patientName: "Ali Jawad"
│           ├── doctorId: "doc-1"
│           ├── status: "pending|booked|confirmed|rejected"
│           ├── slotStartTime: "09:00 AM"
│           ├── slotEndTime: "09:15 AM"
│           └── ...
```

---

## 7. Error Handling

### Common Errors

#### Email Already Exists
```typescript
try {
  await signUpWithEmail(email, password, name);
} catch (error) {
  if (error.code === 'auth/email-already-in-use') {
    console.error('Email already registered');
  }
}
```

#### Weak Password
```typescript
if (password.length < 6) {
  console.error('Password must be at least 6 characters');
}
```

#### User Not Found
```typescript
try {
  await sendResetPasswordEmail(email);
} catch (error) {
  if (error.code === 'auth/user-not-found') {
    console.error('No account with this email');
  }
}
```

#### Invalid Login Credentials
```typescript
try {
  await loginWithEmail(email, password);
} catch (error) {
  if (error.code === 'auth/wrong-password' || 
      error.code === 'auth/user-not-found') {
    console.error('Invalid email or password');
  }
}
```

---

## 8. Testing the Features

### Test Email/Password Login
1. Go to `http://localhost:3000/login`
2. Click "Email Login" tab
3. Enter test email: `test@clinic.com`
4. Enter test password: `test123`
5. Click "Login"

### Test Sign Up
1. Click "Sign Up" tab
2. Enter:
   - Full Name: `Jane Doe`
   - Email: `jane@clinic.com`
   - Password: `Jane@123`
3. Click "Create Account"

### Test Doctor Portal
1. Sign up as doctor or use Google login with doctor email
2. Should auto-redirect to `/doctor/appointments`
3. View pending appointments
4. Click "Confirm" to accept appointment
5. Changes appear in real-time

### Test Forgot Password
1. Click "Email Login" tab
2. Click "Forgot your password?"
3. Enter registered email
4. Check Firebase console for sent email
5. Click reset link (in development, use Firebase emulator)

---

## 9. Security Best Practices

### Firebase Authentication Rules
```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "auth.uid == $uid",
        ".write": "auth.uid == $uid"
      }
    }
  }
}
```

### Password Requirements
- Minimum 6 characters (enforced in UI and Firebase)
- No special character requirement (keep it simple for clinic staff)
- Firebase automatically enforces strong authentication

### Email Verification (Optional)
You can enable email verification:
```typescript
await sendEmailVerification(user);
```

---

## 10. Frequently Asked Questions

### Q: How do I change my password?
A: Use "Forgot Password" feature to reset via email link.

### Q: Can doctors see all appointments?
A: No, doctors only see appointments assigned to them on selected date.

### Q: What happens if doctor rejects an appointment?
A: Appointment status becomes "rejected" and patient can rebook.

### Q: Is password stored securely?
A: Yes, Firebase stores passwords hashed and salted using industry standards.

### Q: Can I use both Google and Email login?
A: Yes, same email account can be used for both methods.

---

## 11. Related Files
- `/src/services/authService.ts` - Authentication functions
- `/src/pages/receptionist/LoginPage.tsx` - Login UI
- `/src/pages/doctor/DoctorReceptionPage.tsx` - Doctor portal
- `/src/services/realtimeDatabaseService.ts` - RTDB operations
- `/src/App.tsx` - Route definitions

---

## 12. Deployment Notes

### Firebase Setup Required
1. Enable Email/Password auth in Firebase Console
2. Set up SMTP for password reset emails
3. Configure authorized domains for callback URLs

### Environment Variables
```
VITE_FIREBASE_API_KEY=xxx
VITE_FIREBASE_PROJECT_ID=health-37caa
VITE_FIREBASE_AUTH_DOMAIN=health-37caa.firebaseapp.com
```

### Password Reset Domain
- Ensure domain is authorized in Firebase Console
- URLs should be: `https://yourdomain.com/login`

---

## Summary of Changes

✅ **Email/Password Authentication**
- Login with email and password
- Create accounts with email/password
- Doctor-specific signup

✅ **Forgot Password**
- Firebase sends reset email automatically
- Users can reset password from email link
- Email recovery for forgotten passwords

✅ **Doctor Portal**
- Doctors view pending appointments
- Confirm/reject appointments in real-time
- Patient queue auto-updates
- Role-based routing

✅ **Enhanced Login Page**
- 4-tab interface (Google, Email, Sign Up, Reset)
- Form validation and error handling
- Real-time feedback

✅ **Role-Based Access**
- Receptionists → Dashboard
- Doctors → Appointment Portal
- Admin → Dashboard

All features are fully implemented and ready for production use!
