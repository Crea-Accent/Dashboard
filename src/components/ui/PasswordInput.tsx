/** @format */

"use client";

import { Copy, Eye, EyeOff, RefreshCw } from "lucide-react";

import Button from "./Button";
import Input from "./Input";
import { useState } from "react";

type Props = {
  label?: string;
  value: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
  showGenerator?: boolean;
};

const CHARS =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";

function generatePassword(length = 32) {
  const array = new Uint32Array(length);

  crypto.getRandomValues(array);

  return Array.from(array)
    .map((x) => CHARS[x % CHARS.length])
    .join("");
}

export default function PasswordInput({
  label = "Password",
  value,
  readOnly = false,
  onChange,
  showGenerator = true,
}: Props) {
  const [visible, setVisible] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
  }

  function generate() {
    if (readOnly) return;

    onChange?.(generatePassword());
  }

  return (
    <div className="flex items-end gap-2">
      <div className="flex-1">
        <Input
          label={label}
          type={visible ? "text" : "password"}
          value={value}
          readOnly={readOnly}
          onChange={(e) => onChange?.(e.target.value)}
        />
      </div>

      <Button
        variant="secondary"
        icon={visible ? <EyeOff size={16} /> : <Eye size={16} />}
        onClick={() => setVisible((v) => !v)}
      />

      <Button
        variant="secondary"
        icon={<Copy size={16} />}
        onClick={copy}
        disabled={!value}
      />

      {showGenerator && !readOnly && (
        <Button
          variant="secondary"
          icon={<RefreshCw size={16} />}
          onClick={generate}
        />
      )}
    </div>
  );
}
