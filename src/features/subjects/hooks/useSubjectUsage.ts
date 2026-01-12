import { AppData } from "../../../types";

export const useSubjectUsage = (data: AppData) => {
  const getSubjectUsage = (subjectId: string) => {
    const teacherCount = data.teachers.filter((t) =>
      t.specialtyIds.includes(subjectId)
    ).length;
    let classCount = 0;
    data.classes.forEach((c) => {
      if (c.curriculum.some((curr) => curr.subjectId === subjectId))
        classCount++;
    });
    return { teacherCount, classCount };
  };

  return { getSubjectUsage };
};
