import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ImagePlus, Loader2, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { compressAndUploadPhotos } from "@/lib/photo";
import { createUpdate, fetchMyFarms, fetchLogsForFarm, createFarm, createLog } from "@/lib/db";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

const STAGES = ["Seeding", "Germination", "Vegetative", "Flowering", "Fruiting", "Harvest"];

export function UpdateComposer({
  logId,
  trigger,
  onCreated,
}: {
  logId?: string;
  trigger?: React.ReactNode;
  onCreated?: () => void;
}) {
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState("Vegetative");
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const [selectedFarm, setSelectedFarm] = useState<string>("");
  const [selectedLog, setSelectedLog] = useState<string>(logId ?? "");
  const [newFarmMode, setNewFarmMode] = useState(false);
  const [farmName, setFarmName] = useState("");
  const [newLogMode, setNewLogMode] = useState(false);
  const [logTitle, setLogTitle] = useState("");
  const [cropType, setCropType] = useState("");

  const { data: farms } = useQuery({
    queryKey: ["myfarms", user?.id],
    queryFn: () => fetchMyFarms(user!.id),
    enabled: !!user && open && !logId,
  });
  const { data: logs } = useQuery({
    queryKey: ["farm-logs", selectedFarm],
    queryFn: () => fetchLogsForFarm(selectedFarm),
    enabled: !!selectedFarm && !logId,
  });

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

  const reset = () => {
    setStage("Vegetative");
    setNotes("");
    setFiles([]);
    setPreviews([]);
    setNewFarmMode(false);
    setNewLogMode(false);
    setFarmName("");
    setLogTitle("");
    setCropType("");
    if (!logId) {
      setSelectedFarm("");
      setSelectedLog("");
    }
  };

  const useGeolocation = (): Promise<GeolocationCoordinates> =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error("Geolocation not supported"));
      navigator.geolocation.getCurrentPosition((p) => resolve(p.coords), reject, { timeout: 10000 });
    });

  const submit = async () => {
    if (!user) return;
    setBusy(true);
    try {
      let targetLog = selectedLog;

      if (!logId) {
        let farmId = selectedFarm;
        if (newFarmMode) {
          if (!farmName.trim()) throw new Error("Farm name required");
          const coords = await useGeolocation().catch(() => null);
          if (!coords) throw new Error("Location permission needed to drop a farm pin");
          const farm = await createFarm(
            { name: farmName.trim(), lat: coords.latitude, lng: coords.longitude },
            user.id,
          );
          farmId = farm.id;
          qc.invalidateQueries({ queryKey: ["farms"] });
          qc.invalidateQueries({ queryKey: ["myfarms"] });
        }
        if (!farmId) throw new Error("Pick a farm");

        if (newLogMode || !targetLog) {
          if (!logTitle.trim() || !cropType.trim()) throw new Error("Log title and crop type required");
          const log = await createLog(
            { farm_id: farmId, title: logTitle.trim(), crop_type: cropType.trim() },
            user.id,
          );
          targetLog = log.id;
        }
      }

      if (!targetLog) throw new Error("No plant log selected");

      const urls = files.length ? await compressAndUploadPhotos(files, user.id) : [];
      await createUpdate({ log_id: targetLog, growth_stage: stage, notes: notes.trim(), image_urls: urls }, user.id);
      toast.success("Update posted!");
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["timeline", targetLog] });
      qc.invalidateQueries({ queryKey: ["mylogs"] });
      reset();
      setOpen(false);
      onCreated?.();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to post");
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return (
      <Button onClick={() => nav({ to: "/auth" })} size="lg" className="rounded-full shadow-lg">
        <Plus className="h-5 w-5 mr-1" /> New update
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="lg" className="rounded-full shadow-lg">
            <Plus className="h-5 w-5 mr-1" /> New update
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New growth update</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!logId && (
            <>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Farm</Label>
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => setNewFarmMode((v) => !v)}
                  >
                    {newFarmMode ? "Pick existing" : "+ New farm here"}
                  </button>
                </div>
                {newFarmMode ? (
                  <Input placeholder="Farm name" value={farmName} onChange={(e) => setFarmName(e.target.value)} />
                ) : (
                  <Select value={selectedFarm} onValueChange={(v) => { setSelectedFarm(v); setSelectedLog(""); }}>
                    <SelectTrigger><SelectValue placeholder="Choose a farm" /></SelectTrigger>
                    <SelectContent>
                      {(farms ?? []).map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {newFarmMode && (
                  <p className="text-xs text-muted-foreground">We'll use your current GPS location to drop the pin.</p>
                )}
              </div>

              {(selectedFarm || newFarmMode) && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>Plant log</Label>
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={() => setNewLogMode((v) => !v)}
                    >
                      {newLogMode ? "Pick existing" : "+ New log"}
                    </button>
                  </div>
                  {newLogMode || newFarmMode ? (
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="Title (e.g. North bed)" value={logTitle} onChange={(e) => setLogTitle(e.target.value)} />
                      <Input placeholder="Crop (e.g. Tomato)" value={cropType} onChange={(e) => setCropType(e.target.value)} />
                    </div>
                  ) : (
                    <Select value={selectedLog} onValueChange={setSelectedLog}>
                      <SelectTrigger><SelectValue placeholder="Choose a log" /></SelectTrigger>
                      <SelectContent>
                        {(logs ?? []).map((l) => (
                          <SelectItem key={l.id} value={l.id}>{l.title} · {l.crop_type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
            </>
          )}

          <div className="space-y-1.5">
            <Label>Growth stage</Label>
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What did you see today?" />
          </div>

          <div className="space-y-2">
            <Label>Photos ({files.length}/6)</Label>
            <div className="grid grid-cols-3 gap-2">
              {previews.map((p, i) => (
                <div key={i} className="relative aspect-square rounded overflow-hidden bg-muted">
                  <img src={p} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {files.length < 6 && (
                <label className="aspect-square rounded border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:bg-muted">
                  <ImagePlus className="h-6 w-6 text-muted-foreground" />
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    capture="environment"
                    className="hidden"
                    onChange={(e) => handleFiles(e.target.files)}
                  />
                </label>
              )}
            </div>
          </div>

          <Button className="w-full h-11" onClick={submit} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Post update
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
