/** @format */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  CalendarClock,
  History,
  Calendar,
  Clock,
  MapPin,
  Users,
} from "lucide-react";
import EventModal from "@/components/events/EventModal";

export default function Page() {
  const [events, setEvents] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  async function loadEvents() {
    try {
      const response = await fetch("/api/events");
      const json = await response.json();
      setEvents(json.events || []);
    } catch (error) {
      console.error("Failed to load events", error);
    }
  }

  useEffect(() => {
    loadEvents();
  }, []);

  const now = new Date();

  const categorized = events.reduce(
    (acc, event) => {
      const welcomeStr = event.welcomeTime || event.time || "00:00";
      const endStr = event.endTime || "23:59";

      // Create date objects for comparison
      const welcomeDate = new Date(`${event.date}T${welcomeStr}:00`);
      const endDate = new Date(`${event.date}T${endStr}:00`);

      if (now < welcomeDate) {
        acc.upcoming.push(event);
      } else if (now > endDate) {
        acc.past.push(event);
      } else {
        acc.happening.push(event);
      }

      return acc;
    },
    { upcoming: [] as any[], happening: [] as any[], past: [] as any[] },
  );

  const EventGrid = ({
    title,
    icon: Icon,
    iconColor,
    data,
  }: {
    title: string;
    icon: any;
    iconColor: string;
    data: any[];
  }) => {
    if (data.length === 0) return null;

    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6 space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Icon size={20} className={iconColor} />
          {title}
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map((event) => (
            <Link
              href={`/dashboard/events/${event.id}`}
              key={event.id}
              className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 bg-zinc-50 dark:bg-zinc-800 space-y-2 block hover:border-(--accent) transition-colors cursor-pointer"
            >
              <h3 className="font-semibold text-lg text-zinc-900 dark:text-zinc-100">
                {event.name}
              </h3>
              <div className="text-sm text-zinc-500 space-y-1.5">
                <p className="flex items-center gap-2">
                  <Calendar size={14} className="text-zinc-400" /> {event.date}
                </p>
                <p className="flex items-center gap-2">
                  <Clock size={14} className="text-zinc-400" />{" "}
                  {event.welcomeTime
                    ? `${event.welcomeTime} (Welcome)`
                    : event.time}
                </p>
                {event.location && (
                  <p className="flex items-center gap-2">
                    <MapPin size={14} className="text-zinc-400" />{" "}
                    {event.location}
                  </p>
                )}
                <p className="flex items-center gap-2">
                  <Users size={14} className="text-zinc-400" />{" "}
                  {event.invites?.length || 0} Invited
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            Events
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Manage group rotations and event invites.
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="h-10 px-4 rounded-xl bg-(--accent) text-white font-medium hover:bg-(--hover-accent) transition-colors shrink-0"
        >
          New Event
        </button>
      </div>

      {/* CATEGORIZED LISTS */}
      <div className="space-y-6">
        <EventGrid
          title="Happening Now"
          icon={Activity}
          iconColor="text-red-500"
          data={categorized.happening}
        />
        <EventGrid
          title="Upcoming Events"
          icon={CalendarClock}
          iconColor="text-emerald-500"
          data={categorized.upcoming}
        />
        <EventGrid
          title="Past Events"
          icon={History}
          iconColor="text-zinc-400"
          data={categorized.past}
        />
      </div>

      <EventModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={loadEvents}
      />
    </div>
  );
}
