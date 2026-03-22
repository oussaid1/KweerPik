export type Role = 'driver' | 'student';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: Role;
  photoURL?: string;
  driverId?: string; // For students to link to a driver
}

export interface TimetableEntry {
  day: string;
  startTime: string;
  endTime: string;
}

export interface Timetable {
  userId: string;
  schedule: TimetableEntry[];
}

export interface PickupRequest {
  id: string;
  studentId: string;
  studentName: string;
  driverId: string; // The specific driver this request is for
  extraTime: number;
  location: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  status: 'pending' | 'accepted' | 'completed' | 'cancelled';
  timestamp: string;
}
