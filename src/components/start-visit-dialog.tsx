import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlayCircle, Loader2, ImagePlus, X, CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { compressAndUploadPhotos } from "@/lib/photo";
import { createUpdate } from "@/lib/db";
import { completeVisit, createVisit, type FarmVisitWithRefs, t } from "@/lib/visits";
import { STAGES } from "@/components/update-composer";

export function StartVisitDialog({ visit, trigger }: { visit: FarmVisitWithRefs; trigger?: React.ReactNode }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [observations, setObservations] = useState("");
  const [stage, setStage] = useState<string>("Vegetative");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [scheduleNext, setScheduleNext] = useState(false);
  const [nextDate, setNextDate] = useState("");
  const [busy, setBusy] = useState(false);

  const handleFiles = (fl: FileList | null) => {
    if (!fl) return;
    const arr = Array.from(fl).slice(0, 6 - files.length);
    setFiles((f) => [...f, ...arr]);
    setPreviews((p) => [...p, ...arr.map((f) => URL.createObjectURL(f))]);
  };
  const removeFile = (i: number) => {
    setFiles((f) => f.filter((_, idx) => idx !== i));
    setPreviews((p) => p.filter((_, idx) => idx !== i));
  };

  const submit = async () => {
    if (!user) return;
    setBusy(true);
    try {
      // If the visit is tied to a plant log, log observations + photos onto its timeline.
      if (visit.plant_log_id && (observations.trim() || files.length > 0)) {
        const urls = files.length ? await compressAndUploadPhotos(files, user.id) : [];
        await createUpdate(
          {
            log_id: visit.plant_log_id,
            growth_stage: stage,
            notes: observations.trim() ? `[Visit: ${visit.title}]\n${observations.trim()}` : `[Visit: ${visit.title}]`,
            image_urls: urls,
          },
          user.id,
        );
        qc.invalidateQueries({ queryKey: ["timeline", visit.plant_log_id] });
        qc.invalidateQueries({ queryKey: ["feed"] });
      }

      await completeVisit(visit.id, observations.trim() || undefined);

      if (scheduleNext && nextDate) {
        await createVisit(
          {
            farm_id: visit.farm_id,
            plant_log_id: visit.plant_log_id,
            title: `Follow-up: ${visit.title}`,
            visit_type: "follow_up",
            scheduled_date: nextDate,
            purpose: visit.purpose,
          },
          user.id,
        );
      }

      toast.success(t("Visit completed"));
      qc.invalidateQueries({ queryKey: ["my-visits", user.id] });
      qc.invalidateQueries({ queryKey: ["next-visit-farm", user.id, visit.farm_id] });
      if (visit.plant_log_id) qc.invalidateQueries({ queryKey: ["next-visit-log", user.id, visit.plant_log_id] });
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message ?? t("Couldn't finish visit"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <span onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}>
        {trigger ?? (
          <Button size="lg" className="h-11">
            <PlayCircle className="h-5 w-5 mr-2" /> {t("Start Visit")}
          </Button>
        )}
      </span>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{visit.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            {visit.farms?.name}
            {visit.plant_logs && <> · {visit.plant_logs.title}</>}
          </div>

          {visit.plant_log_id && (
            <div className="space-y-1.5">
              <Label className="text-base">{t("Growth stage")}</Label>
              <Select value={stage} onValueChange={setStage}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-base">{t("Observations")}</Label>
            <Textarea
              rows={4}
              placeholder={t("What you saw on the visit…")}
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-base">{t("Photographs")}</Label>
            <label className="flex items-center justify-center gap-2 rounded border-2 border-dashed h-16 cursor-pointer hover:bg-muted">
              <ImagePlus className="h-5 w-5" />
              <span className="text-sm">{t("Add photos")}</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </label>
            {previews.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {previews.map((src, i) => (
                  <div key={i} className="relative aspect-square">
                    <img src={src} className="rounded object-cover w-full h-full" alt="" />
                    <button
                      type="button"
                      className="absolute top-1 right-1 rounded-full bg-black/60 text-white p-0.5"
                      onClick={() => removeFile(i)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5 rounded border p-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={scheduleNext}
                onChange={(e) => setScheduleNext(e.target.checked)}
              />
              <CalendarPlus className="h-4 w-4" />
              <span className="text-sm font-medium">{t("Schedule next visit")}</span>
            </label>
            {scheduleNext && (
              <Input
                type="date"
                className="h-11"
                value={nextDate}
                onChange={(e) => setNextDate(e.target.value)}
              />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>{t("Cancel")}</Button>
          <Button onClick={submit} disabled={busy} className="h-11">
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t("Mark complete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
