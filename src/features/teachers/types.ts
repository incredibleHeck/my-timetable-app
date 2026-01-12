export interface Teacher {
  id: string;
  name: string;
  specialtyIds: string[];
  constraints: boolean[][]; // [day][period] true=blocked
  targetLoad?: number; // Desired periods per week
}
