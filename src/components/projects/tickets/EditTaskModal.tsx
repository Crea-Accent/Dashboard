/** @format */
"use client";

import { useEffect, useState } from "react";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Selector from "@/components/ui/Selector";

type Task = {
  id: string;
  description: string;
  technician: string;
  ticketId: string;
  ticketName: string;
  projectName: string;
  [key: string]: any;
};

type EditTaskModalProps = {
  open: boolean;
  task: Task;
  onClose: () => void;
  onSave: () => Promise<void>;
};

export default function EditTaskModal({
  open,
  task,
  onClose,
  onSave,
}: EditTaskModalProps) {
  const [ticketName, setTicketName] = useState(task.ticketName || "");
  const [description, setDescription] = useState(task.description || "");
  const [technician, setTechnician] = useState(task.technician || "");
  const [users, setUsers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => {
        if (data.users) setUsers(data.users);
      });
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);

      // We need to fetch the full ticket to patch the specific POI inside its POI array
      const res = await fetch(
        `/api/projects/tickets?client=${encodeURIComponent(task.projectName)}`,
      );
      if (!res.ok) throw new Error("Failed to fetch tickets");
      const data = await res.json();
      const fullTicket = data.tickets?.find((t: any) => t.id === task.ticketId);

      if (!fullTicket) throw new Error("Ticket not found");

      const updatedPOIs = fullTicket.pois.map((poi: any) =>
        poi.id === task.id ? { ...poi, description, technician } : poi,
      );

      await fetch("/api/projects/tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client: task.projectName,
          ticketId: task.ticketId,
          updates: {
            name: ticketName,
            pois: updatedPOIs,
          },
        }),
      });

      await onSave();
      onClose();
    } catch (error) {
      console.error("Failed to update task", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Edit Task"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            Save Changes
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="mb-4">
          <Input
            label="Ticket Name"
            value={ticketName}
            onChange={(e) => setTicketName(e.target.value)}
          />
          <p className="text-xs text-(--text-muted) mt-1">
            Warning: Editing this changes the name for all tasks in this ticket.
          </p>
        </div>

        <Input
          label="Task Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div className="pt-2">
          <label className="text-sm font-medium text-(--text) block mb-2">
            Assign Technician
          </label>
          <Selector
            value={technician}
            onChange={(v) => setTechnician(v)}
            options={[
              { label: "Unassigned", value: "" },
              ...users.map((u) => ({
                label: u.name || u.username || u.id,
                value: u.username || u.name || u.id,
              })),
            ]}
          />
        </div>
      </div>
    </Modal>
  );
}
