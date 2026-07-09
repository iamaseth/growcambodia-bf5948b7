import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Loader2, BookOpen, AlertTriangle, Leaf, ChevronDown } from "lucide-react";
import { getOrGenerateCropGuide } from "@/lib/crop-guide.functions";

type Stage = { stage: string; duration: string };
type Disease = { name: string; symptoms: string; prevention: string };

export function CropGuide({ cropName }: { cropName: string }) {
  const [open, setOpen] = useState(false);
  const fn = useServerFn(getOrGenerateCropGuide);
  const { data, isLoading, error } = useQuery({
    queryKey: ["crop-guide", cropName.toLowerCase()],
    queryFn: () => fn({ data: { cropName } }),
    staleTime: 1000 * 60 * 60,
    retry: 1,
    enabled: open,
  });

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-muted/50 transition"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 font-semibold text-sm">
          <BookOpen className="h-4 w-4 text-primary" />
          Crop guide: {cropName}
        </span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t">
          {isLoading && (
            <div className="flex items-center gap-2 pt-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading crop guide…
            </div>
          )}
          {error && !isLoading && (
            <p className="pt-4 text-sm text-muted-foreground">Crop guide unavailable right now.</p>
          )}
          {data && <GuideBody data={data} />}
        </div>
      )}
    </Card>
  );
}

function GuideBody({ data }: { data: any }) {
  const lifecycle = (data.lifecycle as unknown as Stage[]) ?? [];
  const diseases = (data.diseases as unknown as Disease[]) ?? [];
  return (
    <div className="space-y-4 pt-4">
      <section>

        <h3 className="text-sm font-semibold flex items-center gap-1 mb-1">
          <Leaf className="h-4 w-4 text-primary" /> Growing conditions
        </h3>
        <p className="text-sm text-muted-foreground">{data.growing_conditions}</p>
      </section>

      {lifecycle.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold mb-1">Typical lifecycle</h3>
          <ul className="text-sm space-y-1">
            {lifecycle.map((s, i) => (
              <li key={i} className="flex justify-between gap-4 border-b border-border/40 py-1 last:border-0">
                <span>{s.stage}</span>
                <span className="text-muted-foreground text-right">{s.duration}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {diseases.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold flex items-center gap-1 mb-1">
            <AlertTriangle className="h-4 w-4 text-amber-600" /> Common diseases & pests
          </h3>
          <div className="space-y-2">
            {diseases.map((d, i) => (
              <div key={i} className="rounded border p-2 text-sm">
                <div className="font-medium">{d.name}</div>
                <div className="text-muted-foreground text-xs mt-0.5"><span className="font-semibold">Symptoms:</span> {d.symptoms}</div>
                <div className="text-muted-foreground text-xs"><span className="font-semibold">Prevention:</span> {d.prevention}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="text-[10px] text-muted-foreground">Guidance tailored for tropical Southeast Asia · region: {data.region}</p>
    </div>
  );
}
