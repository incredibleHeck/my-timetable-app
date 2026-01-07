import { AppData } from './index';

export interface ProfileMetadata {
  description?: string;
  academicYear?: string;
}

export interface ProfileManifest {
  profiles: {
    id: string;
    name: string;
    lastModified: number;
  }[];
  activeProfileId: string | null;
}

export interface Profile {
  id: string;
  name: string;
  created: number;
  lastModified: number;
  data: AppData;
  meta: ProfileMetadata;
}

export const validateProfile = (data: any): data is Profile => {
  if (typeof data !== 'object' || data === null) return false;
  
  const p = data as Partial<Profile>;
  
  if (typeof p.id !== 'string' || !p.id) return false;
  if (typeof p.name !== 'string' || !p.name) return false;
  if (typeof p.created !== 'number') return false;
  if (typeof p.lastModified !== 'number') return false;
  
  if (typeof p.data !== 'object' || p.data === null) return false;
  // We don't deeply validate AppData here for performance, assuming basic structure
  
  if (typeof p.meta !== 'object' || p.meta === null) return false;
  
  return true;
};
