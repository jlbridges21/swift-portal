import { renderSolutionOg, SOLUTION_OG_SIZE } from "@/lib/solutions-og";

export const alt = "ShootPortal photography booking software";
export const size = SOLUTION_OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return renderSolutionOg("booking");
}
