# Quick Reference - Email Auth & Doctor Portal

## 🔐 Login Page - 4 Authentication Methods

### Tab 1: Google Login
- Click "Continue with Google"
- Sign in with Google account
- Auto-creates profile if new user

### Tab 2: Email Login
- Enter email and password
- Click "Login"
- Forgot password? Click link below password field

### Tab 3: Sign Up (Receptionist)
- Enter full name, email, password
- Click "Create Account"
- Account created and auto-login

### Tab 4: Forgot Password
- Enter registered email
- Firebase sends reset email
- Click link in email to set new password

---

## 👨‍⚕️ Doctor Portal Features

### Access
- URL: `/doctor/appointments`
- Login with email/password or Google
- System auto-routes doctors to portal

### View Appointments
1. Select date using date picker
2. See pending appointments for that date
3. Shows: Patient name, phone, time slot, appointment ID

### Confirm Appointment
- Click "✓ Confirm" button on appointment card
- Status changes to "confirmed"
- Patient queue updates in real-time
- Receptionists see update immediately

### Reject Appointment
- Click "✗ Reject" button on appointment card
- Status changes to "rejected"
- Patient can rebook with different doctor

### Real-time Updates
- New appointments appear instantly
- Status changes sync across all devices
- No need to refresh page

---

## 📋 Test Credentials

### Receptionist (Demo)
- Email: `test@clinic.com`
- Password: `test123`
- Role: Receptionist
- Clinic: Medicare Clinic

### Doctor (Demo)
- Email: `doctor@clinic.com`
- Password: `doctor123`
- Specialization: Cardiologist
- Room: Room 101

### Note
You can create new accounts using the Sign Up tab

---

## 🔄 User Workflows

### Receptionist Workflow
```
Google/Email/SignUp Login
        ↓
Receptionist Dashboard
        ↓
Input appointments → Scan QR → Manage Queue
```

### Doctor Workflow
```
Google/Email Login
        ↓
Doctor Portal (Auto-redirect)
        ↓
View Appointments → Confirm/Reject → Real-time Sync
```

---

## 📱 Mobile Responsive
- Login page works on all devices
- Doctor portal optimized for tablets
- Touch-friendly buttons and inputs

---

## 🔒 What Happens Behind the Scenes

### When You Create Account
1. Firebase creates user authentication
2. User profile saved in Firestore
3. Doctor/Receptionist role assigned
4. Profile auto-completes form fields

### When Doctor Confirms Appointment
1. RTDB appointment status updated to "confirmed"
2. Queue number assigned automatically
3. Patient added to real-time queue
4. All connected clients see update instantly (no refresh needed)

### When Password Reset Requested
1. Firebase sends email from noreply@...
2. Email contains reset link
3. Link valid for 24 hours
4. User creates new password
5. Can login with new password immediately

---

## ✅ Common Tasks

### Change Login Method
- If logged in with Google, can also login with email (same email)
- Firebase merges accounts with same email

### Update Doctor Info
- Click "Logout" in doctor portal
- Login again if credentials updated

### Resend Password Reset Email
- Copy reset link if still in browser
- Or request new one via "Forgot Password"

### Check Appointment Status
- Doctor waits for appointments to sync
- Refresh page if appointments don't appear
- Check RTDB if stuck

---

## 🆘 Troubleshooting

### "Email already in use"
- Email is registered
- Use "Forgot Password" to recover account

### "Invalid password"
- Password must be at least 6 characters
- Password is case-sensitive

### "User not found"
- Email not registered
- Create account using "Sign Up" tab

### Appointments not appearing
- Check date selection
- Verify clinic ID matches
- Check RTDB connection
- Refresh page

### Password reset email not received
- Check spam folder
- Wait 5-10 seconds for email to arrive
- Resend reset email

---

## 📊 Feature Matrix

| Feature | Login | Sign Up | Doctor Portal | Password Reset |
|---------|-------|---------|---------------|----------------|
| Google Auth | ✅ | ✅ | ✅ | ✅ |
| Email/Password | ✅ | ✅ | ✅ | ✅ |
| Role Detection | N/A | ✅ | N/A | N/A |
| Auto-Redirect | ✅ | ✅ | ✅ | ✅ |
| Real-time Updates | N/A | N/A | ✅ | N/A |
| Email Verification | Optional | Optional | Optional | Required |

---

## 🎯 Next Steps

1. **Test All Auth Methods**
   - Google login
   - Email signup
   - Email login
   - Password reset

2. **Test Doctor Portal**
   - Login as doctor
   - View appointments
   - Confirm appointments
   - Check real-time sync

3. **Monitor Queue**
   - Open receptionist dashboard
   - Have doctor confirm appointment
   - See queue update in real-time

4. **Deploy**
   - Add domain to Firebase Console
   - Set up production SMTP
   - Enable email verification (optional)

---

## 📞 Support

For issues or questions:
1. Check Firebase Console logs
2. Review browser console for errors
3. Check RTDB structure
4. Verify Firestore rules
5. Test with Firebase Emulator

---

## Summary

✨ **3 Ways to Login**
- Google OAuth
- Email/Password
- Create Account

🏥 **Doctor Portal Included**
- View pending appointments
- Confirm/reject in real-time
- Automatic queue sync

🔐 **Password Recovery Built-in**
- Forgot password link
- Firebase email verification
- 24-hour reset links

⚡ **Real-time Everything**
- Appointment updates sync instantly
- No refresh needed
- All devices see changes immediately
