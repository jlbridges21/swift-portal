"use client";

import { useEffect, useState } from "react";
import { Select } from "@/components/ui/select";

interface ServiceSelectProps {
  id: string;
  name: string;
  required?: boolean;
  placeholder?: string;
}

export function ServiceSelect({ id, name, required, placeholder = "Select a service" }: ServiceSelectProps) {
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    fetch("/api/catalog/services", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.options)) setOptions(data.options);
      })
      .catch(() => undefined);
  }, []);

  return (
    <Select
      id={id}
      name={name}
      required={required}
      placeholder={placeholder}
      options={options}
    />
  );
}
