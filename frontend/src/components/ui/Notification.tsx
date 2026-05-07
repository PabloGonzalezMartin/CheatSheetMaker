"use client";
import { useEditorStore } from "@/store/editorStore";

export function NotificationContainer() {
  const { notifications, removeNotification } = useEditorStore();

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {notifications.map((n) => (
        <div
          key={n.id}
          onClick={() => removeNotification(n.id)}
          className={`pointer-events-auto px-4 py-3 rounded-lg text-white text-sm font-medium shadow-lg cursor-pointer animate-slide-in
            ${n.type === "success"
              ? "bg-gradient-to-r from-green-400 to-teal-500"
              : "bg-gradient-to-r from-red-400 to-pink-500"}`}
        >
          {n.message}
        </div>
      ))}
    </div>
  );
}
