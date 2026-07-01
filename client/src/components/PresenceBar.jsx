import React from "react";
import { colorFor, initials } from "../utils.js";

export default function PresenceBar({ presence }) {
  const now = Date.now();
  const entries = Object.entries(presence).sort((a, b) => a[1].name.localeCompare(b[1].name));

  return (
    <div className="presence-row">
      {entries.map(([id, info]) => {
        const online = now - info.lastSeen < 15000;
        return (
          <div
            key={id}
            className={"avatar" + (online ? " online" : "")}
            style={{ background: colorFor(id) }}
            title={info.name + (online ? " (online)" : " (away)")}
          >
            {initials(info.name)}
            <span className={"dot " + (online ? "on" : "off")}></span>
          </div>
        );
      })}
      <span className="presence-names">
        {entries.length ? entries.map((e) => e[1].name).join(", ") : "Just you so far — share the room code!"}
      </span>
    </div>
  );
}
