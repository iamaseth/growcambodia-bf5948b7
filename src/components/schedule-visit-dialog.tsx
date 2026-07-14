import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { fetchMyFarms, fetchLogsForFarm } from "@/lib/db";
import { createVisit, t } from "@/lib/visits";

const VISIT_TYPES = ["general", "inspection", "measurement", "treatment", "harvest", "follow_up"];

export function ScheduleVisitDialog({
  trigger,
  farmId: initialFarmId,
  plantLogId: initialLogId,
  onCreated,
}: {
  trigger?: React.ReactNode;
  farmId?: string;
  plantLogId?: string;
  onCreated?: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [farmId, setFarmId] = useState(initialFarmId ?? "");
  const [logId, setLogId] = useState<string>(initialLogId ?? "__none__");
  const [title, setTitle] = useState("");
  const [visitType, setVisitType] = useState("general");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("");
  const [purpose, setPurpose] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const farmsQ = useQuery({
    queryKey: ["myfarms", user?.id],
    queryFn: () => fetchMyFarms(user!.id),
    enabled: !!user && open,
  });
  const logsQ = useQuery({
    queryKey: ["farm-logs", farmId],
    queryFn: () => fetchLogsForFarm(farmId),
    enabled: !!farmId && open,
  });

  const reset = () => {
    setFarmId(initialFarmId ?? "");
    setLogId(initialLogId ?? "__none__");
    setTitle("");
    setVisitType("general");
    setDate(new Date().toISOString().slice(0, 10));
    setTime("");
    setPurpose("");
    setNotes("");
  };

  const submit = async () => {
    if (!user) return;
    if (!farmId) return toast.error(t("Choose a farm"));
    if (!title.trim()) return toast.error(t("Add a short title"));
    if (!date) return toast.error(t("Pick a date"));
    setBusy(true);
    try {
      await createVisit(
        {
          farm_id: farmId,
          plant_log_id: logId && logId !== "__none__" ? logId : null,
          title: title.trim(),
          visit_type: visitType,
          scheduled_date: date,
          scheduled_time: time || null,
          purpose: purpose.trim() || null,
          private_notes: notes.trim() || null,
        },
        user.id,
      );
      toast.success(t("Visit scheduled"));
      qc.invalidateQueries({ queryKey: ["my-visits", user.id] });
      qc.invalidateQueries({ queryKey: ["next-visit-farm", user.id, farmId] });
      if (logId && logId !== "__none__") {
        qc.invalidateQueries({ queryKey: ["next-visit-log", user.id, logId] });
      }
      reset();
      setOpen(false);
      onCreated?.();
    } catch (e: any) {
      toast.error(e.message ?? t("Couldn't schedule visit"));
    } finally {
      setBusy(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="lg" className="h-12 text-base">
            <CalendarPlus className="h-5 w-5 mr-2" /> {t("Schedule Visit")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("Schedule a farm visit")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-base">{t("Farm")}</Label>
            <Select value={farmId} onValueChange={(v) => { setFarmId(v); setLogId("__none__"); }}>
              <SelectTrigger className="h-11"><SelectValue placeholder={t("Choose a farm")} /></SelectTrigger>
              <SelectContent>
                {(farmsQ.data ?? []).map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
                {(farmsQ.data ?? []).length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">{t("No farms yet")}</div>
                )}
              </SelectContent>
            </Select>
          </div>

          {farmId && (
            <div className="space-y-1.5">
              <Label className="text-base">{t("Plant / trial (optional)")}</Label>
              <Select value={logId} onValueChange={setLogId}>
                <SelectTrigger className="h-11"><SelectValue placeholder={t("Whole farm")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("Whole farm")}</SelectItem>
                  {(logsQ.data ?? []).map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.title} · {l.crop_type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-base">{t("Visit title")}</Label>
            <Input
              className="h-11 text-base"
              placeholder={t("e.g. Check durian flowering")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-base">{t("Date")}</Label>
              <Input className="h-11 text-base" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-base">{t("Time")}</Label>
              <Input className="h-11 text-base" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-base">{t("Type")}</Label>
            <Select value={visitType} onValueChange={setVisitType}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                {VISIT_TYPES.map((v) => <SelectItem key={v} value={v}>{v.replace("_", " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-base">{t("Purpose")}</Label>
            <Textarea
              rows={2}
              placeholder={t("What are you checking on this visit?")}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-base">{t("Private preparation notes")}</Label>
            <Textarea
              rows={3}
              placeholder={t("Only visible to you. Tools to bring, questions to ask…")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">{t("Never shown publicly.")}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>{t("Cancel")}</Button>
          <Button onClick={submit} disabled={busy} className="h-11">
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t("Schedule visit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
