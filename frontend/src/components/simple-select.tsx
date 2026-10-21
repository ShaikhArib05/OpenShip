"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface Option {
  value: string;
  label: string;
}

export function SimpleSelect({
  value,
  onChange,
  options,
  placeholder,
  className,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
  id?: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as string)} items={options}>
      <SelectTrigger id={id} className={className ?? "w-full"}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
