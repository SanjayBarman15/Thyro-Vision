// store/types.ts

export type PatientStatus =
  | "new"
  | "reviewed"
  | "high-risk"
  | "feedback-pending"
  | "overdue";

export interface Patient {
  id:                 string;
  name:               string;
  firstName:          string;
  lastName:           string;
  age:                number;
  gender:             string;
  dob:                string | null;
  pastMedicalData:    string | null;
  lastScan:           string;
  tirads:             string;
  tiradsNum:          number | null;
  status:             PatientStatus;
  reportId:           string | null;   // TV-TR4-KXM-2847
  predictionId:       string | null;
  totalScans:         number;
  nextFollowupDate:   string | null;   // ISO date string
  followupNotes:      string | null;
  isOverdue:          boolean;
}

export interface PatientScan {
  rawImageId:       string;
  fileUrl:           string;
  uploadedAt:        string;
  predictionId:      string | null;
  reportId:          string | null;
  tirads:            number | null;
  confidence:        number | null;
  aiExplanation:     string | null;
  followupDueDate:   string | null;
  features:          any;
  boundingBox:       any;
  processedImageId:  string | null;
  processedUrl:      string | null;
}

export interface ReportExport {
  id:               string;
  predictionId:     string;
  reportId:         string;
  exportedAt:       string;
  tiradsAtExport:   number;
  pipelineVersion:  string;
}

export interface DoctorStats {
  totalPatients:   number;
  scansThisMonth:  number;
  highRiskCount:   number;
  overdueCount:    number;
}

export interface UserProfile {
  name:       string;
  age:        string;
  department: string;
  hospital:   string;
}

export interface AppState extends 
  ProfileSlice, 
  DashboardSlice, 
  PatientDetailSlice, 
  SearchSlice, 
  UiSlice, 
  ComparisonSlice {}

export interface ProfileSlice {
  doctorName:    string;
  profile:       UserProfile;
  setProfile:    (profile: Partial<UserProfile>) => void;
  fetchProfile:  () => Promise<void>;
  saveProfile:   () => Promise<void>;
}

export interface DashboardSlice {
  patients:          Patient[];
  stats:             DoctorStats;
  loading:           boolean;
  fetchDashboardData: () => Promise<void>;
}

export interface PatientDetailSlice {
  selectedPatient:      Patient | null;
  selectedPatientScans: PatientScan[];
  selectedPatientReports: ReportExport[];
  fetchingDetail:       boolean;
  fetchPatientDetail:   (id: string) => Promise<void>;
}

export interface SearchSlice {
  searchQuery:   string;
  filterTirads:  number | null;
  filterOverdue: boolean;
  sortBy:        "recent" | "name" | "tirads" | "overdue";
  setSearchQuery:   (q: string) => void;
  setFilterTirads:  (t: number | null) => void;
  setFilterOverdue: (v: boolean) => void;
  setSortBy:        (s: "recent" | "name" | "tirads" | "overdue") => void;
  searchPatients:   () => Promise<void>;
}

export interface UiSlice {
  isNewScanOpen:    boolean;
  setIsNewScanOpen: (v: boolean) => void;
  isProfileOpen:    boolean;
  setIsProfileOpen: (v: boolean) => void;
}

export interface ComparisonSlice {
  fetchingComparison: boolean;
  comparisonSummary:  string | null;
  fetchComparison: (patientId: string, idA: string, idB: string) => Promise<void>;
}
