"use client";

import { useId } from "react";
export type HomeOccupancy = "rental" | "owner_occupied";

export function OccupancyChoice({ value, onChange, disabled = false }: { value: HomeOccupancy | null; onChange: (value: HomeOccupancy) => void; disabled?: boolean }) {
  const id = useId();
  return <fieldset className="occupancy-choice" disabled={disabled}><legend>Home occupancy — select one</legend>
    <label className="rental-toggle" htmlFor={`${id}-rental`}><input id={`${id}-rental`} type="radio" name="occupancy_choice" value="rental" required checked={value === "rental"} onChange={() => onChange("rental")} />I rent out or lease my home.</label>
    <label className="rental-toggle" htmlFor={`${id}-resident`}><input id={`${id}-resident`} type="radio" name="occupancy_choice" value="owner_occupied" required checked={value === "owner_occupied"} onChange={() => onChange("owner_occupied")} />I currently live in this home.</label>
  </fieldset>;
}
