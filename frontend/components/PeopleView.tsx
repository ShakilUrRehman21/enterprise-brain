"use client";

import React, { useEffect, useState } from "react";
import { ApiError, api } from "@/lib/api";
import type { Role, User } from "@/lib/types";
import { Notice, PageHeader, Spinner, cx, formatDate } from "./ui";

export function PeopleView({ me }: { me: User }) {
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    api.users().then(setUsers).catch((e: ApiError) => setError(e.message));
  }, []);

  const update = async (u: User, data: { role?: Role; is_active?: boolean }) => {
    setSaving(u.id);
    setError(null);
    try {
      const updated = await api.updateUser(u.id, data);
      setUsers((list) => list?.map((x) => (x.id === u.id ? updated : x)) ?? null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't update this person.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-8 sm:py-12">
      <PageHeader
        title="People"
        description="Admins can see every document, manage anyone's documents, add sample data and run the answer-quality benchmark. Deactivated people can't sign in."
      />
      {error && <Notice tone="error" className="mt-5">{error}</Notice>}
      {!users && !error && (
        <div className="mt-12 flex justify-center text-graphite">
          <Spinner />
        </div>
      )}
      {users && (
        <ul className="mt-6 divide-y divide-rule border-y border-rule">
          {users.map((u) => (
            <li key={u.id} className={cx("flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center", !u.is_active && "opacity-60")}>
              <div className="min-w-0 flex-1">
                <div className="font-medium">
                  {u.full_name}
                  {u.id === me.id && <span className="ml-2 text-sm font-normal text-graphite">You</span>}
                </div>
                <div className="text-sm text-graphite">
                  {u.email}
                  <span className="ml-3 text-faint">Joined {formatDate(u.created_at)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {saving === u.id && <Spinner className="h-3.5 w-3.5 text-graphite" />}
                <label className="sr-only" htmlFor={`role-${u.id}`}>
                  Role for {u.full_name}
                </label>
                <select
                  id={`role-${u.id}`}
                  className="field h-8 w-auto py-0 text-sm"
                  value={u.role}
                  disabled={u.id === me.id || saving === u.id}
                  onChange={(e) => update(u, { role: e.target.value as Role })}
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                {u.id !== me.id && (
                  <button
                    type="button"
                    disabled={saving === u.id}
                    onClick={() => update(u, { is_active: !u.is_active })}
                    className="h-8 rounded px-2.5 text-sm text-graphite hover:bg-sunk hover:text-ink"
                  >
                    {u.is_active ? "Deactivate" : "Reactivate"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
