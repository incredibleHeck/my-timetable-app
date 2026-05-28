import { AppData } from "./index";

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

export { validateProfile, parseProfile, profileSchema } from "../schemas/profile";
