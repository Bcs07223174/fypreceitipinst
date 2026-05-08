import { useEffect, useState } from 'react';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Camera, 
  ShieldCheck,
  Stethoscope,
  Save,
  Clock
} from 'lucide-react';
import { UserProfile, ReceptionistProfile, DoctorProfile } from '../../types';
import { getReceptionistProfile, getAssignedDoctors } from '../../services/clinicService';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface ProfilePageProps {
  profile: UserProfile | null;
}

export default function ProfilePage({ profile }: ProfilePageProps) {
  const [rec, setRec] = useState<ReceptionistProfile | null>(null);
  const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    address: '',
    gender: 'Other'
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      getReceptionistProfile(profile.clinicId, profile.uid).then(data => {
        if (data) {
          setRec(data);
          setFormData({
            fullName: data.fullName,
            phone: data.phone || '',
            address: data.address || '',
            gender: data.gender || 'Other'
          });
          if (data.assignedDoctorIds.length) {
            getAssignedDoctors(profile.clinicId, data.assignedDoctorIds).then(setDoctors);
          }
        }
      });
    }
  }, [profile]);

  const handleSave = async () => {
    if (!profile || !rec) return;
    setSaving(true);
    try {
      const path = `clinics/${profile.clinicId}/receptionists/${profile.uid}`;
      await updateDoc(doc(db, path), {
        ...formData,
        updatedAt: serverTimestamp()
      });
      setRec({ ...rec, ...formData });
      setEditing(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Your Profile</h1>
        <p className="text-slate-500">Manage your personal information and view assigned duties.</p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left Column: Stats and Avatar */}
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <div className="relative mx-auto mb-6 h-32 w-32">
              <div className="flex h-full w-full items-center justify-center rounded-3xl bg-sky-50 text-sky-600 font-bold text-4xl shadow-inner uppercase">
                {rec?.fullName?.[0] || 'R'}
              </div>
              <button className="absolute -bottom-2 -right-2 rounded-xl bg-white p-2 text-slate-600 shadow-lg hover:text-sky-600">
                <Camera size={20} />
              </button>
            </div>
            <h2 className="text-xl font-bold text-slate-900">{rec?.fullName}</h2>
            <p className="text-sm font-medium text-sky-600 uppercase tracking-wider mt-1">Receptionist</p>
            
            <div className="mt-8 flex items-center justify-center gap-2 rounded-xl bg-green-50 px-4 py-2 text-sm font-bold text-green-700">
               <ShieldCheck size={18} />
               Verified Account
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-8 space-y-6">
            <h3 className="font-bold text-slate-900">Assigned To</h3>
            <div className="space-y-4">
              {doctors.map(doctor => (
                <div key={doctor.uid} className="flex items-center gap-4">
                  <div className="h-10 w-10 shrink-0 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                    <Stethoscope size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">{doctor.fullName}</p>
                    <p className="truncate text-xs text-slate-500">{doctor.specialization}</p>
                  </div>
                </div>
              ))}
              {doctors.length === 0 && (
                <p className="text-sm text-slate-400">No doctors assigned yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Profile Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 bg-slate-50 px-8 py-4 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Personal Information</h3>
              {!editing ? (
                <button 
                  onClick={() => setEditing(true)}
                  className="text-sm font-bold text-sky-600 hover:underline"
                >
                  Edit Profile
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setEditing(false)}
                    className="text-sm font-medium text-slate-500"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-1.5 text-xs font-bold text-white transition-all active:scale-95 disabled:opacity-50"
                  >
                    {saving ? <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Save size={14} />}
                    Save Changes
                  </button>
                </div>
              )}
            </div>
            
            <div className="p-8 space-y-8">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                    <User size={14} /> Full Name
                  </label>
                  <input 
                    type="text" 
                    readOnly={!editing}
                    className={`w-full rounded-xl border px-4 py-3 text-sm transition-all outline-none ${
                       editing ? 'border-sky-200 bg-white ring-2 ring-sky-50' : 'border-transparent bg-slate-50'
                    }`}
                    value={formData.fullName}
                    onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                    <Mail size={14} /> Email Address
                  </label>
                  <input 
                    type="email" 
                    readOnly
                    className="w-full rounded-xl border border-transparent bg-slate-50 px-4 py-3 text-sm text-slate-400 outline-none"
                    value={rec?.email || ''}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                    <Phone size={14} /> Phone Number
                  </label>
                  <input 
                    type="tel" 
                    readOnly={!editing}
                    placeholder="+92 300 0000000"
                    className={`w-full rounded-xl border px-4 py-3 text-sm transition-all outline-none ${
                       editing ? 'border-sky-200 bg-white ring-2 ring-sky-50' : 'border-transparent bg-slate-50'
                    }`}
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                    <Clock size={14} /> Employment Shift
                  </label>
                  <div className="w-full rounded-xl border border-transparent bg-slate-50 px-4 py-3 text-sm text-slate-600 font-medium capitalize">
                    {rec?.shift || 'Morning'} Shift
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                  <MapPin size={14} /> Home Address
                </label>
                <textarea 
                  readOnly={!editing}
                  rows={3}
                  className={`w-full rounded-xl border px-4 py-3 text-sm transition-all outline-none resize-none ${
                     editing ? 'border-sky-200 bg-white ring-2 ring-sky-50' : 'border-transparent bg-slate-50'
                  }`}
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                />
              </div>

              <div className="flex gap-4">
                 {['Male', 'Female', 'Other'].map(option => (
                   <button 
                    key={option}
                    disabled={!editing}
                    onClick={() => setFormData({...formData, gender: option})}
                    className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg border transition-all ${
                      formData.gender === option 
                        ? 'bg-sky-600 border-sky-600 text-white shadow-md' 
                        : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                   >
                     {option}
                   </button>
                 ))}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                 <ShieldCheck size={28} />
              </div>
              <div>
                <p className="font-bold text-slate-900">Security & Privacy</p>
                <p className="text-xs text-slate-500">Last security check performed 2 days ago.</p>
              </div>
            </div>
            <button className="text-sm font-bold text-sky-600 hover:underline">Change Password</button>
          </div>
        </div>
      </div>
    </div>
  );
}
