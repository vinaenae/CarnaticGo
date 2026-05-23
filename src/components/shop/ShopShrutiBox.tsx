"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_TANPURA_KEY,
  TANPURA_SAMPLE_MANIFEST,
  labelForTanpuraKey,
} from "@/lib/audio/tanpura-manifest";
import { getTanpuraService } from "@/lib/audio/TanpuraService";

export function ShopShrutiBox() {
  const [key, setKey] = useState(DEFAULT_TANPURA_KEY);
  const [looping, setLooping] = useState(false);
  const readyRef = useRef(false);

  useEffect(() => {
    void getTanpuraService().preload().then(() => {
      readyRef.current = true;
    });
    return () => {
      getTanpuraService().stop();
    };
  }, []);

  const stop = () => {
    getTanpuraService().stop();
    setLooping(false);
  };

  const playPreview = () => {
    stop();
    getTanpuraService().playPreview(key, 4000);
  };

  const toggleLoop = () => {
    if (looping) {
      stop();
      return;
    }
    getTanpuraService().play(key);
    setLooping(true);
  };

  return (
    <div className="space-y-3 rounded-lg border border-border/80 bg-muted/20 p-4">
      <label className="block text-sm font-medium text-foreground" htmlFor="shop-shruti-key">
        Shruti (kattai)
      </label>
      <select
        id="shop-shruti-key"
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
        value={key}
        onChange={(e) => {
          setKey(e.target.value);
          if (looping) {
            getTanpuraService().play(e.target.value);
          }
        }}
      >
        {TANPURA_SAMPLE_MANIFEST.map((e) => (
          <option key={e.key} value={e.key}>
            {labelForTanpuraKey(e.key)}
          </option>
        ))}
      </select>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={playPreview}>
          <Play className="mr-1 size-3.5" aria-hidden />
          Preview
        </Button>
        <Button type="button" variant={looping ? "default" : "outline"} size="sm" onClick={toggleLoop}>
          {looping ? (
            <Pause className="mr-1 size-3.5" aria-hidden />
          ) : (
            <Play className="mr-1 size-3.5" aria-hidden />
          )}
          {looping ? "Stop drone" : "Start drone"}
        </Button>
      </div>
    </div>
  );
}
