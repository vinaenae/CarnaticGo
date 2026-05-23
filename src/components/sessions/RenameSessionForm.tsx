"use client";

import { useEffect, useState } from "react";
import { updateSessionTitle } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function RenameSessionForm({
  sessionId,
  initialTitle,
  large,
}: {
  sessionId: string;
  initialTitle: string;
  large?: boolean;
}) {
  const [title, setTitle] = useState(initialTitle);

  useEffect(() => {
    setTitle(initialTitle);
  }, [initialTitle]);

  return (
    <form
      action={updateSessionTitle}
      className={large ? "flex flex-col gap-3" : "flex flex-wrap items-center gap-2"}
    >
      <input type="hidden" name="sessionId" value={sessionId} />
      <Input
        name="title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className={large ? "h-11 text-base" : "h-8 max-w-[220px] text-sm"}
        maxLength={120}
        required
        aria-label="Session name"
      />
      <Button type="submit" size={large ? "default" : "sm"} variant={large ? "default" : "outline"}>
        Save name
      </Button>
    </form>
  );
}
