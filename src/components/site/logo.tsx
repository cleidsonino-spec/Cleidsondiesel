import { Link } from "@tanstack/react-router";
import { Fuel } from "lucide-react";

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-sm bg-gradient-primary shadow-glow">
        <Fuel className="size-5 text-primary-foreground" />
      </span>
      <span className="font-display text-lg uppercase leading-none tracking-tight">
        Cleidson<span className="text-primary"> Diesel</span>
      </span>
    </Link>
  );
}
