import React from "react";
import { History, FileJson, UserPlus, Trash2, Settings } from "lucide-react";
import { Card } from "../../../components/ui";

interface Activity {
  id: string;
  type: "CREATE" | "LOAD" | "DELETE" | "EXPORT" | "IMPORT" | "CHANGE";
  message: string;
  timestamp: string;
}

export const RecentActivity: React.FC = () => {
  // Mock data for now
  const activities: Activity[] = [
    {
      id: "1",
      type: "CHANGE",
      message: "Modified Teacher 'John Doe' constraints",
      timestamp: "2 minutes ago",
    },
    {
      id: "2",
      type: "EXPORT",
      message: "Exported backup to 'timetable_backup.json'",
      timestamp: "1 hour ago",
    },
    {
      id: "3",
      type: "LOAD",
      message: "Loaded profile 'Default Profile'",
      timestamp: "3 hours ago",
    },
    {
      id: "4",
      type: "CREATE",
      message: "Created new profile 'Semester 2'",
      timestamp: "Yesterday",
    },
  ];

  const getIcon = (type: Activity["type"]) => {
    switch (type) {
      case "CREATE": return <UserPlus size={14} />;
      case "LOAD": return <FileJson size={14} />;
      case "DELETE": return <Trash2 size={14} />;
      case "EXPORT": return <FileJson size={14} />;
      case "IMPORT": return <FileJson size={14} />;
      case "CHANGE": return <Settings size={14} />;
      default: return <History size={14} />;
    }
  };

  const getColor = (type: Activity["type"]) => {
    switch (type) {
      case "CREATE": return "text-emerald-500 bg-emerald-50";
      case "LOAD": return "text-blue-500 bg-blue-50";
      case "DELETE": return "text-red-500 bg-red-50";
      case "EXPORT": return "text-amber-500 bg-amber-50";
      case "IMPORT": return "text-violet-500 bg-violet-50";
      case "CHANGE": return "text-slate-500 bg-slate-50";
      default: return "text-slate-500 bg-slate-50";
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
        <div className="p-2 bg-slate-100 text-slate-600 rounded-lg">
          <History size={20} />
        </div>
        <h3 className="font-bold text-slate-800">Recent Activity</h3>
      </div>

      <div className="space-y-4">
        {activities.map((activity) => (
          <div key={activity.id} className="flex gap-4 group">
            <div className={`mt-1 p-2 rounded-full h-fit transition-transform group-hover:scale-110 ${getColor(activity.type)}`}>
              {getIcon(activity.type)}
            </div>
            <div className="flex-1 border-b border-slate-50 pb-3 group-last:border-none group-last:pb-0">
              <p className="text-sm font-medium text-slate-700 leading-snug">
                {activity.message}
              </p>
              <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">
                {activity.timestamp}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
