export const ROOM_TYPES = [
  { value: "Classroom", label: "Standard Classroom" },
  { value: "Lab", label: "Laboratory" },
  { value: "Library", label: "Library" },
  { value: "Gym", label: "Gymnasium" },
  { value: "Art Studio", label: "Art Studio" },
  { value: "Music Room", label: "Music Room" },
  { value: "Hall", label: "Assembly Hall" },
  { value: "Computer Lab", label: "Computer Lab" },
  { value: "Workshop", label: "Workshop" },
];

/** Stored values and display labels differ ("Classroom" vs "Standard Classroom"). */
export const roomTypeLabel = (value: string) =>
  ROOM_TYPES.find((t) => t.value === value)?.label ?? value;
