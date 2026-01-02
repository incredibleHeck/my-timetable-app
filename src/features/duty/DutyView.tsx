import React, { useState, useMemo } from "react";
import {
  Plus,
  Trash2,
  Shield,
  Users,
  MapPin,
  AlertTriangle,
  ChevronRight,
  UserPlus,
} from "lucide-react";
import { AppData, DutyAssignment, DutyLocation, PeriodType } from "../../types";
import { Button, Modal, Input, Select, Badge } from "../../components/ui";
import { generateId } from "../../utils/utils";
import { DAYS } from "../../utils/constants";

interface ViewProps {
  data: AppData;
  onUpdate: (newData: AppData) => void;
}

export const DutyView: React.FC<ViewProps> = ({ data, onUpdate }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [locationName, setLocationName] = useState("");

  const [activeTab, setActiveTab] = useState<"ROSTER" | "LOCATIONS">("ROSTER");

  // Filter periods that are actually BREAK or LUNCH
  const dutyPeriods = useMemo(() => {
    return data.settings.dayStructure
      .map((p, i) => ({ ...p, index: i }))
      .filter((p) => p.type === "BREAK" || p.type === "LUNCH");
  }, [data.settings.dayStructure]);

  const handleAddLocation = () => {
    if (!locationName.trim()) return;
    const newLoc: DutyLocation = { id: generateId(), name: locationName.trim() };
    onUpdate({ ...data, dutyLocations: [...(data.dutyLocations || []), newLoc] });
    setLocationName("");
    setModalOpen(false);
  };

  const handleRemoveLocation = (id: string) => {
    if (confirm("Remove this location and all its assignments?")) {
      onUpdate({
        ...data,
        dutyLocations: data.dutyLocations.filter((l) => l.id !== id),
        dutyAssignments: (data.dutyAssignments || []).filter((a) => a.locationId !== id),
      });
    }
  };

  const toggleAssignment = (locId: string, day: number, period: number, teacherId: string) => {
    const existing = (data.dutyAssignments || []).find(
      (a) => a.locationId === locId && a.day === day && a.period === period && a.teacherId === teacherId
    );

    if (existing) {
      onUpdate({ ...data, dutyAssignments: data.dutyAssignments.filter((a) => a.id !== existing.id) });
    } else {
      const newAsgn: DutyAssignment = { id: generateId(), locationId: locId, day, period, teacherId };
      onUpdate({ ...data, dutyAssignments: [...(data.dutyAssignments || []), newAsgn] });
    }
  };

  const getTeachersFreeAt = (day: number, period: number) => {
    return data.teachers.filter((t) => {
      // 1. Not teaching a class
      const isTeaching = Object.keys(data.schedule).some((cid) => data.schedule[cid]?.[day]?.[period]);
      // 2. Not blocked by manual constraint
      const isBlocked = t.constraints?.[day]?.[period];
      return !isTeaching && !isBlocked;
    });
  };

  const getDutyCount = (teacherId: string) => {
    return (data.dutyAssignments || []).filter((a) => a.teacherId === teacherId).length;
  };

  return (
    <div className="max-w-7xl mx-auto p-8 space-y-6 animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Shield className="text-amber-500" /> Duty Roster
          </h2>
          <p className="text-xs text-slate-500">Manage teacher supervision during breaks and lunch.</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab("ROSTER")}
            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${activeTab === "ROSTER" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}
          >
            Roster Grid
          </button>
          <button
            onClick={() => setActiveTab("LOCATIONS")}
            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${activeTab === "LOCATIONS" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}
          >
            Locations
          </button>
        </div>
      </div>

      {activeTab === "LOCATIONS" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center gap-4">
            <MapPin className="text-slate-300" size={32} />
            <div className="w-full space-y-2">
              <Input
                label="New Location Name"
                placeholder="e.g. Playground South"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
              />
              <Button className="w-full" onClick={handleAddLocation} icon={<Plus size={16} />}>
                Add Location
              </Button>
            </div>
          </div>
          {(data.dutyLocations || []).map((loc) => (
            <div key={loc.id} className="bg-white border border-slate-200 rounded-xl p-5 flex justify-between items-center shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-400">
                  <MapPin size={20} />
                </div>
                <span className="font-bold text-slate-700">{loc.name}</span>
              </div>
              <button onClick={() => handleRemoveLocation(loc.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      )}

      {activeTab === "ROSTER" && (
        <div className="space-y-8">
          {dutyPeriods.length === 0 ? (
            <div className="py-20 text-center bg-white rounded-xl border border-slate-200 shadow-sm">
              <AlertTriangle className="mx-auto text-amber-500 mb-4" size={48} />
              <h3 className="font-bold text-slate-800">No Break Periods Defined</h3>
              <p className="text-sm text-slate-500 mt-2">Go to Global Config to define Breaks or Lunch slots first.</p>
            </div>
          ) : (data.dutyLocations || []).length === 0 ? (
            <div className="py-20 text-center bg-white rounded-xl border border-slate-200 shadow-sm">
              <MapPin className="mx-auto text-slate-300 mb-4" size={48} />
              <h3 className="font-bold text-slate-800">No Locations Defined</h3>
              <p className="text-sm text-slate-500 mt-2">Switch to the "Locations" tab to add your first duty spot.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-r">Time / Period</th>
                    {(data.dutyLocations || []).map((loc) => (
                      <th key={loc.id} className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
                        {loc.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {DAYS.map((dayName, dIdx) => (
                    <React.Fragment key={dayName}>
                      <tr className="bg-slate-50/50">
                        <td colSpan={(data.dutyLocations?.length || 0) + 1} className="px-4 py-2 text-[10px] font-bold text-amber-600 uppercase border-y border-slate-200">
                          {dayName}
                        </td>
                      </tr>
                      {dutyPeriods.map((p) => (
                        <tr key={`${dIdx}-${p.index}`} className="group hover:bg-slate-50/30 transition-colors">
                          <td className="p-4 border-r whitespace-nowrap">
                            <div className="font-bold text-slate-700 text-xs">{p.label}</div>
                            <div className="text-[10px] text-slate-400 font-medium">({p.type})</div>
                          </td>
                          {(data.dutyLocations || []).map((loc) => {
                            const assignments = (data.dutyAssignments || []).filter(
                              (a) => a.locationId === loc.id && a.day === dIdx && a.period === p.index
                            );
                            const freeTeachers = getTeachersFreeAt(dIdx, p.index);

                            return (
                              <td key={loc.id} className="p-2 align-top">
                                <div className="flex flex-col gap-1 items-center min-h-[60px]">
                                  {assignments.map((asgn) => {
                                    const t = data.teachers.find((x) => x.id === asgn.teacherId);
                                    return (
                                      <div key={asgn.id} className="w-full flex items-center justify-between bg-amber-50 border border-amber-200 text-amber-800 px-2 py-1 rounded group/asgn">
                                        <span className="text-[10px] font-bold truncate">{t?.name}</span>
                                        <button onClick={() => toggleAssignment(loc.id, dIdx, p.index, asgn.teacherId)} className="opacity-0 group-hover/asgn:opacity-100 p-0.5 hover:text-red-600">
                                          <Trash2 size={10} />
                                        </button>
                                      </div>
                                    );
                                  })}
                                  
                                  <div className="relative group/add w-full">
                                    <button className="w-full flex items-center justify-center py-2 rounded border-2 border-dashed border-slate-100 text-slate-300 hover:border-amber-300 hover:text-amber-500 hover:bg-amber-50 transition-all">
                                      <UserPlus size={14} />
                                    </button>
                                    
                                    {/* Dropdown for adding teachers */}
                                    <div className="absolute top-full left-0 z-50 w-48 bg-white border border-slate-200 rounded-lg shadow-xl hidden group-hover/add:block max-h-48 overflow-y-auto custom-scrollbar">
                                      <div className="p-2 text-[9px] font-black text-slate-400 uppercase border-b bg-slate-50 sticky top-0">Available Teachers</div>
                                      {freeTeachers.length === 0 ? (
                                        <div className="p-3 text-[10px] italic text-slate-400">All teachers busy teaching.</div>
                                      ) : (
                                        freeTeachers.map(t => {
                                          const isAssignedHere = assignments.some(a => a.teacherId === t.id);
                                          const load = getDutyCount(t.id);
                                          if (isAssignedHere) return null;
                                          return (
                                            <button
                                              key={t.id}
                                              onClick={() => toggleAssignment(loc.id, dIdx, p.index, t.id)}
                                              className="w-full text-left px-3 py-2 text-[10px] font-bold text-slate-600 hover:bg-amber-50 hover:text-amber-700 flex justify-between items-center border-b border-slate-50 last:border-none"
                                            >
                                              <span>{t.name}</span>
                                              <span className="text-[8px] bg-slate-100 text-slate-400 px-1 rounded">{load} pts</span>
                                            </button>
                                          );
                                        })
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
