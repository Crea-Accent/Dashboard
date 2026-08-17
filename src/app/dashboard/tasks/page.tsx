/** @format */
"use client";

import {
  CheckCircle2,
  Circle,
  Clock,
  ClipboardList,
  FolderOpen,
  ImageIcon,
  Search,
  Edit3,
} from "lucide-react";
import { useEffect, useState } from "react";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import CompleteTaskModal from "@/components/projects/tickets/CompleteTaskModal";
import EditTaskModal from "@/components/projects/tickets/EditTaskModal";
import EmptyState from "@/components/ui/EmptyState";
import File from "@/components/files/File";
import Input from "@/components/ui/Input";
import Link from "next/link";
import Loading from "@/components/ui/Loading";
import MultiSelector from "@/components/ui/MultiSelector";
import Toggle from "@/components/ui/Toggle";
import PageHeader from "@/components/ui/PageHeader";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import { usePermissions } from "@/providers/PermissionsProvider";

type Task = {
  id: string;
  description: string;
  technician: string;
  importance: number;
  requiresPicture?: boolean;
  state: "unfinished" | "finished";
  imagePath?: string;
  finishedImagePath?: string;
  completedBy?: string;
  proofDescription?: string;
  ticketId: string;
  ticketName: string;
  projectName: string;
  ticketCreatedAt: string;
  ticketOpenedBy: string;
};

export default function TasksPage() {
  const { data: session } = useSession();
  const { has } = usePermissions();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [taskToComplete, setTaskToComplete] = useState<Task | null>(null);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);

  const [query, setQuery] = useState("");
  const [stateFilters, setStateFilters] = useState<string[]>(["unfinished"]);
  const [seeAllTasks, setSeeAllTasks] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<{ label: string; value: string }[]>(
    [],
  );
  const [loadingUsers, setLoadingUsers] = useState(false);

  const username = session?.user?.name || session?.user?.email || "";

  const load = async () => {
    if (!username) return;
    try {
      setLoading(true);
      const url = seeAllTasks
        ? "/api/tasks?all=true"
        : `/api/tasks?technician=${encodeURIComponent(username)}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      load();
    }
  }, [session, seeAllTasks]);

  useEffect(() => {
    if (has("tasks.write") && seeAllTasks && allUsers.length === 0) {
      setLoadingUsers(true);
      fetch("/api/users")
        .then((res) => res.json())
        .then((data) => {
          if (data.users) {
            setAllUsers(
              data.users.map((u: any) => ({
                label: u.name || u.email,
                value: u.name || u.email,
                color: "var(--accent)",
              })),
            );
          }
        })
        .finally(() => setLoadingUsers(false));
    }
  }, [seeAllTasks, has, allUsers.length]);

  const markPOIDone = async (
    task: Task,
    finishedImagePath?: string,
    completedBy?: string,
    proofDescription?: string,
  ) => {
    // Optimistic update
    const updatedTasks = tasks.map((t) =>
      t.id === task.id
        ? {
            ...t,
            state: "finished" as const,
            finishedImagePath,
            completedBy,
            proofDescription,
          }
        : t,
    );
    setTasks(updatedTasks);

    // We need to fetch the specific ticket to update it correctly because our api needs the whole POI array
    try {
      const res = await fetch(
        `/api/projects/tickets?client=${encodeURIComponent(task.projectName)}`,
      );
      if (res.ok) {
        const data = await res.json();
        const ticket = data.tickets?.find((t: any) => t.id === task.ticketId);
        if (ticket) {
          const updatedPOIs = ticket.pois.map((poi: any) =>
            poi.id === task.id
              ? {
                  ...poi,
                  state: "finished" as const,
                  finishedImagePath,
                  completedBy,
                  proofDescription,
                }
              : poi,
          );

          await fetch("/api/projects/tickets", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              client: task.projectName,
              ticketId: task.ticketId,
              updates: { pois: updatedPOIs },
            }),
          });
        }
      }
    } catch (error) {
      console.error("Failed to mark task as done", error);
    }

    await load();
  };

  const filteredTasks = tasks.filter((task) => {
    if (
      query &&
      !task.description.toLowerCase().includes(query.toLowerCase()) &&
      !task.projectName.toLowerCase().includes(query.toLowerCase())
    )
      return false;
    if (stateFilters.length > 0 && !stateFilters.includes(task.state))
      return false;
    if (
      seeAllTasks &&
      selectedUsers.length > 0 &&
      !selectedUsers.includes(task.technician)
    )
      return false;
    return true;
  });

  if (loading) return <Loading title="Loading tasks" />;
  if (!has("tasks.read") && !has("tasks.write"))
    return (
      <EmptyState
        title="Access Denied"
        description="You do not have permission to view tasks."
      />
    );

  return (
    <motion.div className="space-y-6">
      <PageHeader
        icon={<ClipboardList size={20} />}
        title="My Tasks"
        description="View and manage tasks assigned to you across all projects"
      />

      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
        <div className="flex-1 w-full sm:w-auto">
          <Input
            icon={<Search size={16} />}
            placeholder="Search tasks or projects..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto flex-wrap">
          {has("tasks.write") && (
            <div className="flex items-center bg-(--foreground) border border-(--border)/20 rounded-xl px-4 h-[42px] min-w-48 shadow-sm">
              <Toggle
                checked={seeAllTasks}
                onChange={setSeeAllTasks}
                label="View All Tasks"
              />
            </div>
          )}
          {seeAllTasks && (
            <MultiSelector
              className="w-full sm:w-auto sm:min-w-48"
              placeholder={loadingUsers ? "Loading Users..." : "Filter by User"}
              value={selectedUsers}
              onChange={setSelectedUsers}
              options={allUsers}
            />
          )}
          <MultiSelector
            className="w-full sm:w-auto sm:min-w-48"
            placeholder="Filter by Status"
            value={stateFilters}
            onChange={setStateFilters}
            options={[
              {
                label: "Uncompleted",
                value: "unfinished",
                color: "var(--accent)",
              },
              {
                label: "Completed",
                value: "finished",
                color: "var(--green-500, #22c55e)",
              },
            ]}
          />
        </div>
      </div>

      {filteredTasks.length === 0 ? (
        <EmptyState
          title="No Tasks Found"
          description="You don't have any tasks matching your filters."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTasks.map((task, i) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="min-w-0"
            >
              <Card className="flex flex-col h-full hover:border-(--accent) transition-colors overflow-hidden min-w-0">
                <div className="p-4 flex-1 space-y-4 min-w-0">
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-2 text-sm text-(--text-muted) font-medium min-w-0">
                      <FolderOpen size={16} className="shrink-0" />
                      <Link
                        href={`/dashboard/projects/${encodeURIComponent(task.projectName)}`}
                        className="hover:text-(--accent) transition-colors truncate"
                      >
                        {task.projectName}
                      </Link>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium capitalize shrink-0 bg-zinc-500/10 text-zinc-500 font-mono">
                      #{task.importance || "-"}
                    </span>
                  </div>

                  <div
                    className={`text-sm break-words whitespace-normal space-y-1`}
                  >
                    <p
                      className={`${task.state === "finished" ? "line-through text-(--text-muted)" : ""}`}
                    >
                      {task.description}
                    </p>
                    {task.state === "finished" && task.completedBy && (
                      <p className="text-xs font-medium text-green-500">
                        Completed by: {task.completedBy}
                      </p>
                    )}
                  </div>

                  {task.imagePath && (
                    <div className="relative w-full overflow-hidden min-w-0">
                      <File
                        file={{
                          name:
                            task.imagePath.split(/[/\\]/).pop() || "POI.jpg",
                          path: task.imagePath,
                          type: "file",
                        }}
                        image
                      />
                    </div>
                  )}

                  {task.finishedImagePath && (
                    <div className="relative w-full overflow-hidden min-w-0">
                      <File
                        file={{
                          name:
                            task.finishedImagePath.split(/[/\\]/).pop() ||
                            "Proof.jpg",
                          path: task.finishedImagePath,
                          type: "file",
                        }}
                        image
                      />
                      <div className="absolute top-2 right-2 bg-green-500/90 backdrop-blur-md text-white px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-sm pointer-events-none">
                        <CheckCircle2 size={12} />
                        Proof
                      </div>
                    </div>
                  )}

                  {task.proofDescription && (
                    <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800/50 text-sm italic text-zinc-600 dark:text-zinc-400">
                      "{task.proofDescription}"
                    </div>
                  )}

                  <div className="text-xs text-(--text-muted) flex items-center gap-2 min-w-0 flex-wrap">
                    <Clock size={12} className="shrink-0" />
                    <span className="truncate min-w-0 flex-1">
                      Opened{" "}
                      {new Date(task.ticketCreatedAt).toLocaleDateString()} by{" "}
                      {task.ticketOpenedBy}
                    </span>
                  </div>
                </div>

                <div className="p-3 border-t border-(--border)/10 bg-(--background) flex items-center justify-between min-w-0 gap-2">
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-medium text-(--text-muted)">
                      {task.state === "finished" ? "Completed" : "Pending"}
                    </div>
                    {has("tasks.write") && (
                      <button
                        onClick={() => setTaskToEdit(task)}
                        className="text-(--text-muted) hover:text-(--accent) transition-colors p-1"
                        title="Edit Task"
                      >
                        <Edit3 size={14} />
                      </button>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant={task.state === "finished" ? "ghost" : "primary"}
                    disabled={task.state === "finished"}
                    onClick={() => setTaskToComplete(task)}
                    icon={
                      task.state === "finished" ? (
                        <CheckCircle2 size={16} className="text-green-500" />
                      ) : (
                        <Circle size={16} />
                      )
                    }
                  >
                    {task.state === "finished" ? "Done" : "Mark as Done"}
                  </Button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {taskToComplete && (
        <CompleteTaskModal
          open={true}
          client={taskToComplete.projectName}
          poiId={taskToComplete.id}
          requiresPicture={taskToComplete.requiresPicture}
          ticketId={taskToComplete.ticketId || taskToComplete.id.split("_")[0]}
          users={[]}
          onClose={() => setTaskToComplete(null)}
          onComplete={(imagePath, completedBy, proofDescription) =>
            markPOIDone(
              taskToComplete,
              imagePath,
              completedBy,
              proofDescription,
            )
          }
        />
      )}

      {taskToEdit && (
        <EditTaskModal
          open={true}
          task={taskToEdit}
          onClose={() => setTaskToEdit(null)}
          onSave={async () => {
            await load();
          }}
        />
      )}
    </motion.div>
  );
}
