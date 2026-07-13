import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ImagePlus, Loader2, X, LocateFixed } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { compressAndUploadPhotos } from "@/lib/photo";
import { createUpdate, fetchMyFarms, fetchLogsForFarm, createFarm, createLog, fetchLatestStage } from "@/lib/db";
import { COMMON_CROPS } from "@/lib/crops";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";


export const STAGES = [
  "Soil Preparation",
  "Seed/Planting",
  "Germination",
  "Transplant",
  "Vegetative",
  "Flowering",
  "Fruiting",
  "Harvest",
];

const TREE_CROPS = ["durian", "mango", "coconut", "jackfruit", "papaya", "avocado", "lychee", "longan", "rambutan", "cacao", "citrus", "orange", "lemon", "lime"];
const isTreeCrop = (crop: string) => {
  const c = crop.toLowerCase().trim();
  return TREE_CROPS.some((t) => c.includes(t));
};

function useGeolocation() {
  return (): Promise<GeolocationCoordinates> =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error("Geolocation not supported on this device"));
      navigator.geolocation.getCurrentPosition((p) => resolve(p.coords), (err) => {
        if (err.code === err.PERMISSION_DENIED) reject(new Error("Location permission denied"));
        else reject(new Error("Couldn't get your location"));
      }, { timeout: 10000, enableHighAccuracy: true });
    });
}

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
  const getGeo = useGeolocation();
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
  const [farmCoords, setFarmCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locBusy, setLocBusy] = useState(false);

  const [newLogMode, setNewLogMode] = useState(false);
  const [logTitle, setLogTitle] = useState("");
  const [cropType, setCropType] = useState("");
  const [variety, setVariety] = useState("");
  const [plantedAt, setPlantedAt] = useState("");
  const [ageYears, setAgeYears] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [areaValue, setAreaValue] = useState<string>("");
  const [areaUnit, setAreaUnit] = useState<string>("m2");
  const [plantCoords, setPlantCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [plantLocBusy, setPlantLocBusy] = useState(false);

  const showAgeField = stage === "Transplant" || isTreeCrop(cropType);

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

  // Default growth stage to the most recent stage posted for the selected listing.
  const activeLogId = logId ?? (selectedLog && selectedLog !== "__new__" ? selectedLog : "");
  const latestStageQ = useQuery({
    queryKey: ["latest-stage", activeLogId],
    queryFn: () => fetchLatestStage(activeLogId),
    enabled: !!activeLogId && open,
  });
  useEffect(() => {
    if (latestStageQ.data) setStage(latestStageQ.data);
  }, [latestStageQ.data]);


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

  const useCurrentLocation = async () => {
    setLocBusy(true);
    try {
      const c = await getGeo();
      setFarmCoords({ lat: c.latitude, lng: c.longitude });
      toast.success("Location captured");
    } catch (e: any) {
      toast.error(e.message ?? "Couldn't get location");
    } finally {
      setLocBusy(false);
    }
  };

  const usePlantLocation = async () => {
    setPlantLocBusy(true);
    try {
      const c = await getGeo();
      setPlantCoords({ lat: c.latitude, lng: c.longitude });
      toast.success("Plant location captured");
    } catch (e: any) {
      toast.error(e.message ?? "Couldn't get location");
    } finally {
      setPlantLocBusy(false);
    }
  };

  const reset = () => {
    setStage("Vegetative");
    setNotes("");
    setFiles([]);
    setPreviews([]);
    setNewFarmMode(false);
    setNewLogMode(false);
    setFarmName("");
    setFarmCoords(null);
    setLogTitle("");
    setCropType("");
    setVariety("");
    setPlantedAt("");
    setAgeYears("");
    setQuantity("");
    setAreaValue("");
    setAreaUnit("m2");
    setPlantCoords(null);
    if (!logId) {
      setSelectedFarm("");
      setSelectedLog("");
    }
  };

  const submit = async () => {
    if (!user) return;
    setBusy(true);
    try {
      let targetLog = selectedLog;

      if (!logId) {
        let farmId = selectedFarm;
        if (newFarmMode) {
          if (!farmName.trim()) throw new Error("Farm name required");
          const coords = farmCoords ?? (await getGeo().then((c) => ({ lat: c.latitude, lng: c.longitude })).catch(() => null));
          if (!coords) throw new Error("Tap 'Use my current location' to drop the pin");
          const farm = await createFarm(
            { name: farmName.trim(), lat: coords.lat, lng: coords.lng },
            user.id,
          );
          farmId = farm.id;
          qc.invalidateQueries({ queryKey: ["farms"] });
          qc.invalidateQueries({ queryKey: ["myfarms"] });
        }
        if (!farmId) throw new Error("Pick a farm");

        if (newLogMode || newFarmMode) {
          if (!logTitle.trim() || !cropType.trim()) throw new Error("Plant title and crop type required");
          const log = await createLog(
            {
              farm_id: farmId,
              title: logTitle.trim(),
              crop_type: cropType.trim(),
              variety: variety.trim() || null,
              planted_at: plantedAt || null,
              estimated_age_years: ageYears ? Number(ageYears) : null,
              quantity: quantity ? Number(quantity) : null,
              area_value: areaValue ? Number(areaValue) : null,
              area_unit: areaValue ? areaUnit : null,
              lat: plantCoords?.lat ?? null,
              lng: plantCoords?.lng ?? null,
            },
            user.id,
          );
          targetLog = log.id;
        } else if (!targetLog || targetLog === "__new__") {
          throw new Error("Pick which plant this update is for");
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
                  <div className="space-y-2">
                    <Input placeholder="Farm name" value={farmName} onChange={(e) => setFarmName(e.target.value)} />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={useCurrentLocation}
                      disabled={locBusy}
                      className="w-full"
                    >
                      {locBusy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <LocateFixed className="h-4 w-4 mr-1" />}
                      {farmCoords ? `Location captured (${farmCoords.lat.toFixed(4)}, ${farmCoords.lng.toFixed(4)})` : "Use my current location"}
                    </Button>
                  </div>
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
              </div>

              {(selectedFarm || newFarmMode) && (
                <div className="space-y-2 rounded border p-3">
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
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <Input placeholder="Title (e.g. North bed)" value={logTitle} onChange={(e) => setLogTitle(e.target.value)} />
                        <Input placeholder="Crop (e.g. Durian)" value={cropType} onChange={(e) => setCropType(e.target.value)} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input placeholder="Variety (optional)" value={variety} onChange={(e) => setVariety(e.target.value)} />
                        <Input type="date" value={plantedAt} onChange={(e) => setPlantedAt(e.target.value)} title="Planted date" />
                      </div>
                      {showAgeField && (
                        <div className="space-y-1">
                          <Label className="text-xs">Estimated age (years) — optional</Label>
                          <Input type="number" step="0.5" min="0" placeholder="e.g. 3" value={ageYears} onChange={(e) => setAgeYears(e.target.value)} />
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Number of plants/trees</Label>
                          <Input type="number" min="0" placeholder="e.g. 50" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Planted area</Label>
                          <div className="flex gap-1">
                            <Input type="number" min="0" step="0.01" placeholder="e.g. 200" value={areaValue} onChange={(e) => setAreaValue(e.target.value)} />
                            <Select value={areaUnit} onValueChange={setAreaUnit}>
                              <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="m2">m²</SelectItem>
                                <SelectItem value="hectares">ha</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Fill whichever applies — number of plants OR planted area.</p>
                      <div className="space-y-1 pt-1 border-t">
                        <Label className="text-xs">Plant location (optional)</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={usePlantLocation}
                          disabled={plantLocBusy}
                          className="w-full"
                        >
                          {plantLocBusy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <LocateFixed className="h-4 w-4 mr-1" />}
                          {plantCoords ? `Pinned (${plantCoords.lat.toFixed(5)}, ${plantCoords.lng.toFixed(5)})` : "Pin this plant's exact spot"}
                        </Button>
                        <p className="text-[10px] text-muted-foreground">
                          Stand next to the plant/row and tap. Phone GPS is accurate to ~3–10 m — good enough to find a specific tree or bed on a 1 ha farm. Leave blank to inherit the farm's location.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <Select
                      value={selectedLog}
                      onValueChange={(v) => {
                        if (v === "__new__") {
                          setNewLogMode(true);
                          setSelectedLog("");
                        } else {
                          setSelectedLog(v);
                        }
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Choose which plant" /></SelectTrigger>
                      <SelectContent>
                        {(logs ?? []).map((l) => (
                          <SelectItem key={l.id} value={l.id}>{l.title} · {l.crop_type}</SelectItem>
                        ))}
                        {(logs ?? []).length === 0 && (
                          <div className="px-2 py-1.5 text-xs text-muted-foreground">No plants at this farm yet.</div>
                        )}
                        <SelectItem value="__new__">+ Add new plant</SelectItem>
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
