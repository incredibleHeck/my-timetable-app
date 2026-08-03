import React from "react";
import { History, Zap, Settings, BookOpen, AlertCircle } from "lucide-react";
import { Card } from "../../../components/ui";
import { useProfile } from "../../../contexts/ProfileContext";
import { ActivityType } from "../../../types";
import { formatRelativeTime } from "../../../utils/utils";

export const RecentActivity: React.FC = () => {
  const { activeProfile } = useProfile();

  const activities = activeProfile?.data.recentActivity || [];

  const getIcon = (type: ActivityType) => {
    switch (type) {
      case "SCHEDULING":
        return <Zap size={14} />;
      case "ACADEMIC":
        return <BookOpen size={14} />;
      case "SYSTEM":
        return <Settings size={14} />;
      default:
        return <History size={14} />;
    }
  };

  const getColor = (type: ActivityType) => {
    switch (type) {
      case "SCHEDULING":
        return "text-accent-ink bg-amber-50 dark:bg-amber-900/30";
      case "ACADEMIC":
        return "text-blue-500 bg-blue-50";
      case "SYSTEM":
        return "text-content-muted bg-slate-50 dark:bg-slate-900";
      default:
        return "text-content-muted bg-slate-50 dark:bg-slate-900";
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-700">
        <div className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg">
          <History size={20} />
        </div>
        <h3 className="font-bold text-slate-800 dark:text-slate-100">Recent Activity</h3>
      </div>

      <div className="space-y-4">
        {activities.length > 0 ? (
          activities.map((activity) => (
            <div key={activity.id} className="flex gap-4 group">
              <div
                className={`mt-1 p-2 rounded-full h-fit transition-transform group-hover:scale-110 ${getColor(activity.type)}`}
              >
                {getIcon(activity.type)}
              </div>
              <div className="flex-1 border-b border-slate-50 pb-3 group-last:border-none group-last:pb-0">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200 leading-snug">
                  {activity.message}
                </p>
                <p className="text-2xs font-bold text-content-muted mt-1 uppercase tracking-wider">
                  {formatRelativeTime(activity.timestamp)}
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="p-3 bg-slate-50 dark:bg-slate-900 text-slate-300 rounded-full mb-3">
              <AlertCircle size={24} />
            </div>
            <p className="text-xs font-bold text-content-muted uppercase tracking-widest">
              No recent activity
            </p>
            <p className="text-2xs text-content-muted mt-1 max-w-[180px]">
              Your scheduling actions and data changes will appear here.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};
