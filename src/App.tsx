import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  User 
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  addDoc, 
  updateDoc,
  getDocs,
  getDocFromServer
} from 'firebase/firestore';
import { 
  MapPin, 
  Clock, 
  Calendar, 
  Bell, 
  User as UserIcon, 
  LogOut, 
  CheckCircle, 
  XCircle, 
  Navigation,
  Plus,
  Trash2,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, parseISO, isValid } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { auth, db, OperationType, handleFirestoreError } from './firebase';
import { UserProfile, Role, Timetable, TimetableEntry, PickupRequest } from './types';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Contexts ---
interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  setRole: (role: Role) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

// --- Components ---

const LoadingScreen = () => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-stone-50">
    <motion.div 
      animate={{ rotate: 360 }}
      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
      className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full"
    />
    <p className="mt-4 text-stone-600 font-medium">Loading your dashboard...</p>
  </div>
);

const Login = () => {
  const { login } = useAuth();
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-stone-50 p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-stone-200/50 p-8 border border-stone-100"
      >
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center">
            <Navigation className="w-8 h-8 text-emerald-600" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-stone-900 text-center mb-2">Pickup Assistant</h1>
        <p className="text-stone-500 text-center mb-8">Coordinate school pickups with ease and real-time updates.</p>
        
        <button 
          onClick={login}
          className="w-full py-4 bg-stone-900 text-white rounded-2xl font-semibold flex items-center justify-center gap-3 hover:bg-stone-800 transition-colors"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="Google" />
          Sign in with Google
        </button>
      </motion.div>
    </div>
  );
};

const RoleSelection = () => {
  const { setRole } = useAuth();
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-stone-50 p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl"
      >
        <h2 className="text-3xl font-bold text-stone-900 text-center mb-8">Welcome! Who are you?</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button 
            onClick={() => setRole('driver')}
            className="group bg-white p-8 rounded-3xl shadow-lg border-2 border-transparent hover:border-emerald-500 transition-all text-left"
          >
            <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Navigation className="w-7 h-7 text-emerald-600" />
            </div>
            <h3 className="text-xl font-bold text-stone-900 mb-2">I'm the Driver</h3>
            <p className="text-stone-500">Manage students, view timetables, and receive real-time pickup alerts.</p>
          </button>
          
          <button 
            onClick={() => setRole('student')}
            className="group bg-white p-8 rounded-3xl shadow-lg border-2 border-transparent hover:border-emerald-500 transition-all text-left"
          >
            <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <UserIcon className="w-7 h-7 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold text-stone-900 mb-2">I'm a Student</h3>
            <p className="text-stone-500">Upload your timetable and notify the driver when you're ready for pickup.</p>
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// --- Student Components ---

const DriverSelector = ({ currentDriverId, onSelect }: { currentDriverId?: string, onSelect: (driverId: string) => void }) => {
  const [drivers, setDrivers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'users'), where('role', '==', 'driver'));
    const unsub = onSnapshot(q, (snapshot) => {
      setDrivers(snapshot.docs.map(d => d.data() as UserProfile));
      setLoading(false);
    });
    return unsub;
  }, []);

  if (loading) return <div className="p-4 text-center text-stone-400">Finding drivers...</div>;

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-stone-100 p-6">
      <h3 className="text-xl font-bold text-stone-900 flex items-center gap-2 mb-6">
        <Navigation className="w-5 h-5 text-emerald-500" />
        Choose Your Driver
      </h3>
      <div className="grid grid-cols-1 gap-3">
        {drivers.length === 0 ? (
          <p className="text-stone-400 italic text-sm">No drivers available yet.</p>
        ) : (
          drivers.map(driver => (
            <button 
              key={driver.uid}
              onClick={() => onSelect(driver.uid)}
              className={cn(
                "flex items-center justify-between p-4 rounded-2xl border-2 transition-all text-left",
                currentDriverId === driver.uid ? "bg-emerald-50 border-emerald-500" : "bg-stone-50 border-transparent hover:border-stone-200"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-stone-200 rounded-full flex items-center justify-center overflow-hidden">
                  {driver.photoURL ? <img src={driver.photoURL} alt={driver.name} /> : <UserIcon className="w-5 h-5 text-stone-400" />}
                </div>
                <div>
                  <p className="font-bold text-stone-900">{driver.name}</p>
                  <p className="text-xs text-stone-500">{driver.email}</p>
                </div>
              </div>
              {currentDriverId === driver.uid && <CheckCircle className="w-5 h-5 text-emerald-600" />}
            </button>
          ))
        )}
      </div>
    </div>
  );
};

const TimetableEditor = ({ timetable, onSave }: { timetable: Timetable | null, onSave: (schedule: TimetableEntry[]) => void }) => {
  const [schedule, setSchedule] = useState<TimetableEntry[]>(timetable?.schedule || []);
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const addEntry = () => {
    setSchedule([...schedule, { day: 'Monday', startTime: '08:00', endTime: '16:00' }]);
  };

  const removeEntry = (index: number) => {
    setSchedule(schedule.filter((_, i) => i !== index));
  };

  const updateEntry = (index: number, field: keyof TimetableEntry, value: string) => {
    const newSchedule = [...schedule];
    newSchedule[index] = { ...newSchedule[index], [field]: value };
    setSchedule(newSchedule);
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-stone-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-stone-900 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-emerald-500" />
          My Weekly Timetable
        </h3>
        <button 
          onClick={addEntry}
          className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-4">
        {schedule.length === 0 ? (
          <p className="text-stone-400 text-center py-8 italic">No schedule added yet.</p>
        ) : (
          schedule.map((entry, index) => (
            <div key={index} className="flex flex-wrap items-center gap-3 p-4 bg-stone-50 rounded-2xl border border-stone-100">
              <select 
                value={entry.day}
                onChange={(e) => updateEntry(index, 'day', e.target.value)}
                className="bg-white border border-stone-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                {days.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-stone-400" />
                <input 
                  type="time" 
                  value={entry.startTime}
                  onChange={(e) => updateEntry(index, 'startTime', e.target.value)}
                  className="bg-white border border-stone-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                <span className="text-stone-400">to</span>
                <input 
                  type="time" 
                  value={entry.endTime}
                  onChange={(e) => updateEntry(index, 'endTime', e.target.value)}
                  className="bg-white border border-stone-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <button 
                onClick={() => removeEntry(index)}
                className="ml-auto p-2 text-stone-400 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      <button 
        onClick={() => onSave(schedule)}
        className="w-full mt-6 py-3 bg-emerald-600 text-white rounded-2xl font-semibold hover:bg-emerald-700 transition-colors"
      >
        Save Timetable
      </button>
    </div>
  );
};

const PickupRequestForm = ({ onSend }: { onSend: (extraTime: number, location: { latitude: number, longitude: number }) => void }) => {
  const [extraTime, setExtraTime] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = () => {
    setSending(true);
    setError(null);
    
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      setSending(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        onSend(extraTime, {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        setSending(false);
      },
      (err) => {
        setError("Could not get your location. Please enable location services.");
        setSending(false);
      }
    );
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-stone-100 p-6">
      <h3 className="text-xl font-bold text-stone-900 flex items-center gap-2 mb-6">
        <Bell className="w-5 h-5 text-blue-500" />
        Request Pickup
      </h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-2">Additional Time (minutes)</label>
          <div className="flex items-center gap-4">
            {[0, 5, 10, 15, 30].map(t => (
              <button 
                key={t}
                onClick={() => setExtraTime(t)}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-medium transition-all",
                  extraTime === t ? "bg-blue-600 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                )}
              >
                {t === 0 ? 'Now' : `+${t}m`}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <button 
          onClick={handleSend}
          disabled={sending}
          className={cn(
            "w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all",
            sending ? "bg-stone-200 text-stone-400 cursor-not-not-allowed" : "bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200"
          )}
        >
          {sending ? (
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-5 h-5 border-2 border-stone-400 border-t-transparent rounded-full" />
          ) : (
            <>
              <Navigation className="w-5 h-5" />
              Notify Driver
            </>
          )}
        </button>
      </div>
    </div>
  );
};

// --- Driver Components ---

const StudentCard = ({ student, timetable }: { student: UserProfile, timetable: Timetable | null }) => {
  const today = format(new Date(), 'EEEE');
  const todaySchedule = timetable?.schedule.filter(s => s.day === today) || [];

  return (
    <div className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center overflow-hidden border border-stone-200">
          {student.photoURL ? <img src={student.photoURL} alt={student.name} className="w-full h-full object-cover" /> : <UserIcon className="w-6 h-6 text-stone-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-stone-900 truncate">{student.name}</h4>
          <p className="text-xs text-stone-500 truncate">{student.email}</p>
        </div>
      </div>
      
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h5 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Today's Schedule ({today})</h5>
          {todaySchedule.length > 0 && <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />}
        </div>
        
        {timetable ? (
          <div className="space-y-2">
            {todaySchedule.length > 0 ? (
              todaySchedule.map((s, i) => (
                <div key={i} className="flex items-center justify-between text-sm text-stone-700 bg-stone-50 p-3 rounded-xl border border-stone-100">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-500" />
                    <span className="font-medium">{s.startTime} - {s.endTime}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-100">
                <p className="text-xs text-stone-400 italic">No classes scheduled for today.</p>
                {timetable.schedule.length > 0 && (
                  <p className="text-[10px] text-stone-400 mt-1">Has schedule on other days.</p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="p-3 bg-stone-50 rounded-xl border border-dashed border-stone-200">
            <p className="text-xs text-stone-400 italic">No timetable uploaded yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const RequestNotification = ({ request, onAccept, onComplete }: { request: PickupRequest, onAccept: () => void, onComplete: () => void }) => {
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${request.location.latitude},${request.location.longitude}`;

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className={cn(
        "p-5 rounded-3xl border-2 transition-all",
        request.status === 'pending' ? "bg-blue-50 border-blue-100" : "bg-emerald-50 border-emerald-100"
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center",
            request.status === 'pending' ? "bg-blue-200 text-blue-700" : "bg-emerald-200 text-emerald-700"
          )}>
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-stone-900">{request.studentName}</h4>
            <p className="text-xs text-stone-500">{format(parseISO(request.timestamp), 'HH:mm')}</p>
          </div>
        </div>
        <div className={cn(
          "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
          request.status === 'pending' ? "bg-blue-200 text-blue-700" : "bg-emerald-200 text-emerald-700"
        )}>
          {request.status}
        </div>
      </div>

      <div className="flex flex-col gap-3 mb-5">
        <div className="flex items-center gap-2 text-sm text-stone-600">
          <Clock className="w-4 h-4 text-stone-400" />
          <span>Extra time: <span className="font-bold text-stone-900">{request.extraTime} mins</span></span>
        </div>
        <a 
          href={mapUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
        >
          <MapPin className="w-4 h-4" />
          View Location on Map
        </a>
      </div>

      <div className="flex gap-2">
        {request.status === 'pending' ? (
          <button 
            onClick={onAccept}
            className="flex-1 py-3 bg-blue-600 text-white rounded-2xl font-bold text-sm hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            Accept
          </button>
        ) : (
          <button 
            onClick={onComplete}
            className="flex-1 py-3 bg-emerald-600 text-white rounded-2xl font-bold text-sm hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            Mark Completed
          </button>
        )}
      </div>
    </motion.div>
  );
};

// --- Main Dashboards ---

const StudentDashboard = () => {
  const { profile, logout, setRole } = useAuth();
  const [timetable, setTimetable] = useState<Timetable | null>(null);
  const [activeRequest, setActiveRequest] = useState<PickupRequest | null>(null);

  useEffect(() => {
    if (!profile) return;
    
    const unsubTimetable = onSnapshot(doc(db, 'timetables', profile.uid), (doc) => {
      if (doc.exists()) setTimetable(doc.data() as Timetable);
    });

    const q = query(
      collection(db, 'pickup_requests'), 
      where('studentId', '==', profile.uid),
      where('status', 'in', ['pending', 'accepted'])
    );
    
    const unsubRequests = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const sorted = snapshot.docs
          .map(d => ({ id: d.id, ...d.data() } as PickupRequest))
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setActiveRequest(sorted[0]);
      } else {
        setActiveRequest(null);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'pickup_requests');
    });

    return () => {
      unsubTimetable();
      unsubRequests();
    };
  }, [profile]);

  const saveTimetable = async (schedule: TimetableEntry[]) => {
    if (!profile) return;
    try {
      await setDoc(doc(db, 'timetables', profile.uid), {
        userId: profile.uid,
        schedule
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `timetables/${profile.uid}`);
    }
  };

  const subscribeToDriver = async (driverId: string) => {
    if (!profile) return;
    try {
      await updateDoc(doc(db, 'users', profile.uid), { driverId });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${profile.uid}`);
    }
  };

  const sendPickupRequest = async (extraTime: number, location: { latitude: number, longitude: number }) => {
    if (!profile || !profile.driverId) return;
    try {
      await addDoc(collection(db, 'pickup_requests'), {
        studentId: profile.uid,
        studentName: profile.name,
        driverId: profile.driverId,
        extraTime,
        location,
        status: 'pending',
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'pickup_requests');
    }
  };

  const cancelRequest = async () => {
    if (!activeRequest) return;
    try {
      await updateDoc(doc(db, 'pickup_requests', activeRequest.id), {
        status: 'cancelled'
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `pickup_requests/${activeRequest.id}`);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 pb-20">
      <header className="bg-white border-b border-stone-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <UserIcon className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="font-bold text-stone-900">{profile?.name}</h2>
            <p className="text-xs text-stone-500">Student Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setRole('driver')}
            className="p-2 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all flex items-center gap-2 text-sm font-medium"
            title="Switch to Driver View"
          >
            <Navigation className="w-5 h-5" />
            <span className="hidden sm:inline">Switch Role</span>
          </button>
          <button onClick={logout} className="p-2 text-stone-400 hover:text-red-500 transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-6 space-y-6">
        <AnimatePresence mode="wait">
          {activeRequest ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={cn(
                "p-6 rounded-3xl border-2 shadow-lg",
                activeRequest.status === 'pending' ? "bg-blue-600 border-blue-400 text-white" : "bg-emerald-600 border-emerald-400 text-white"
              )}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  {activeRequest.status === 'pending' ? <Clock className="w-6 h-6" /> : <CheckCircle className="w-6 h-6" />}
                  {activeRequest.status === 'pending' ? 'Request Sent' : 'Driver is Coming!'}
                </h3>
                <button onClick={cancelRequest} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              <p className="opacity-90 mb-6">
                {activeRequest.status === 'pending' 
                  ? "Your driver has been notified. Please wait for them to accept." 
                  : "The driver has accepted your request and is on their way."}
              </p>
              <div className="flex items-center gap-4 text-sm bg-black/10 p-4 rounded-2xl">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>+{activeRequest.extraTime}m</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  <span>Location Shared</span>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {!profile?.driverId ? (
                <div className="p-6 bg-amber-50 border-2 border-amber-100 rounded-3xl text-amber-800 flex items-start gap-4">
                  <AlertCircle className="w-6 h-6 flex-shrink-0" />
                  <div>
                    <p className="font-bold">No Driver Selected</p>
                    <p className="text-sm opacity-80">You must choose a driver before you can request a pickup.</p>
                  </div>
                </div>
              ) : (
                <PickupRequestForm onSend={sendPickupRequest} />
              )}
              <DriverSelector currentDriverId={profile?.driverId} onSelect={subscribeToDriver} />
            </motion.div>
          )}
        </AnimatePresence>

        <TimetableEditor timetable={timetable} onSave={saveTimetable} />
      </main>
    </div>
  );
};

const DriverDashboard = () => {
  const { profile, logout, setRole } = useAuth();
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [timetables, setTimetables] = useState<Record<string, Timetable>>({});
  const [requests, setRequests] = useState<PickupRequest[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    if (!profile) return;

    // Fetch students subscribed to THIS driver
    const qStudents = query(
      collection(db, 'users'), 
      where('role', '==', 'student'),
      where('driverId', '==', profile.uid)
    );
    const unsubStudents = onSnapshot(qStudents, (snapshot) => {
      setStudents(snapshot.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
      setLastUpdate(new Date());
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
    });

    // Fetch all timetables
    const unsubTimetables = onSnapshot(collection(db, 'timetables'), (snapshot) => {
      const tMap: Record<string, Timetable> = {};
      snapshot.docs.forEach(d => {
        tMap[d.id] = d.data() as Timetable;
      });
      setTimetables(tMap);
      setLastUpdate(new Date());
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'timetables');
    });

    // Fetch active requests for THIS driver
    const qRequests = query(
      collection(db, 'pickup_requests'), 
      where('driverId', '==', profile.uid),
      where('status', 'in', ['pending', 'accepted'])
    );
    const unsubRequests = onSnapshot(qRequests, (snapshot) => {
      const sortedRequests = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as PickupRequest))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setRequests(sortedRequests);
      setLastUpdate(new Date());
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'pickup_requests');
    });

    return () => {
      unsubStudents();
      unsubTimetables();
      unsubRequests();
    };
  }, [profile]);

  const updateRequestStatus = async (id: string, status: 'accepted' | 'completed') => {
    try {
      await updateDoc(doc(db, 'pickup_requests', id), { status });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `pickup_requests/${id}`);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 pb-20">
      <header className="bg-white border-b border-stone-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
            <Navigation className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="font-bold text-stone-900">{profile?.name}</h2>
            <p className="text-xs text-stone-500">Driver Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setRole('student')}
            className="p-2 text-stone-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all flex items-center gap-2 text-sm font-medium"
            title="Switch to Student View"
          >
            <UserIcon className="w-5 h-5" />
            <span className="hidden sm:inline">Switch Role</span>
          </button>
          <button onClick={logout} className="p-2 text-stone-400 hover:text-red-500 transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Active Requests Column */}
        <div className="lg:col-span-1 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-stone-900 flex items-center gap-2">
              <Bell className="w-5 h-5 text-blue-500" />
              Pickup Alerts
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-stone-400 font-medium">Updated {format(lastUpdate, 'HH:mm:ss')}</span>
              <span className="bg-blue-100 text-blue-600 px-2 py-1 rounded-lg text-xs font-bold">
                {requests.length}
              </span>
            </div>
          </div>
          
          <div className="space-y-4">
            {requests.length === 0 ? (
              <div className="bg-white p-8 rounded-3xl border border-stone-100 text-center">
                <div className="w-12 h-12 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Bell className="w-6 h-6 text-stone-200" />
                </div>
                <p className="text-stone-400 text-sm italic">No active requests right now.</p>
              </div>
            ) : (
              <AnimatePresence>
                {requests.map(req => (
                  <RequestNotification 
                    key={req.id} 
                    request={req} 
                    onAccept={() => updateRequestStatus(req.id, 'accepted')}
                    onComplete={() => updateRequestStatus(req.id, 'completed')}
                  />
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* Students List Column */}
        <div className="lg:col-span-2 space-y-6">
          <h3 className="text-xl font-bold text-stone-900 flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-emerald-500" />
            My Students
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {students.length === 0 ? (
              <p className="col-span-full text-stone-400 text-center py-12 italic">No students registered yet.</p>
            ) : (
              students.map(student => (
                <StudentCard 
                  key={student.uid} 
                  student={student} 
                  timetable={timetables[student.uid] || null} 
                />
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

// --- Auth Provider ---

const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
        } else {
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      console.error("Login failed", e);
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const setRole = async (role: Role) => {
    if (!user) return;
    try {
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        await updateDoc(docRef, { role });
        setProfile({ ...docSnap.data(), role } as UserProfile);
      } else {
        const newProfile: UserProfile = {
          uid: user.uid,
          name: user.displayName || 'Anonymous',
          email: user.email || '',
          role,
          photoURL: user.photoURL || undefined
        };
        await setDoc(docRef, newProfile);
        setProfile(newProfile);
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout, setRole }}>
      {children}
    </AuthContext.Provider>
  );
};

// --- Error Boundary ---

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error) errorMessage = `Firestore Error: ${parsed.error}`;
      } catch (e) {
        errorMessage = this.state.error.message || errorMessage;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-stone-50 p-6">
          <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full border border-red-100">
            <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center mb-6">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-stone-900 mb-2">Application Error</h2>
            <p className="text-stone-600 mb-6">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-stone-900 text-white rounded-2xl font-semibold hover:bg-stone-800 transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- App Entry ---

const AppContent = () => {
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. The client is offline.");
        }
      }
    }
    testConnection();
  }, []);

  if (loading) return <LoadingScreen />;
  if (!user) return <Login />;
  if (!profile) return <RoleSelection />;

  return profile.role === 'driver' ? <DriverDashboard /> : <StudentDashboard />;
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}
