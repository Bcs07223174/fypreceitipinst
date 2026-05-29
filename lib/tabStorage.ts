const STORAGE_KEY = 'medicare_open_tabs_v1';

const TAB_LABELS: Record<string, string> = {
  '/': 'Dashboard',
  '/scan': 'QR Scanner',
  '/appointments': 'Appointments',
  '/patient-booking': 'Patient Booking',
  '/queue': 'Patient Queue',
  '/profile': 'Profile',
};

export const getTabLabel = (path: string): string => TAB_LABELS[path] || path.replace('/', '') || 'Dashboard';

export const getOpenTabs = (): string[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Error reading open tabs from localStorage', e);
    return [];
  }
};

export const saveOpenTabs = (tabs: string[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(new Set(tabs))));
  } catch (e) {
    console.error('Error saving open tabs to localStorage', e);
  }
};

export const addOpenTab = (path: string) => {
  if (!path) return;
  const tabs = getOpenTabs();
  tabs.push(path);
  saveOpenTabs(tabs);
};

export const clearOpenTabs = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Error clearing open tabs', e);
  }
};

export default {
  getTabLabel,
  getOpenTabs,
  saveOpenTabs,
  addOpenTab,
  clearOpenTabs,
};
