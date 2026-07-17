import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Users, UserPlus, Loader2, Mail, Ban, RotateCw, Trash2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { fetchFarmMembers, updateFarmMember, removeFarmMember, isAdmin, type MemberRole } from "@/lib/team";
import { inviteFarmMember, resendFarmInvite } from "@/lib/team.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

export function FarmTeamPanel({ farmId, farmOwnerId }: { farmId: string; farmOwnerId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const invite = useServerFn(inviteFarmMember);
  const resend = useServerFn(resendFarmInvite);
  const [expanded, setExpanded] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("farmer");
  const [inviting, setInviting] = useState(false);

  const adminQ = useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: () => (user ? isAdmin(user.id) : false),
    enabled: !!user,
  });
  const isOwner = user?.id === farmOwnerId;
  const canManage = isOwner || !!adminQ.data;

  const membersQ = useQuery({
    queryKey: ["farm-members", farmId],
    queryFn: () => fetchFarmMembers(farmId),
    enabled: canManage && expanded,
  });

  const update = useMutation({
    mutationFn: (v: { id: string; patch: Partial<{ member_role: MemberRole; status: "active" | "suspended" | "removed" }> }) =>
      updateFarmMember(v.id, v.patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["farm-members", farmId] }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => removeFarmMember(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["farm-members", farmId] }),
  });

  if (!canManage) return null;

  const onInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setInviting(true);
    try {
      await invite({ data: { farmId, email: email.trim(), role } });
      toast.success(`Invitation sent to ${email.trim()}`);
      setEmail("");
      qc.invalidateQueries({ queryKey: ["farm-members", farmId] });
    } catch (err: any) {
      toast.error(err?.message ?? "Could not invite user");
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="rounded-md border bg-muted/40 p-2 space-y-2">
      <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => setExpanded((v) => !v)}>
        <Users className="h-4 w-4 mr-2" /> Farm Team
        {expanded ? <span className="ml-auto text-xs">Hide</span> : <span className="ml-auto text-xs">Manage</span>}
      </Button>

      {expanded && (
        <div className="space-y-3">
          <form onSubmit={onInvite} className="space-y-2 rounded-md border bg-background p-2">
            <Label className="text-xs">Invite by email</Label>
            <div className="flex gap-2">
              <Input
                type="email"
                required
                placeholder="farmer@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-9"
              />
              <Select value={role} onValueChange={(v) => setRole(v as MemberRole)}>
                <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="farmer">Farmer</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" size="sm" disabled={inviting} className="h-9">
                {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              </Button>
            </div>
          </form>

          <div className="space-y-1.5">
            {membersQ.isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}
            {(membersQ.data ?? []).map((m) => {
              const name = m.profiles?.display_name ?? m.user_id.slice(0, 8);
              return (
                <div key={m.id} className="flex items-center gap-2 rounded-md border bg-background p-2 text-xs">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate flex items-center gap-1.5">
                      {m.member_role === "owner" && <ShieldCheck className="h-3 w-3 text-primary" />}
                      {name}
                    </div>
                    <div className="text-muted-foreground flex gap-1.5 items-center">
                      <Badge variant="outline" className="text-[10px] py-0 px-1.5">{m.member_role}</Badge>
                      <Badge
                        variant={m.status === "active" ? "default" : m.status === "invited" ? "secondary" : "destructive"}
                        className="text-[10px] py-0 px-1.5"
                      >
                        {m.status}
                      </Badge>
                    </div>
                  </div>
                  {m.member_role !== "owner" && (
                    <div className="flex gap-1">
                      {m.status === "invited" && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          title="Resend invite"
                          onClick={async () => {
                            try {
                              await resend({ data: { memberId: m.id } });
                              toast.success("Invitation resent");
                            } catch (e: any) {
                              toast.error(e?.message ?? "Could not resend");
                            }
                          }}
                        >
                          <Mail className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {m.status === "suspended" ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          title="Reactivate"
                          onClick={() => update.mutate({ id: m.id, patch: { status: "active" } })}
                        >
                          <RotateCw className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          title="Suspend"
                          onClick={() => update.mutate({ id: m.id, patch: { status: "suspended" } })}
                        >
                          <Ban className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        title="Remove"
                        onClick={() => {
                          if (confirm("Remove this member?")) remove.mutate(m.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
            {membersQ.data && membersQ.data.length === 0 && (
              <p className="text-xs text-muted-foreground">No team members yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
