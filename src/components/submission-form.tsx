import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, Loader2, X, Send, Save } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { compressAndUploadPhotos } from "@/lib/photo";
import { fetchMyMemberships } from "@/lib/team";
import { fetchLogsForFarm } from "@/lib/db";
import { createSubmission, type SubmissionType } from "@/lib/submissions";
import { toast } from "sonner";

const TYPES: { value: SubmissionType; label: string }[] = [
  { value: "progress", label: "Progress update" },
  { value: "measurement", label: "Measurement" },
  { value: "problem", label: "Report a problem" },
  { value: "harvest", label: "Harvest" },
];

export function SubmissionForm({
  trigger,
  defaultFarmId,
  defaultType = "progress",
}: {
  trigger: React.ReactNode;
  defaultFarmId?: string;
  defaultType?: SubmissionType;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [farmId, setFarmId] = useState<string | undefined>(defaultFarmId);
  const [logId, setLogId] = useState<string | undefined>();
  const [type, setType] = useState<SubmissionType>(defaultType);
  const [title, setTitle] = useState("");
  const [observations, setObservations] = useState("");
  const [measurementValue, setMeasurementValue] = useState("");
  const [measurementUnit, setMeasurementUnit] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState<"draft" | "submit" | null>(null);

  const memQ = useQuery({
    queryKey: ["my-memberships", user?.id],
    queryFn: () => (user ? fetchMyMemberships(user.id) : []),
    enabled: !!user && open,
  });
  const farms = (memQ.data ?? []).map((m: any) => m.farms).filter(Boolean);

  const logsQ = useQuery({
    queryKey: ["farm-logs", farmId],
    queryFn: () => (farmId ? fetchLogsForFarm(farmId) : []),
    enabled: !!farmId && open,
  });

  const reset = () => {
    setLogId(undefined);
    setTitle("");
    setObservations("");
    setMeasurementValue("");
    setMeasurementUnit("");
    setFiles([]);
    setType(defaultType);
  };

  const save = async (submit: boolean) => {
    if (!user || !farmId || !title.trim()) {
      toast.error("Farm and title are required");
      return;
    }
    setSaving(submit ? "submit" : "draft");
    try {
      let image_urls: string[] = [];
      if (files.length) image_urls = await compressAndUploadPhotos(files, user.id);
      const measurement_data =
        type === "measurement" && measurementValue
          ? { value: Number(measurementValue), unit: measurementUnit || null }
          : undefined;
      await createSubmission(
        {
          farm_id: farmId,
          plant_log_id: logId ?? null,
          submission_type: type,
          title: title.trim(),
          observations: observations.trim() || undefined,
          image_urls,
          measurement_data,
          submit,
        },
        user.id,
      );
      toast.success(submit ? "Submitted for review" : "Draft saved");
      qc.invalidateQueries({ queryKey: ["my-submissions"] });
      reset();
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save");
    } finally {
      setSaving(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Farmer update</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Farm</Label>
            <Select value={farmId} onValueChange={setFarmId}>
              <SelectTrigger className="h-11"><SelectValue placeholder="Select farm" /></SelectTrigger>
              <SelectContent>
                {farms.map((f: any) => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {farms.length === 0 && memQ.isFetched && (
              <p className="text-xs text-muted-foreground mt-1">You are not assigned to any farms yet.</p>
            )}
          </div>

          {!!farmId && (
            <div>
              <Label>Plant, crop, or trial (optional)</Label>
              <Select value={logId ?? "__none"} onValueChange={(v) => setLogId(v === "__none" ? undefined : v)}>
                <SelectTrigger className="h-11"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— None —</SelectItem>
                  {(logsQ.data ?? []).map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>Update type</Label>
            <Select value={type} onValueChange={(v) => setType(v as SubmissionType)}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Title</Label>
            <Input
              className="h-11"
              placeholder="e.g. New leaves on Row 3"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 120))}
            />
          </div>

          <div>
            <Label>Observation</Label>
            <Textarea
              rows={3}
              placeholder="What did you see?"
              value={observations}
              onChange={(e) => setObservations(e.target.value.slice(0, 2000))}
            />
          </div>

          {type === "measurement" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Value</Label>
                <Input className="h-11" type="number" value={measurementValue} onChange={(e) => setMeasurementValue(e.target.value)} />
              </div>
              <div>
                <Label>Unit</Label>
                <Input className="h-11" placeholder="cm, kg, count" value={measurementUnit} onChange={(e) => setMeasurementUnit(e.target.value)} />
              </div>
            </div>
          )}

          <div>
            <Label>Photos</Label>
            <label className="mt-1 flex h-24 cursor-pointer items-center justify-center rounded-md border-2 border-dashed bg-muted/50 text-sm text-muted-foreground">
              <Camera className="h-5 w-5 mr-2" />
              {files.length ? `${files.length} photo(s) selected` : "Take or upload photos"}
              <input
                type="file"
                multiple
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              />
            </label>
            {files.length > 0 && (
              <button
                type="button"
                onClick={() => setFiles([])}
                className="mt-1 text-xs text-muted-foreground flex items-center gap-1"
              >
                <X className="h-3 w-3" /> Clear
              </button>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1 h-12"
              disabled={!!saving}
              onClick={() => save(false)}
            >
              {saving === "draft" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Save draft
            </Button>
            <Button
              className="flex-1 h-12"
              disabled={!!saving}
              onClick={() => save(true)}
            >
              {saving === "submit" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
              Submit for review
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
