import { Link } from "@tanstack/react-router";
import logoAsset from "@/assets/logo-cleidson-diesel.png.asset.json";

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <img
        src={logoAsset.url}
        alt="Cleidson Diesel — Serviço de bombas e bicos injetores"
        className="size-10 rounded-full object-cover shadow-glow"
      />
      <span className="font-display text-lg uppercase leading-none tracking-tight">
        Cleidson<span className="text-primary"> Diesel</span>
      </span>
    </Link>
  );
}
