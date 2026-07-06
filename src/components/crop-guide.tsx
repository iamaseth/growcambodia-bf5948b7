import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Loader2, BookOpen, AlertTriangle, Leaf } from "lucide-react";
import { getOrGenerateCropGuide } from "@/lib/crop-guide.functions";

type Stage = { stage: string; duration: string };
type Disease = { name: string; symptoms: string; prevention: string };

export function CropGuide({ cropName }: { cropName: string }) {
  const fn = useServerFn(getOrGenerateCropGuide);
  const { data, isLoading, error } = useQuery({
    queryKey: ["crop-guide", cropName.toLowerCase()],
    queryFn: () => fn({ data: { cropName } }),
    staleTime: 1000 * 60 * 60,
    retry: 1,
  });

  if (isLoading) {
    return (
      <Card className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading crop guide for {cropName}…
      </Card>
    );
  }
  if (error || !data) {
    return (
      <Card className="p-4 text-sm text-muted-foreground">
        Crop guide unavailable right now.
      </Card>
    );
  }

  const lifecycle = (data.lifecycle as unknown as Stage[]) ?? [];
  const diseases = (data.diseases as unknown as Disease[]) ?? [];

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-primary" />
        <h2 className="font-semibold">Crop guide: {data.crop_name}</h2>
      </div>

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
    </Card>
  );
}
